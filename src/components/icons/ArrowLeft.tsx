import type { SVGProps } from 'react';
import { cn } from '../../lib/cn';

export default function ArrowLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-5 w-5 shrink-0', props.className)}
      {...props}
    >
      <path d="M11 7l-5 5 5 5" />
      <path d="M18 12H7" />
    </svg>
  );
}
