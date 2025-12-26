import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import CryptoJS from 'crypto-js';
import type { ServiceType, QuoteFormData, QuestionConfig, QuestionAnswer, UploadedPhoto } from '../types/quote';
import { SERVICE_QUESTIONS } from '../types/quote';
import ServiceSelection from './ServiceSelection';
import QuestionStep from './QuestionStep';
import PhotoUpload from './PhotoUpload';
import ContactInfo from './ContactInfo';
import ThankYou from './ThankYou';
import SectionCard from './SectionCard';
import HeroSection from './HeroSection';
import StepIndicator from './StepIndicator';
import { apiUrl } from '../lib/api';

const GOOGLE_SHEET_ENDPOINT =
  import.meta.env.VITE_SHEETS_URL ||
  'https://script.google.com/macros/s/AKfycbxF3byLylGeLSTZTsTmeVEUwz-rFhNrA0hhypaJrx-XxcW9pzg7EfYGmafEhsDPFF7YLA/exec';
const STORAGE_KEY = 'miyomint_form_draft';
const STORAGE_KEY_SECRET = 'miyomint_form_key';
const DRAFT_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const DRAFT_ENDPOINT = apiUrl('/api/draft');
const INCOMPLETE_ENDPOINT = apiUrl('/api/incomplete');

