interface Step {
  number: number;
  label: string;
  isActive: boolean;
  isComplete: boolean;
}

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export default function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  const steps: Step[] = [
    { number: 1, label: 'Service', isActive: currentStep === 0, isComplete: currentStep > 0 },
    { number: 2, label: 'Details', isActive: currentStep > 0 && currentStep < totalSteps - 1, isComplete: currentStep >= totalSteps - 1 },
    { number: 3, label: 'Contact', isActive: currentStep === totalSteps - 1, isComplete: false },
  ];

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4">
      {steps.map((step, index) => (
        <div key={step.number} className="flex items-center">
          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className={`
                flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl font-bold text-sm transition-all duration-300
                ${step.isComplete
                  ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                  : step.isActive
                    ? 'bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-sky-500/30 ring-2 ring-sky-400/50 ring-offset-2 ring-offset-white'
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                }
              `}
            >
              {step.isComplete ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                step.number
              )}
            </div>
            <span
              className={`text-sm font-medium hidden sm:block transition-colors ${
                step.isActive || step.isComplete ? 'text-slate-800' : 'text-slate-400'
              }`}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`w-8 sm:w-12 h-0.5 mx-2 sm:mx-3 rounded-full transition-colors ${
                step.isComplete ? 'bg-emerald-400' : 'bg-slate-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
