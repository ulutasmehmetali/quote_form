import { useEffect, useMemo, useRef, useState } from 'react';
import type { ServiceType, QuoteFormData, QuestionConfig, QuestionAnswer } from '../types/quote';
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
    () => formData.serviceType ? SERVICE_QUESTIONS[formData.serviceType as ServiceType] : [],
    [formData.serviceType]
  );

  const totalSteps = formData.serviceType ? questions.length + 2 : 1;
  const isWizardActive = currentStep > 0 && !isComplete;
  const formShellRef = useRef<HTMLDivElement | null>(null);

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

  const handlePhotos = (photos: File[]) => {
    setFormData({ ...formData, photos });
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
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
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
    const offset = window.innerHeight * 0.15;
    const target = Math.max(top + currentScroll - offset, 0);

    window.scrollTo({ top: target, behavior: 'smooth' });
  }, [currentStep, isComplete]);

  if (isComplete) {
    return <ThankYou />;
  }

  return (
    <div className="relative w-full min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(14,165,233,0.08),transparent),radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(99,102,241,0.05),transparent),radial-gradient(ellipse_40%_30%_at_0%_80%,rgba(16,185,129,0.04),transparent)] pointer-events-none" aria-hidden />

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
