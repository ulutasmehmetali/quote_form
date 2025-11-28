interface ProgressBarProps {
  progress: number;
  currentStep: number;
  totalSteps: number;
}

export default function ProgressBar({ progress, currentStep, totalSteps }: ProgressBarProps) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 sm:px-5 sm:py-4 shadow-sm shadow-slate-900/10">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs sm:text-sm font-semibold text-slate-100">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-xs sm:text-sm font-semibold text-emerald-300">
          {Math.round(progress)}% Complete
        </span>
      </div>
      <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-sky-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
}
