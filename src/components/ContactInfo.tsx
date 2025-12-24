import { useState, type ChangeEvent, type FormEvent } from 'react';
import Button from './Button';
import ArrowLeftIcon from './icons/ArrowLeft';

interface ContactInfoProps {
  onSubmit: (name: string, email: string, phone: string) => void;
  onBack: () => void;
  isSubmitting: boolean;
  retryCount?: number;
  currentStep?: number;
  totalSteps?: number;
}

interface FieldState {
  touched: boolean;
  valid: boolean;
}

function ValidationIcon({ valid, touched }: { valid: boolean; touched: boolean }) {
  if (!touched) return null;
  
  if (valid) {
    return (
      <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-scale-in">
        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
    );
  }
  
  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-scale-in">
      <div className="w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center">
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    </div>
  );
}

export default function ContactInfo({ onSubmit, onBack, isSubmitting, retryCount = 0, currentStep, totalSteps }: ContactInfoProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  
  const [nameState, setNameState] = useState<FieldState>({ touched: false, valid: false });
  const [emailState, setEmailState] = useState<FieldState>({ touched: false, valid: false });
  const [phoneState, setPhoneState] = useState<FieldState>({ touched: false, valid: false });

  const validateName = (value: string) => value.trim().length >= 2;
  const validateEmail = (value: string) => /^[^@]+@[^@]+\.[^@]+$/.test(value);
  const validatePhone = (value: string) => value.replace(/\D/g, '').length === 10;

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    setNameState({ touched: value.length > 0, valid: validateName(value) });
  };

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setEmailState({ touched: value.length > 0, valid: validateEmail(value) });
  };

  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
    setPhoneState({ touched: formatted.length > 0, valid: validatePhone(formatted) });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError('');

    setNameState({ touched: true, valid: validateName(name) });
    setEmailState({ touched: true, valid: validateEmail(email) });
    setPhoneState({ touched: true, valid: validatePhone(phone) });

    if (!validateName(name)) {
      setError('Please enter your full name.');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!validatePhone(phone)) {
      setError('Please enter a 10 digit phone number.');
      return;
    }

    onSubmit(name.trim(), email.trim(), phone);
  };

  const progressPercentage = currentStep && totalSteps ? Math.round((currentStep / totalSteps) * 100) : 100;
  const stepLabel = currentStep && totalSteps ? `Step ${currentStep} of ${totalSteps}` : 'Step 3 of 3';
  
  const allValid = nameState.valid && emailState.valid && phoneState.valid;
  const filledCount = [nameState.valid, emailState.valid, phoneState.valid].filter(Boolean).length;

  const getInputClassName = (state: FieldState) => {
    const base = "w-full px-4 py-3 pr-12 rounded-2xl bg-white text-slate-900 text-base font-medium placeholder:text-slate-400 border-2 shadow-sm transition-all focus:outline-none";
    if (!state.touched) return `${base} border-slate-200 focus:border-sky-400`;
    if (state.valid) return `${base} border-emerald-400 focus:border-emerald-500`;
    return `${base} border-rose-400 focus:border-rose-500`;
  };

  return (
    <section className="animate-slideInRight pb-6">
      <div className="max-w-2xl mx-auto px-1">
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
              <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
                Step 3 · Complete the form and nearby pros will reach out soon
              </span>
            </div>
          </div>

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

          {filledCount > 0 && filledCount < 3 && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div 
                    key={i} 
                    className={`w-2 h-2 rounded-full transition-colors ${i < filledCount ? 'bg-emerald-500' : 'bg-slate-200'}`}
                  />
                ))}
              </div>
              <span>{filledCount}/3 fields completed</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="name" className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <svg className="h-4 w-4 text-sky-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Full Name
              </label>
              <div className="relative">
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={handleNameChange}
                  placeholder="John Smith"
                  autoComplete="name"
                  className={getInputClassName(nameState)}
                />
                <ValidationIcon valid={nameState.valid} touched={nameState.touched} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="email" className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <svg className="h-4 w-4 text-sky-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Email Address
                </label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={handleEmailChange}
                    placeholder="you@example.com"
                    autoComplete="off"
                    className={getInputClassName(emailState)}
                  />
                  <ValidationIcon valid={emailState.valid} touched={emailState.touched} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="phone" className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <svg className="h-4 w-4 text-sky-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                  </svg>
                  Phone Number
                </label>
                <div className="relative">
                  <input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="555-123-4567"
                    autoComplete="tel"
                    className={getInputClassName(phoneState)}
                  />
                  <ValidationIcon valid={phoneState.valid} touched={phoneState.touched} />
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2 animate-shake" role="alert" aria-live="polite">
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
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2 items-stretch">
              <Button
                type="submit"
                isLoading={isSubmitting}
                className={`w-full sm:flex-1 h-12 text-base rounded-2xl transition-all ${allValid ? 'animate-pulse-subtle' : ''}`}
                size="lg"
              >
                {isSubmitting ? 'Submitting...' : allValid ? 'Get My Free Quotes' : 'Complete All Fields'}
              </Button>
              <Button
                type="button"
                onClick={onBack}
                disabled={isSubmitting}
                variant="secondary"
                size="lg"
                className="w-full sm:flex-1 h-12 text-base flex items-center justify-center gap-2 rounded-2xl shadow-sm"
                icon={<ArrowLeftIcon className="h-4 w-4 text-slate-500" />}
              >
                Back
              </Button>
            </div>

          </form>
        </div>
      </div>
    </section>
  );
}
