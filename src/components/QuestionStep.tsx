import { useEffect, useRef, useState } from 'react';
import type { QuestionConfig, QuestionAnswer } from '../types/quote';
import Button from './Button';
import ArrowLeftIcon from './icons/ArrowLeft';
import ArrowRightIcon from './icons/ArrowRight';

interface QuestionStepProps {
  question: QuestionConfig;
  answer: QuestionAnswer;
  onAnswer: (questionId: string, answer: QuestionAnswer) => void;
  onNext: () => void;
  onBack: () => void;
  currentStep?: number;
  totalSteps?: number;
}

export default function QuestionStep({ question, answer, onAnswer, onNext, onBack, currentStep, totalSteps }: QuestionStepProps) {
  const [localAnswer, setLocalAnswer] = useState<string | string[]>(
    answer || (question.type === 'multiselect' ? [] : '')
  );
  const [error, setError] = useState('');
  const nextButtonRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLocalAnswer(answer || (question.type === 'multiselect' ? [] : ''));
  }, [question.id, answer, question.type]);

  useEffect(() => {
    const hasChoiceAnswer =
      (question.type === 'choice' && Boolean(localAnswer)) ||
      (question.type === 'multiselect' && Array.isArray(localAnswer) && localAnswer.length > 0);
    if (hasChoiceAnswer && nextButtonRef.current) {
      nextButtonRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [localAnswer, question.type]);

  const handleNext = () => {
    setError('');

    if (question.required && !localAnswer) {
      setError('This question is required');
      return;
    }

    if (question.type === 'multiselect' && question.required && Array.isArray(localAnswer) && localAnswer.length === 0) {
      setError('Please select at least one option');
      return;
    }

    onAnswer(question.id, localAnswer);
    onNext();
  };

  const handleChoiceClick = (option: string) => {
    setLocalAnswer(option);
  };

  const handleMultiSelectToggle = (option: string) => {
    const currentSelections = Array.isArray(localAnswer) ? localAnswer : [];
    if (currentSelections.includes(option)) {
      setLocalAnswer(currentSelections.filter((item: string) => item !== option));
    } else {
      setLocalAnswer([...currentSelections, option]);
    }
  };

  const progressPercentage = currentStep && totalSteps ? Math.round((currentStep / totalSteps) * 100) : 66;
  const stepLabel = currentStep && totalSteps ? `Step ${currentStep} of ${totalSteps}` : 'Step 2 of 3';

  return (
    <div className="animate-slideInRight w-full max-w-3xl mx-auto space-y-4 sm:space-y-6">
      <div className="mb-3 sm:mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-600">{stepLabel}</span>
          <span className="text-xs font-medium text-slate-600">{progressPercentage}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-sky-500 to-indigo-600 rounded-full transition-all duration-300" style={{width: `${progressPercentage}%`}}></div>
        </div>
      </div>

      <div className="text-center space-y-2">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-800 leading-tight">
          {question.question}
        </h2>
      </div>

      <div className="space-y-2.5 sm:space-y-3">
        {question.type === 'choice' && question.options && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            {question.options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleChoiceClick(option)}
                className={`group relative flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
                  localAnswer === option
                    ? 'border-sky-400 bg-sky-50 shadow-lg shadow-sky-100'
                    : 'border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/50'
                }`}
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all ${
                    localAnswer === option
                      ? 'border-sky-400 bg-sky-500'
                      : 'border-slate-300 group-hover:border-sky-400'
                  }`}
                >
                  {localAnswer === option && (
                    <div className="h-2.5 w-2.5 rounded-full bg-white" />
                  )}
                </div>
                <span className="font-medium text-slate-800 text-base">{option}</span>
              </button>
            ))}
          </div>
        )}

        {question.type === 'multiselect' && question.options && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            {question.options.map((option) => {
              const isSelected = Array.isArray(localAnswer) && localAnswer.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleMultiSelectToggle(option)}
                  className={`group relative flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
                    isSelected
                      ? 'border-sky-400 bg-sky-50 shadow-lg shadow-sky-100'
                      : 'border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/50'
                  }`}
                >
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-sky-400 bg-sky-500'
                        : 'border-slate-300 group-hover:border-sky-400'
                    }`}
                  >
                    {isSelected && (
                      <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="font-medium text-slate-800 text-base">{option}</span>
                </button>
              );
            })}
          </div>
        )}

        {question.type === 'text' && (
          <textarea
            value={typeof localAnswer === 'string' ? localAnswer : ''}
            onChange={(e) => setLocalAnswer(e.target.value)}
            placeholder="Type your answer here..."
            rows={4}
            className="w-full resize-none rounded-2xl bg-white text-slate-900 px-4 py-3 text-base sm:text-lg font-medium placeholder:text-slate-400 border-2 border-slate-200 focus:border-sky-400 focus:outline-none shadow-sm transition-all"
            aria-label={question.question}
          />
        )}

        {question.type === 'date' && (
          <input
            type="date"
            value={typeof localAnswer === 'string' ? localAnswer : ''}
            onChange={(e) => setLocalAnswer(e.target.value)}
            className="w-full rounded-2xl bg-white text-slate-900 px-4 py-3 text-base sm:text-lg font-medium border-2 border-slate-200 focus:border-sky-400 focus:outline-none shadow-sm transition-all"
            aria-label={question.question}
          />
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2" role="alert" aria-live="polite">
          <svg className="h-4 w-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4m0 4h.01" />
          </svg>
          <p>{error}</p>
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 pt-1 sm:pt-2">
        <Button

          type="button"

          onClick={onBack}

          variant="secondary"

          size="lg"

          className="flex-1 h-12 text-base flex items-center justify-center gap-2"

        >

          <ArrowLeftIcon />

          Back

        </Button>

        <div ref={nextButtonRef} className="flex-1">

          <Button

            type="button"

            onClick={handleNext}

            size="lg"

            className="w-full h-12 text-base gap-2 justify-center"

          >

            <span>Continue</span>

            <ArrowRightIcon />

          </Button>

        </div>
      </div>
    </div>
  );
}
