import { useEffect, useMemo, useRef, useState } from 'react';
import type { ServiceType, QuoteFormData, QuestionConfig } from '../types/quote';
import { SERVICE_QUESTIONS } from '../types/quote';
import ServiceSelection from './ServiceSelection';
import QuestionStep from './QuestionStep';
import ContactInfo from './ContactInfo';
import ProgressBar from './ProgressBar';
import ThankYou from './ThankYou';
import SectionCard from './SectionCard';

const GOOGLE_SHEET_ENDPOINT =
  'https://script.google.com/macros/s/AKfycby6Q-m6fOcNrCwwe8cyuG4cIL_JSbEgnnEvrTUcO8l1HFA_XFabECXZCjF1NUrP2XWFsg/exec';

export default function QuoteForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<QuoteFormData>({
    serviceType: '',
    zipCode: '',
    responses: {},
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const questions = useMemo(
    () =>
      formData.serviceType
        ? SERVICE_QUESTIONS[formData.serviceType as ServiceType]
        : [],
    [formData.serviceType]
  );

  // totalSteps includes: 1) initial selection, 2) all questions, 3) contact info
  const totalSteps = formData.serviceType ? questions.length + 2 : 1;
  const progress = ((currentStep + 1) / totalSteps) * 100;
  const isWizardActive = currentStep > 0 && !isComplete;
  const formShellRef = useRef<HTMLDivElement | null>(null);

  const handleServiceAndZip = (serviceType: ServiceType, zipCode: string) => {
    setFormData({ ...formData, serviceType, zipCode });
    setTimeout(() => setCurrentStep(1), 220);
  };

  const handleAnswer = (questionId: string, answer: any) => {
    setFormData({
      ...formData,
      responses: { ...formData.responses, [questionId]: answer },
    });
  };

  const handleNext = () => {
    setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const formatAnswerForSheet = (answer: unknown) => {
    if (Array.isArray(answer)) {
      return answer.join(', ');
    }
    if (typeof answer === 'object' && answer !== null) {
      return JSON.stringify(answer);
    }
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

  const handleContactInfo = async (name: string, email: string, phone: string) => {
    setIsSubmitting(true);
    try {
      const payload = {
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
        submittedAt: new Date().toISOString(),
        submittedAtLocal: new Date().toLocaleString(),
      };

      const response = await fetch(GOOGLE_SHEET_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Sheets sync failed with status ${response.status}`);
      }

      setIsComplete(true);
    } catch (error) {
      console.error('Error submitting quote:', error);
      alert('There was an error submitting your quote. Please try again in a moment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (isComplete || currentStep === 0) return;
    const section = formShellRef.current;
    if (!section) return;

    const { top } = section.getBoundingClientRect();
    const currentScroll = window.scrollY || document.documentElement.scrollTop;
    const offset = window.innerHeight * 0.18; // give breathing room so hero/title stay visible
    const target = Math.max(top + currentScroll - offset, 0);

    window.scrollTo({
      top: target,
      behavior: 'smooth',
    });
  }, [currentStep, isComplete]);

  const heroHighlights = useMemo(
    () => [
      {
        label: 'Pre-vetted pros',
        desc: 'Hand-selected, background checked crews',
        iconColor: 'text-emerald-300',
        icon: (
          <svg viewBox="0 0 24 24" className="w-7 h-7">
            <path
              d="M12 4.5 6 6.8v4.9c0 3.4 2.5 6.6 6 7.8 3.5-1.2 6-4.4 6-7.8V6.8L12 4.5Z"
              stroke="currentColor"
              strokeWidth="1.6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M9.5 12.2 11 14l3.5-3.8"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
      {
        label: 'Fast, secure quotes',
        desc: 'Share details once, get curated bids',
        iconColor: 'text-sky-300',
        icon: (
          <svg viewBox="0 0 24 24" className="w-7 h-7">
            <path
              d="M5 12h6l-2 6 10-10h-6l2-6-10 10Z"
              stroke="currentColor"
              strokeWidth="1.6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
      {
        label: 'Local specialists',
        desc: 'Certified technicians in your ZIP',
        iconColor: 'text-lime-300',
        icon: (
          <svg viewBox="0 0 24 24" className="w-7 h-7">
            <path
              d="M12 3.5a5.5 5.5 0 0 0-5.5 5.5c0 4.1 4.9 9.7 5.2 10l.3.3.3-.3c.3-.3 5.2-5.9 5.2-10A5.5 5.5 0 0 0 12 3.5Z"
              stroke="currentColor"
              strokeWidth="1.6"
              fill="none"
            />
            <circle cx="12" cy="9.5" r="2.4" stroke="currentColor" strokeWidth="1.6" fill="none" />
          </svg>
        ),
      },
    ],
    []
  );

  if (isComplete) {
    return <ThankYou />;
  }

  return (
    <div
      className="min-h-screen bg-slate-900 text-white relative overflow-hidden"
      style={{
        backgroundImage:
          'linear-gradient(135deg, rgba(8,19,40,0.78) 0%, rgba(6,30,52,0.6) 50%, rgba(8,19,40,0.85) 100%), url(/hero-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/35 via-slate-900/25 to-slate-900/55 pointer-events-none" />
      <div className="absolute -top-32 -left-32 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
      <div className="absolute -bottom-20 -right-10 h-60 w-60 rounded-full bg-emerald-400/15 blur-3xl" />
      <div className="relative max-w-5xl mx-auto px-4 py-10 space-y-8">
        <section className="text-center mb-8 space-y-6">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.6em] text-emerald-200">Trusted by homeowners</p>
            <h1 className="text-3xl md:text-4xl font-black leading-tight drop-shadow-sm">
              Connect with trusted & certified technicians
            </h1>
            <p className="text-slate-200 text-base md:text-lg max-w-2xl mx-auto">
              Tell us what you need and we'll match you with vetted pros in minutes - no spam, just reliable home-service experts.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left text-white/90">
            {heroHighlights.map(({ label, desc, icon, iconColor }) => (
              <article
                key={label}
                className="flex items-start gap-3 px-4 py-3 rounded-2xl border border-white/10 bg-white/10 shadow-lg shadow-slate-900/40 backdrop-blur-sm"
              >
                <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/12 border border-white/20 shadow-inner shadow-slate-900/40">
                  <span className={`flex items-center justify-center ${iconColor}`}>
                    {icon}
                  </span>
                </span>
                <div className="space-y-1">
                  <p className="font-semibold text-sm">{label}</p>
                  <p className="text-xs text-white/70">{desc}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div ref={formShellRef}>
          <SectionCard
            surface="frosted"
            padding="lg"
            className="shadow-2xl border-white/40 overflow-hidden p-0"
          >
            {isWizardActive && (
              <ProgressBar progress={progress} currentStep={currentStep + 1} totalSteps={totalSteps} />
            )}

            <div className="w-full px-5 sm:px-6 md:px-8 lg:px-10 py-6 md:py-8 space-y-6">
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
                />
              )}

              {currentStep === questions.length + 1 && (
                <ContactInfo
                  onSubmit={handleContactInfo}
                  onBack={handleBack}
                  isSubmitting={isSubmitting}
                />
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}




