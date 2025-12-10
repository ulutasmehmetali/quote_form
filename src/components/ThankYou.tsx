import { useEffect, useState } from 'react';
import SectionCard from './SectionCard';
import Button from './Button';

interface ConfettiPiece {
  id: number;
  left: number;
  color: string;
  delay: number;
  duration: number;
  size: number;
}

function Confetti() {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    const colors = ['#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];
    const newPieces: ConfettiPiece[] = [];
    
    for (let i = 0; i < 50; i++) {
      newPieces.push({
        id: i,
        left: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.5,
        duration: 2 + Math.random() * 2,
        size: 6 + Math.random() * 8,
      });
    }
    setPieces(newPieces);

    const timer = setTimeout(() => setPieces([]), 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="confetti"
          style={{
            left: `${piece.left}%`,
            backgroundColor: piece.color,
            width: piece.size,
            height: piece.size,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
          }}
        />
      ))}
    </>
  );
}

function AnimatedCheckmark() {
  return (
    <div className="relative animate-bounce-in">
      <div className="absolute -inset-4 bg-gradient-to-r from-emerald-200/50 to-sky-200/50 rounded-full blur-2xl opacity-60 animate-pulse"></div>
      <div className="relative inline-flex items-center justify-center w-28 h-28 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-2xl shadow-emerald-500/30 animate-glow">
        <svg className="w-14 h-14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
          <path 
            className="animate-check-draw" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M5 13l4 4L19 7" 
          />
        </svg>
      </div>
    </div>
  );
}

function StepCard({ number, title, description, delay }: { number: number; title: string; description: string; delay: number }) {
  return (
    <div
      className="flex gap-3 p-3 rounded-2xl bg-white border border-slate-100 shadow-sm transition-all duration-300 animate-fadeUp"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white flex items-center justify-center font-bold text-base shadow-md shadow-sky-500/20">
        {number}
      </div>
      <div className="text-left">
        <h3 className="font-semibold text-slate-800 text-[13px]">{title}</h3>
        <p className="text-slate-600 text-[11px] mt-0.5 leading-tight">{description}</p>
      </div>
    </div>
  );
}

export default function ThankYou() {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-6 lg:py-10 bg-gradient-to-br from-slate-50 via-white to-emerald-50 overflow-hidden">
      <Confetti />
      
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,rgba(16,185,129,0.08),transparent)]" aria-hidden />

      <SectionCard
        surface="frosted"
        padding="md"
        className="relative max-w-md w-full flex flex-col gap-6 text-center"
        style={{ maxHeight: 'calc(100vh - 3rem)' }}
      >
        {showContent && (
          <>
            <div className="flex flex-col gap-5 flex-1 items-center justify-center w-full">
              <AnimatedCheckmark />

              <div className="space-y-4 animate-fadeUp" style={{ animationDelay: '0.2s' }}>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-sm font-semibold text-emerald-700 uppercase tracking-wider">Request Confirmed</span>
                </div>
                
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-800 leading-tight">
                  You're All Set!
                </h1>
                
                <p className="text-slate-600 text-lg lg:text-xl max-w-lg mx-auto leading-relaxed">
                  Your request has been sent to our network of verified professionals.
                </p>
              </div>

              <div className="bg-gradient-to-br from-slate-50 to-white rounded-3xl p-5 border border-slate-200 space-y-3 w-full">
                <h2 className="text-lg font-bold text-slate-800 flex items-center justify-center gap-2">
                  <svg className="w-6 h-6 text-sky-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  What Happens Next
                </h2>
                
                <div className="space-y-2">
                  <StepCard 
                    number={1}
                    title="Review Your Request"
                    description="Our team is matching you with the best local professionals."
                    delay={0.4}
                  />
                  <StepCard 
                    number={2}
                    title="Get Contacted"
                    description="Expect calls or emails from up to 4 verified pros within 24 hours."
                    delay={0.5}
                  />
                  <StepCard 
                    number={3}
                    title="Compare & Choose"
                    description="Review quotes, check reviews, and pick your perfect match."
                    delay={0.6}
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 animate-fadeUp w-full" style={{ animationDelay: '0.7s' }}>
              <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-3">
                <Button
                  size="lg"
                  onClick={() => (window.location.href = '/')}
                  className="sm:w-auto w-full"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Submit Another Request
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => (window.location.href = '/')}
                  className="sm:w-auto w-full"
                >
                  Back to Home
                </Button>
              </div>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
