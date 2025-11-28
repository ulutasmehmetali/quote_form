import type { ReactNode } from 'react';

interface LegalModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  open: boolean;
}

export default function LegalModal({ title, children, onClose, open }: LegalModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button
            aria-label="Close"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900 text-xl font-bold px-2"
          >
            &times;
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="prose max-w-none text-sm text-slate-800 space-y-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
