import SectionCard from './SectionCard';
import Button from './Button';

export default function ThankYou() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-slate-50 via-white to-emerald-50"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,rgba(16,185,129,0.08),transparent)]" aria-hidden />

      <SectionCard
        surface="frosted"
        padding="lg"
        className="relative max-w-xl w-full text-center space-y-6 sm:space-y-8 animate-fadeIn"
      >
        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-to-r from-emerald-200/50 to-sky-200/50 rounded-full blur-2xl opacity-60"></div>
          <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-2xl shadow-emerald-200">
            <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Request Received</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-800">Thank You!</h1>
          <p className="text-slate-600 text-base sm:text-lg lg:text-xl max-w-md mx-auto leading-relaxed">
            Your request has been submitted successfully.
          </p>
          <div className="bg-slate-50 rounded-2xl p-4 sm:p-6 border border-slate-200 max-w-md mx-auto">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="text-3xl">📞</div>
              <h2 className="text-xl font-bold text-slate-800">What's Next?</h2>
            </div>
            <p className="text-slate-600 text-base">
              Certified local professionals will contact you within 24 hours to discuss your project and provide quotes.
            </p>
          </div>
        </div>

        <div className="pt-4 space-y-4">
          <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
          <Button
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => window.location.reload()}
          >
            Submit Another Request
            <svg className="h-5 w-5 ml-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