const createDraftId = () => {
  if (typeof globalThis !== 'undefined' && typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createDraftKey = () => {
  if (typeof globalThis !== 'undefined' && typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const readSavedDraft = () => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const secret = sessionStorage.getItem(STORAGE_KEY_SECRET);
    if (!saved || !secret) return null;
    const parsed: SavedFormState = JSON.parse(saved);
    if (!parsed.draftId || !parsed.expiresAt || parsed.expiresAt < Date.now() || !parsed.encrypted) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    const bytes = CryptoJS.AES.decrypt(parsed.encrypted, secret);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    const payload = JSON.parse(decrypted) as SavedDraftPayload;
    return { ...payload, draftId: parsed.draftId };
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    return null;
  }
};
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

interface SavedFormState {
  draftId: string;
  encrypted: string;
  expiresAt: number;
}

interface SavedDraftPayload {
  formData: Omit<QuoteFormData, 'uploadedPhotos'>;
  currentStep: number;
  savedAt: number;
}

interface QuoteFormProps {
  onWizardModeChange?: (active: boolean) => void;
}

export default function QuoteForm({ onWizardModeChange }: QuoteFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<QuoteFormData>({
    serviceType: '',
    zipCode: '',
    responses: {},
  });
  const [persistDrafts, setPersistDrafts] = useState(() => Boolean(readSavedDraft()));
  const [draftKey, setDraftKey] = useState(() => {
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem(STORAGE_KEY_SECRET) || '';
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [draftId, setDraftId] = useState(() => {
    const stored = readSavedDraft();
    return stored?.draftId || createDraftId();
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showDraftRestored, setShowDraftRestored] = useState(false);

  const questions = useMemo(
    () => formData.serviceType ? SERVICE_QUESTIONS[formData.serviceType as ServiceType] : [],
    [formData.serviceType]
  );

  const totalSteps = formData.serviceType ? questions.length + 2 : 1;
  const progressValue = useMemo(() => {
    if (currentStep === 0) return 0;
    const maxSteps = Math.max(totalSteps, 1);
    return Math.min(100, Math.max(0, Math.round((currentStep / maxSteps) * 100)));
  }, [currentStep, totalSteps]);
  const isWizardActive = currentStep > 0 && !isComplete;
  const formShellRef = useRef<HTMLDivElement | null>(null);

  const saveToStorage = useCallback((data: QuoteFormData, step: number) => {
    if (!persistDrafts) return;

    let keyToUse = draftKey;
    if (!keyToUse) {
      keyToUse = createDraftKey();
      setDraftKey(keyToUse);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(STORAGE_KEY_SECRET, keyToUse);
      }
    }

    try {
      const { uploadedPhotos, ...dataWithoutPhotos } = data;
      const payload: SavedDraftPayload = {
        formData: dataWithoutPhotos,
        currentStep: step,
        savedAt: Date.now(),
      };
      const encrypted = CryptoJS.AES.encrypt(JSON.stringify(payload), keyToUse).toString();
      const state: SavedFormState = {
        draftId,
        encrypted,
        expiresAt: Date.now() + DRAFT_TTL_MS,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Could not save form draft:', e);
    }
  }, [draftId, draftKey, persistDrafts]);

  const deleteDraftOnServer = useCallback(async (id?: string) => {
    if (!id) return;
    try {
      await fetch(DRAFT_ENDPOINT, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId: id }),
      });
    } catch (error) {
      console.warn('Failed to delete draft record:', error);
    }
  }, []);

  const saveDraftToServer = useCallback(async () => {
    if (!draftId || !formData.serviceType || currentStep === 0 || isComplete) return;

    const payload = {
      draftId,
      serviceType: formData.serviceType,
      zipCode: formData.zipCode || null,
      responses: formData.responses || {},
      currentStep,
      progress: progressValue,
      meta: {
        savedAt: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      },
    };

    try {
      await fetch(DRAFT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.warn('Failed to persist draft:', error);
    }
  }, [currentStep, draftId, formData.responses, formData.serviceType, formData.zipCode, isComplete, totalSteps, progressValue]);

  const sendIncompleteReport = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!persistDrafts) return;
    if (!draftId || isComplete || currentStep === 0 || !formData.serviceType) return;

    const payload = {
      draftId,
      serviceType: formData.serviceType,
      progress: progressValue,
      meta: {
        step: currentStep,
        reportedAt: new Date().toISOString(),
      },
    };

    const serialized = JSON.stringify(payload);
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([serialized], { type: 'application/json' });
      navigator.sendBeacon(INCOMPLETE_ENDPOINT, blob);
      return;
    }

    void fetch(INCOMPLETE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: serialized,
    }).catch(() => {});
  }, [currentStep, draftId, formData.serviceType, isComplete, persistDrafts, progressValue]);

  const clearStorage = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY_SECRET);
    } catch (e) {
      console.warn('Could not clear form draft:', e);
    }
    setDraftKey('');
    setDraftId(createDraftId());
  }, []);

  const handlePersistToggle = useCallback((checked: boolean) => {
    setPersistDrafts(checked);

    if (!checked) {
      clearStorage();
      return;
    }

    const key = draftKey || createDraftKey();
    setDraftKey(key);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY_SECRET, key);
    }

    try {
      const { uploadedPhotos, ...dataWithoutPhotos } = formData;
      const payload: SavedDraftPayload = {
        formData: dataWithoutPhotos,
        currentStep,
        savedAt: Date.now(),
      };
      const encrypted = CryptoJS.AES.encrypt(JSON.stringify(payload), key).toString();
      const state: SavedFormState = {
        draftId,
        encrypted,
        expiresAt: Date.now() + DRAFT_TTL_MS,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Could not persist draft:', error);
    }
  }, [clearStorage, currentStep, draftId, draftKey, formData]);

  useEffect(() => {
    const saved = readSavedDraft();
    if (!saved) return;

    const hoursSinceSave = (Date.now() - saved.savedAt) / (1000 * 60 * 60);
    if (hoursSinceSave < DRAFT_TTL_MS / (1000 * 60 * 60) && saved.formData.serviceType) {
      setFormData({ ...saved.formData, uploadedPhotos: undefined });
      setCurrentStep(saved.currentStep);
      setDraftId(saved.draftId);
      setPersistDrafts(true);
      setShowDraftRestored(true);
      setTimeout(() => setShowDraftRestored(false), 4000);
    } else {
      clearStorage();
      void deleteDraftOnServer(saved.draftId);
    }
  }, [clearStorage, deleteDraftOnServer]);

  // Listen for chat-selected service to auto-fill and skip service step
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ serviceType?: string }>).detail;
      const svc = detail?.serviceType as ServiceType | undefined;
      if (!svc) return;
      setFormData((prev) => ({ ...prev, serviceType: svc }));
      setCurrentStep(1);
    };
    window.addEventListener('chat-service-selected', handler as EventListener);
    return () => window.removeEventListener('chat-service-selected', handler as EventListener);
  }, []);

  useEffect(() => {
    const photoStep = questions.length + 1;
    if (formData.serviceType && currentStep > 0 && currentStep < photoStep) {
      saveToStorage(formData, currentStep);
      void saveDraftToServer();
    }
  }, [formData, currentStep, saveToStorage, questions.length, saveDraftToServer]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        sendIncompleteReport();
      }
    };

    const handleUnload = () => {
      sendIncompleteReport();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handleUnload);
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handleUnload);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [sendIncompleteReport]);

  const handleServiceAndZip = (serviceType: ServiceType, zipCode: string) => {
    setFormData({ ...formData, serviceType, zipCode });
    setTimeout(() => setCurrentStep(1), 220);
  };

  const handleAnswer = (questionId: string, answer: QuestionAnswer) => {
    setFormData({
      ...formData,
      responses: { ...formData.responses, [questionId]: answer },
    });
  };

  const isProbablyMobileDevice = () => {
    if (typeof navigator === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const navigateToThankYou = () => {
    if (typeof window === 'undefined') return;
    if (isProbablyMobileDevice()) {
      window.location.href = '/thank-you';
    } else {
      window.history.replaceState(null, '', '/thank-you');
    }
  };

  const handleNext = () => {
    setCurrentStep((prev) => prev + 1);
  };

  const handlePhotos = (uploadedPhotos: UploadedPhoto[]) => {
    setFormData((prev) => ({ ...prev, uploadedPhotos }));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const formatAnswerForSheet = (answer: unknown) => {
    if (Array.isArray(answer)) return answer.join(', ');
    if (typeof answer === 'object' && answer !== null) return JSON.stringify(answer);
    return answer ?? '';
  };

  const buildAnswerRows = () => {
    if (!formData.serviceType) return [];
    const configs: QuestionConfig[] = SERVICE_QUESTIONS[formData.serviceType as ServiceType] || [];
    return configs.map((config, index) => ({
      order: index + 1,
      questionId: config.id,
      question: config.question,
      answer: formatAnswerForSheet(formData.responses[config.id]),
    }));
  };

  const submitWithRetry = async (payload: object, attempt: number = 1): Promise<boolean> => {
    setRetryCount(attempt);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(GOOGLE_SHEET_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error(`Submit attempt ${attempt} failed:`, error);
      
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
        return submitWithRetry(payload, attempt + 1);
      }
      
      throw error;
    }
  };

  const handleContactInfo = async (name: string, email: string, phone: string) => {
    setIsSubmitting(true);
    setSubmitError(null);

    const photoUrls = formData.uploadedPhotos?.map((p) => p.url) || [];
    const primaryPhoto = photoUrls[0] || '';
    const photo2 = photoUrls[1] || '';
    const photo3 = photoUrls[2] || '';
    const photo4 = photoUrls[3] || '';
    const photoUrlCombined = photoUrls.join(', ');
    const answersRows = buildAnswerRows();
    const summaryAnswersOnly = answersRows
      .map((row) => `${row.question}: ${row.answer || 'n/a'}`)
      .join(' | ');

    const sheetPayload = {
      // Orijinal alanlar
      name,
      email,
      phone,
      serviceType: formData.serviceType,
      zipCode: formData.zipCode,
      responses: formData.responses,
      raw_responses_json: JSON.stringify(formData.responses || {}),
      answers: answersRows,
      responseSummary: summaryAnswersOnly,
      photos: photoUrls,
      photoUrls: photoUrls, // Sheets endpoint fallback
      photoCount: photoUrls.length,
      linked_photo: primaryPhoto,
      linked_photo2: photo2,
      linked_photo3: photo3,
      linked_photo4: photo4,
      photo_url: primaryPhoto,
      photo_url_2: photo2,
      photo_url_3: photo3,
      photo_url_4: photo4,
      submittedAt: new Date().toISOString(),
      submittedAtLocal: new Date().toLocaleString(),
      // Sheet başlıklarıyla birebir eşleşen snake_case alanlar
      submitted_at_utc: new Date().toISOString(),
      submitted_at_local: new Date().toLocaleString(),
      full_name: name,
      service_type: formData.serviceType,
      zip_code: formData.zipCode,
      response_summary: summaryAnswersOnly,
      answers_json: JSON.stringify(answersRows),
      // raw_responses_json zaten yukarıda var; sheet tarafı snake_case de istiyor
    };

    const dbPayload = {
      name,
      email,
      phone,
      serviceType: formData.serviceType,
      zipCode: formData.zipCode,
      answers: formData.responses,
      photoUrls: formData.uploadedPhotos?.map(p => p.url) || [],
      draftId,
    };

    try {
        const submitEndpoint = import.meta.env.VITE_SUBMIT_URL || '/api/submit';
        const resolvedSubmitEndpoint = apiUrl(submitEndpoint);

        const results = await Promise.allSettled([
          submitWithRetry(sheetPayload),
          fetch(resolvedSubmitEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dbPayload),
        }).then(async (res) => {
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${res.status}`);
          }
          return res.json();
        }),
      ]);
      
      const dbResult = results[1];
      if (dbResult.status === 'rejected') {
        console.warn('Database save failed:', dbResult.reason);
      } else if (dbResult.value?.success) {
        console.log('Saved to database:', dbResult.value.submissionId);
      }
      
      const sheetResult = results[0];
      if (sheetResult.status === 'rejected') {
        throw sheetResult.reason;
      }
      
      await deleteDraftOnServer(draftId);
      clearStorage();
      setIsComplete(true);
      navigateToThankYou();
    } catch (error) {
      console.error('Error submitting quote:', error);
      setSubmitError(
        'We couldn\'t submit your request right now. Please check your internet connection and try again.'
      );
    } finally {
      setIsSubmitting(false);
      setRetryCount(0);
    }
  };

  const handleDismissError = () => {
    setSubmitError(null);
  };

  const handleStartOver = () => {
    void deleteDraftOnServer(draftId);
    setFormData({ serviceType: '', zipCode: '', responses: {} });
    setCurrentStep(0);
    setIsComplete(false);
    setSubmitError(null);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/');
    }
  };

  useEffect(() => {
    if (isComplete || currentStep === 0) return;
    const section = formShellRef.current;
    if (!section) return;

    const { top } = section.getBoundingClientRect();
    const currentScroll = window.scrollY || document.documentElement.scrollTop;
    const offset = window.innerHeight * 0.15;
    const target = Math.max(top + currentScroll - offset, 0);

    window.scrollTo({ top: target, behavior: 'smooth' });
  }, [currentStep, isComplete]);

  const hideExternalSections = isWizardActive || isComplete;

  useEffect(() => {
    onWizardModeChange?.(hideExternalSections);
  }, [hideExternalSections, onWizardModeChange]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.pathname === '/thank-you') {
      setIsComplete(true);
    }
  }, []);

  if (isComplete) {
    return <ThankYou />;
  }

  const containerClass =
    currentStep === 0
      ? 'relative w-screen min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50'
      : 'relative w-full min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50';

  const innerClass =
    currentStep === 0
      ? 'relative w-screen mx-auto px-0 pt-0 pb-8 space-y-6 sm:space-y-12'
      : 'relative w-full mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 sm:py-12 lg:py-16 pb-8 space-y-6 sm:space-y-12';

  return (
    <div className={containerClass}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(14,165,233,0.08),transparent),radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(99,102,241,0.05),transparent),radial-gradient(ellipse_40%_30%_at_0%_80%,rgba(16,185,129,0.04),transparent)] pointer-events-none" aria-hidden />

      {showDraftRestored && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-fadeIn">
          <div className="bg-emerald-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">Your progress has been restored!</span>
          </div>
        </div>
      )}

      {submitError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-fadeIn">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Submission Failed</h3>
                <p className="text-sm text-slate-600">After {MAX_RETRIES} attempts</p>
              </div>
            </div>
            <p className="text-slate-700 mb-6">{submitError}</p>
            <div className="flex gap-3">
              <button
                onClick={handleDismissError}
                className="flex-1 px-4 py-3 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-xl transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={handleStartOver}
                className="px-4 py-3 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
              >
                Start Over
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={innerClass}>
        {currentStep === 0 ? (
          <HeroSection
            renderForm={
              <SectionCard
                surface="frosted"
                padding="lg"
                className="max-w-4xl mx-auto"
              >
                <ServiceSelection onSubmit={handleServiceAndZip} initialData={formData} />
              </SectionCard>
            }
          />
        ) : (
          <div ref={formShellRef} className="space-y-6">
            <SectionCard
              surface="frosted"
              padding="lg"
              className="max-w-4xl mx-auto"
            >
              {currentStep > 0 && !isComplete && (
                <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={persistDrafts}
                      onChange={(e) => handlePersistToggle(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500"
                    />
                    Save progress on this device (encrypted, clears after 12h)
                  </label>
                  <button
                    type="button"
                    onClick={() => handlePersistToggle(false)}
                    className="text-xs font-semibold text-slate-600 underline underline-offset-4 hover:text-slate-800"
                  >
                    Clear saved progress
                  </button>
                </div>
              )}

              {currentStep > 0 && currentStep <= questions.length && (
                <QuestionStep
                  question={questions[currentStep - 1]}
                  answer={formData.responses[questions[currentStep - 1].id]}
                  onAnswer={handleAnswer}
                  onNext={handleNext}
                  onBack={handleBack}
                  currentStep={currentStep}
                  totalSteps={totalSteps}
                />
              )}

              {currentStep === questions.length + 1 && (
                <PhotoUpload
                  onSubmit={handlePhotos}
                  onBack={handleBack}
                  onNext={handleNext}
                  currentStep={currentStep}
                  totalSteps={totalSteps}
                />
              )}

              {currentStep === questions.length + 2 && (
                <ContactInfo
                  onSubmit={handleContactInfo}
                  onBack={handleBack}
                  isSubmitting={isSubmitting}
                  retryCount={retryCount}
                  currentStep={currentStep}
                  totalSteps={totalSteps}
                />
              )}
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  );
}
