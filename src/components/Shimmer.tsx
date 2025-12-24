import { cn } from '../lib/cn';

interface ShimmerProps {
  className?: string;
  width?: string;
  height?: string;
}

export function Shimmer({ className, width = 'w-full', height = 'h-4' }: ShimmerProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg bg-slate-200',
        width,
        height,
        className
      )}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

export function ShimmerCard({ className }: { className?: string }) {
  return (
    <div className={cn('p-4 rounded-2xl border border-slate-200 bg-white space-y-3', className)}>
      <Shimmer height="h-6" width="w-3/4" />
      <Shimmer height="h-4" width="w-full" />
      <Shimmer height="h-4" width="w-2/3" />
    </div>
  );
}

export function ShimmerServiceCard() {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white">
      <Shimmer className="rounded-xl" width="w-12" height="h-12" />
      <div className="flex-1 space-y-2">
        <Shimmer height="h-4" width="w-24" />
        <Shimmer height="h-3" width="w-full" />
      </div>
    </div>
  );
}

export function ShimmerSuggestions() {
  return (
    <div className="space-y-3 animate-fadeIn">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-5 h-5 rounded-full bg-sky-100 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-sky-400 animate-pulse" />
        </div>
        <Shimmer height="h-4" width="w-32" />
      </div>
      <ShimmerServiceCard />
      <ShimmerServiceCard />
      <ShimmerServiceCard />
    </div>
  );
}

export function ShimmerText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Shimmer
          key={i}
          height="h-3"
          width={i === lines - 1 ? 'w-2/3' : 'w-full'}
        />
      ))}
    </div>
  );
}

export default Shimmer;
