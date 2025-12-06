import type { SVGProps } from 'react';
import { cn } from '../../lib/cn';

export default function ArrowRightIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M13 7l5 5-5 5" />
      <path d="M6 12h11" />
    </svg>
  );
}
