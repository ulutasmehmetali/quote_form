import type { ReactNode, ElementType, CSSProperties } from 'react';
import { cn } from '../lib/cn';

type Surface = 'default' | 'frosted' | 'muted';
type Padding = 'none' | 'sm' | 'md' | 'lg';

interface SectionCardProps {
  children: ReactNode;
  className?: string;
  surface?: Surface;
  padding?: Padding;
  as?: ElementType;
  style?: CSSProperties;
}

const surfaceStyles: Record<Surface, string> = {
  default: 'bg-transparent',
  frosted:
    'bg-white/80 border border-slate-200 rounded-3xl backdrop-blur-xl shadow-xl shadow-slate-200/50',
  muted: 'bg-slate-50 border border-slate-200 rounded-3xl',
};

const paddingScale: Record<Padding, string> = {
  none: '',
  sm: 'p-4 sm:p-6',
  md: 'p-5 sm:p-7 md:p-8',
  lg: 'p-6 sm:p-8 md:p-10',
};

export default function SectionCard({
  children,
  className,
  surface = 'default',
  padding = 'none',
  as: Tag = 'section',
  style,
}: SectionCardProps) {
  return (
    <Tag
      className={cn(
        'block w-full',
        surfaceStyles[surface],
        paddingScale[padding],
        className
      )}
      style={style}
    >
      {children}
    </Tag>
  );
}
