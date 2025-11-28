import { useState, type ChangeEvent, type FormEvent } from 'react';
import Button from './Button';

interface ContactInfoProps {
  onSubmit: (name: string, email: string, phone: string) => void;
  onBack: () => void;
  isSubmitting: boolean;
  currentStep?: number;
  totalSteps?: number;
}

export default function ContactInfo({ onSubmit, onBack, isSubmitting, currentStep, totalSteps }: ContactInfoProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneNumber(event.target.value));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!email.trim() || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (phone.replace(/\D/g, '').length !== 10) {
      setError('Please enter a 10 digit phone number.');
      return;
    }

    onSubmit(name.trim(), email.trim(), phone);
  };

  const progressPercentage = currentStep && totalSteps ? Math.round((currentStep / totalSteps) * 100) : 100;
  const stepLabel = currentStep && totalSteps ? `Step ${currentStep} of ${totalSteps}` : 'Step 3 of 3';

  return (
    <section className="animate-slideInRight">
      <div className="max-w-2xl mx-auto">
        <div className="space-y-4">
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-600">{stepLabel}</span>
              <span className="text-xs font-medium text-slate-600">{progressPercentage}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-sky-500 to-indigo-600 rounded-full transition-all duration-300" style={{width: `${progressPercentage}%`}}></div>
            </div>
          </div>

          <div className="text-center lg:text-left space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Almost there!</h2>
            <p className="text-slate-600 text-sm">
              Enter your contact details and we'll connect you with certified professionals in your area.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="name" className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <svg className="h-4 w-4 text-sky-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Smith"
                autoComplete="name"
                className="w-full px-4 py-3 rounded-2xl bg-white text-slate-900 text-base font-medium placeholder:text-slate-400 border-2 border-slate-200 focus:border-sky-400 focus:outline-none shadow-sm transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="email" className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <svg className="h-4 w-4 text-sky-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  list="email-domains"
                  className="w-full px-4 py-3 rounded-2xl bg-white text-slate-900 text-base font-medium placeholder:text-slate-400 border-2 border-slate-200 focus:border-sky-400 focus:outline-none shadow-sm transition-all"
                />
                <datalist id="email-domains">
                  <option value={email.split('@')[0] + '@gmail.com'} />
                  <option value={email.split('@')[0] + '@yahoo.com'} />
                  <option value={email.split('@')[0] + '@outlook.com'} />
                  <option value={email.split('@')[0] + '@hotmail.com'} />
                  <option value={email.split('@')[0] + '@icloud.com'} />
                </datalist>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="phone" className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <svg className="h-4 w-4 text-sky-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                  </svg>
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="555-123-4567"
                  autoComplete="tel"
                  className="w-full px-4 py-3 rounded-2xl bg-white text-slate-900 text-base font-medium placeholder:text-slate-400 border-2 border-slate-200 focus:border-sky-400 focus:outline-none shadow-sm transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2" role="alert" aria-live="polite">
                <svg className="h-4 w-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4m0 4h.01" />
                </svg>
                <p>{error}</p>
              </div>
            )}

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-2">
              <svg className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="text-xs text-emerald-800 leading-snug">
                Your information is encrypted and secure. We'll connect you with up to four trusted, verified professionals. Your details are never sold.
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-1">
              <Button
                type="button"
                onClick={onBack}
                disabled={isSubmitting}
                variant="secondary"
                size="lg"
                className="flex-1 h-12 text-base"
              >
                ← Back
              </Button>
              <Button
                type="submit"
                isLoading={isSubmitting}
                className="flex-1 h-12 text-base"
                size="lg"
              >
                Get My Free Quotes →
              </Button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
