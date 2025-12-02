import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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

const GOOGLE_SHEET_ENDPOINT = 'https://script.google.com/macros/s/AKfycby6Q-m6fOcNrCwwe8cyuG4cIL_JSbEgnnEvrTUcO8l1HFA_XFabECXZCjF1NUrP2XWFsg/exec';
const STORAGE_KEY = 'miyomint_form_draft';
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

interface SavedFormState {
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showDraftRestored, setShowDraftRestored] = useState(false);

  const questions = useMemo(
    () => formData.serviceType ? SERVICE_QUESTIONS[formData.serviceType as ServiceType] : [],
    [formData.serviceType]
  );

  const totalSteps = formData.serviceType ? questions.length + 2 : 1;
  const isWizardActive = currentStep > 0 && !isComplete;
  const formShellRef = useRef<HTMLDivElement | null>(null);

  const saveToStorage = useCallback((data: QuoteFormData, step: number) => {
    try {
      const { uploadedPhotos, ...dataWithoutPhotos } = data;
      const state: SavedFormState = {
        formData: dataWithoutPhotos,
        currentStep: step,
        savedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Could not save form draft:', e);
    }
  }, []);

  const clearStorage = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Could not clear form draft:', e);
    }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const state: SavedFormState = JSON.parse(saved);
        const hoursSinceSave = (Date.now() - state.savedAt) / (1000 * 60 * 60);
        if (hoursSinceSave < 24 && state.formData.serviceType) {
          setFormData({ ...state.formData, uploadedPhotos: undefined });
          setCurrentStep(state.currentStep);
          setShowDraftRestored(true);
          setTimeout(() => setShowDraftRestored(false), 4000);
        } else {
          clearStorage();
        }
      }
    } catch (e) {
      console.warn('Could not restore form draft:', e);
      clearStorage();
    }
  }, [clearStorage]);

  useEffect(() => {
    const photoStep = questions.length + 1;
    if (formData.serviceType && currentStep > 0 && currentStep < photoStep) {
      saveToStorage(formData, currentStep);
    }
  }, [formData, currentStep, saveToStorage, questions.length]);

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

  const handleNext = () => {
    setCurrentStep((prev) => prev + 1);
  };

  const handlePhotos = (uploadedPhotos: UploadedPhoto[]) => {
    setFormData({ ...formData, uploadedPhotos });
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

    const sheetPayload = {
      name,
      email,
      phone,
      serviceType: formData.serviceType,
      zipCode: formData.zipCode,
      responses: formData.responses,
      answers: buildAnswerRows(),
      responseSummary: buildAnswerRows()
        .map((row) => `${row.question}: ${row.answer || 'n/a'}`)
        .join(' | '),
      photos: formData.uploadedPhotos?.map(p => p.url) || [],
      photoCount: formData.uploadedPhotos?.length || 0,
      submittedAt: new Date().toISOString(),
      submittedAtLocal: new Date().toLocaleString(),
    };

    const dbPayload = {
      name,
      email,
      phone,
      serviceType: formData.serviceType,
      zipCode: formData.zipCode,
      answers: formData.responses,
      photoUrls: formData.uploadedPhotos?.map(p => p.url) || [],
    };

    try {
      const submitEndpoint = import.meta.env.VITE_SUBMIT_URL || '/api/submit';

      const results = await Promise.allSettled([
        submitWithRetry(sheetPayload),
        fetch(submitEndpoint, {
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
      
      clearStorage();
      setIsComplete(true);
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
    clearStorage();
    setFormData({ serviceType: '', zipCode: '', responses: {} });
    setCurrentStep(0);
    setIsComplete(false);
    setSubmitError(null);
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

  if (isComplete) {
    return <ThankYou />;
  }

  return (
    <div className="relative w-full min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50">
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

      <div className="relative w-full mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 sm:py-12 lg:py-16 pb-8 space-y-6 sm:space-y-12">
        {currentStep === 0 && (
          <HeroSection />
        )}

        <div ref={formShellRef} className="space-y-6">
          {isWizardActive && (
            <div className="sticky top-4 z-20 py-4">
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-slate-200 p-4 shadow-lg">
                <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />
              </div>
            </div>
          )}

          <SectionCard
            surface="frosted"
            padding="lg"
            className="max-w-4xl mx-auto"
          >
            {currentStep === 0 && (
              <ServiceSelection onSubmit={handleServiceAndZip} initialData={formData} />
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
      </div>
    </div>
  );
}
