interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
}

export function Skeleton({ className = '', variant = 'text' }: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-slate-200';
  
  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-lg',
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`} />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton variant="circular" className="w-12 h-12" />
        <div className="flex-1 space-y-2">
          <Skeleton className="w-3/4 h-4" />
          <Skeleton className="w-1/2 h-3" />
        </div>
      </div>
      <Skeleton className="w-full h-20" variant="rounded" />
      <div className="flex gap-2">
        <Skeleton className="w-16 h-6" variant="rounded" />
        <Skeleton className="w-16 h-6" variant="rounded" />
        <Skeleton className="w-16 h-6" variant="rounded" />
      </div>
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-4 px-4">
        <Skeleton className="w-8 h-4" />
      </td>
      <td className="py-4 px-4">
        <Skeleton className="w-32 h-4" />
      </td>
      <td className="py-4 px-4">
        <Skeleton className="w-24 h-4" />
      </td>
      <td className="py-4 px-4">
        <Skeleton className="w-40 h-4" />
      </td>
      <td className="py-4 px-4">
        <Skeleton className="w-20 h-6" variant="rounded" />
      </td>
      <td className="py-4 px-4">
        <Skeleton className="w-24 h-4" />
      </td>
    </tr>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-slate-800/50 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton variant="rounded" className="w-12 h-12 !bg-slate-700" />
              <div className="text-right space-y-2">
                <Skeleton className="w-16 h-8 !bg-slate-700" />
                <Skeleton className="w-20 h-3 !bg-slate-700" />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 rounded-2xl p-6 space-y-4">
          <Skeleton className="w-40 h-6 !bg-slate-700" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="w-full h-8 !bg-slate-700" variant="rounded" />
            ))}
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-2xl p-6 space-y-4">
          <Skeleton className="w-40 h-6 !bg-slate-700" />
          <Skeleton className="w-full h-48 !bg-slate-700" variant="rounded" />
        </div>
      </div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <Skeleton className="w-48 h-8 mx-auto" />
        <Skeleton className="w-64 h-4 mx-auto" />
      </div>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="w-24 h-4" />
          <Skeleton className="w-full h-12" variant="rounded" />
        </div>
        <div className="space-y-2">
          <Skeleton className="w-24 h-4" />
          <Skeleton className="w-full h-12" variant="rounded" />
        </div>
        <div className="space-y-2">
          <Skeleton className="w-24 h-4" />
          <Skeleton className="w-full h-32" variant="rounded" />
        </div>
      </div>
      
      <Skeleton className="w-full h-12" variant="rounded" />
    </div>
  );
}
