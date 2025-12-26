import { type ReactNode, useState } from 'react';
import Button from './Button';
import plumberImg from '@assets/roofing services_1764316007803.webp';
import electricianImg from '@assets/electric_1764315995946.jpg';
import hvacImg from '@assets/hvac_1764316003781.jpg';
import contractorImg from '@assets/remodeling_1764316006112.webp';
import handymanImg from '@assets/handyman_1764336231412.jpg';
import fencingImg from '@assets/fencing_1764336234560.webp';
import garageDoorImg from '@assets/garage door repair_1764336236132.jpeg';
import flooringImg from '@assets/flooring_1764336237108.webp';
import drywallImg from '@assets/drywall_1764336241264.jpg';
import concreteImg from '@assets/concrete_1764336245562.webp';
import cleaningImg from '@assets/cleaning_1764336246728.jpg';
import carpentryImg from '@assets/carpentry_1764336248631.jpeg';
import remodelingImg from '@assets/remodeling_1764336249973.webp';
import roofingImg from '@assets/roofing services_1764336251048.webp';
import airConditionerImg from '@assets/air conditioner_1764336252466.webp';

const topRowServices = [
  { img: roofingImg, name: 'Roofing', color: 'bg-sky-500' },
  { img: electricianImg, name: 'Electrical', color: 'bg-amber-500' },
  { img: airConditionerImg, name: 'HVAC', color: 'bg-emerald-500' },
  { img: flooringImg, name: 'Flooring', color: 'bg-indigo-500' },
  { img: fencingImg, name: 'Fencing', color: 'bg-orange-500' },
  { img: drywallImg, name: 'Drywall', color: 'bg-purple-500' },
];

const bottomRowServices = [
  { img: remodelingImg, name: 'Remodeling', color: 'bg-rose-500' },
  { img: handymanImg, name: 'Handyman', color: 'bg-teal-500' },
  { img: garageDoorImg, name: 'Garage Door', color: 'bg-blue-500' },
  { img: cleaningImg, name: 'Cleaning', color: 'bg-lime-500' },
  { img: concreteImg, name: 'Concrete', color: 'bg-slate-500' },
  { img: carpentryImg, name: 'Carpentry', color: 'bg-amber-600' },
];

const trustBadges = [
  {
    label: 'Verified Pros',
    desc: 'Background checked',
    icon: (
      <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
      </svg>
    ),
  },
  {
    label: 'Fast Quotes',
    desc: 'Within hours',
    icon: (
      <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    label: 'Local Experts',
    desc: 'In your area',
    icon: (
      <svg className="w-6 h-6 text-sky-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
  },
];

const steps = [
  { title: 'Tell us your project', desc: 'Share the issue or pick a service to start' },
  { title: 'Enter your ZIP code', desc: "We'll match you with nearby certified pros" },
  { title: 'Finish the form', desc: 'Local pros will reach out shortly' },
];

const StepsStrip = ({ compact = false }: { compact?: boolean }) => {
  const containerClass = compact
    ? 'w-full space-y-2.5'
    : 'w-full grid grid-cols-1 md:grid-cols-3 gap-3.5 lg:gap-4';

  return (
    <div className={containerClass}>
      {steps.map((step, idx) => {
        const progress = `${Math.round(((idx + 1) / steps.length) * 100)}%`;
        const isCompact = compact;
        const cardBase = isCompact
          ? 'relative overflow-hidden rounded-xl border border-sky-100/80 bg-white/90 shadow-[0_10px_28px_rgba(15,23,42,0.08)] backdrop-blur-sm'
          : 'group relative overflow-hidden rounded-xl border border-sky-100/70 bg-white/90 shadow-[0_12px_30px_rgba(59,130,246,0.12)] backdrop-blur-sm';
        return (
          <div key={step.title} className={cardBase}>
            <div className="absolute inset-0 opacity-65 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.12),transparent_38%)]" />
            {isCompact && idx < steps.length - 1 && (
              <div className="absolute left-6 bottom-0 h-4 w-px bg-slate-200/90" />
            )}
            <div className={`relative ${isCompact ? 'flex items-start gap-3 p-3' : 'p-3 sm:p-3.5 space-y-2'}`}>
              <div className="flex-shrink-0">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-600 text-white shadow-md shadow-sky-500/15">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4 4 10-9" />
                  </svg>
                </div>
              </div>
              <div className={`${isCompact ? 'flex-1 space-y-1.5' : 'space-y-1.5 leading-snug'}`}>
                <div className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-full bg-sky-50 text-[10px] font-semibold uppercase tracking-wide text-sky-700 shadow-sm shadow-sky-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500" />
                  <span>{`Step ${idx + 1}`}</span>
                </div>
                <div className="space-y-0.5">
                  <p className={`${isCompact ? 'text-sm font-semibold' : 'text-sm font-semibold'} tracking-tight`}>{step.title}</p>
                  <p className={`${isCompact ? 'text-[11px] text-slate-600' : 'text-xs text-slate-600'}`}>{step.desc}</p>
                </div>
                <div className={`${isCompact ? 'h-1' : 'h-0.5'} rounded-full bg-slate-100 overflow-hidden`}>
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-600"
                    style={{ width: progress }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const scrollToServiceStep = () => {
  const target = document.getElementById('service-step');
  if (!target) return;
  const top = target.getBoundingClientRect().top + window.scrollY - 20;
  window.scrollTo({ top, behavior: 'smooth' });
};

interface HeroSectionProps {
  renderForm?: ReactNode;
}

export default function HeroSection({ renderForm }: HeroSectionProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModal, setAuthModal] = useState<{ open: boolean; mode: 'login' | 'signup' }>({ open: false, mode: 'login' });
  const [authForm, setAuthForm] = useState<{
    name: string;
    companyName: string;
    position: string;
    email: string;
    password: string;
    confirm: string;
    role: 'company' | 'pro';
  }>({
    name: '',
    companyName: '',
    position: '',
    email: '',
    password: '',
    confirm: '',
    role: 'company',
  });
  const [authStatus, setAuthStatus] = useState<{ loading: boolean; error: string; success: string }>({
    loading: false,
    error: '',
    success: '',
  });

  const openAuthModal = (mode: 'login' | 'signup') => {
    setMobileMenuOpen(false);
    setAuthModal({ open: true, mode });
    setAuthForm({
      name: '',
      companyName: '',
      position: '',
      email: '',
      password: '',
      confirm: '',
      role: 'company',
    });
    setAuthStatus({ loading: false, error: '', success: '' });
  };

  const closeAuthModal = () => setAuthModal({ open: false, mode: 'login' });
  const updateAuthForm = (field: keyof typeof authForm, value: string) =>
    setAuthForm((prev) => ({ ...prev, [field]: value }));

  const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{10,}$/;

  const password = authForm.password.trim();
  const confirm = authForm.confirm.trim();
  const email = authForm.email.trim();
  const name = authForm.name.trim();
  const companyName = authForm.companyName.trim();

  const passwordCriteriaMet = {
    length: password.length >= 10,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^\w\s]/.test(password),
  };
  const passwordStrengthPercent =
    (['length', 'upper', 'lower', 'number', 'symbol'].filter((key) => (passwordCriteriaMet as any)[key]).length / 5) *
    100;
  const showPasswordHint =
    authModal.mode === 'signup' && password.length >= 6 && !strongPassword.test(password);
  const passwordHint = showPasswordHint
    ? 'Password must be at least 10 characters and include uppercase, lowercase, number, and symbol.'
    : '';
  const confirmHint =
    authModal.mode === 'signup' && confirm && confirm !== password ? 'Passwords do not match.' : '';
  const missingRequired =
    authModal.mode === 'signup'
      ? !email || !password || !name || (authForm.role === 'company' && !companyName)
      : !email || !password;
  const submitDisabled =
    authStatus.loading || missingRequired || Boolean(passwordHint) || Boolean(confirmHint);

  const submitAuth = async () => {
    setAuthStatus({ loading: true, error: '', success: '' });

    try {
      const parseResponse = async (res: Response) => {
        const text = await res.text();
        try {
          return text ? JSON.parse(text) : {};
        } catch {
          return { raw: text };
        }
      };

      const res = await fetch(`/api/auth/${authModal.mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          role: authForm.role,
          email,
          password,
          name: authModal.mode === 'signup' ? name : undefined,
          companyName: authModal.mode === 'signup' && authForm.role === 'company' ? companyName : undefined,
          position: authModal.mode === 'signup' && authForm.role === 'company' ? position : undefined,
        }),
      });

      const data = await parseResponse(res);
      if (!res.ok) {
        throw new Error(data?.error || 'Something went wrong.');
      }

      setAuthStatus({ loading: false, error: '', success: authModal.mode === 'login' ? 'Logged in!' : 'Account created!' });
      setTimeout(() => closeAuthModal(), 900);
    } catch (err: any) {
      setAuthStatus({ loading: false, error: err?.message || 'Request failed.', success: '' });
    }
  };

  return (
    <section className="relative overflow-visible w-full px-0 py-0 -mt-14 md:-mt-22 lg:pt-16 lg:pb-16 bg-[url('/hero-bg-4.jpg')] bg-cover bg-center">
      <div className="absolute inset-0 bg-white/90 backdrop-blur-[2px] pointer-events-none" />
      {/* Desktop header bar with centered logo and actions */}
      <div className="hidden lg:flex fixed top-0 left-0 right-0 z-30 items-center justify-between bg-slate-900/80 backdrop-blur px-5 py-1.5 border-b border-white/10">
        <div className="flex items-center gap-2 text-white">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-sm font-semibold">Menu</span>
        </div>
        <div className="flex items-center justify-center">
          <img
            src="/logo.svg"
            alt="Logo"
            className="h-8 w-auto object-contain drop-shadow"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-lg border border-white/60 bg-transparent px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            onClick={() => openAuthModal('login')}
          >
            Login
          </button>
          <button
            type="button"
            className="rounded-lg border border-emerald-500 bg-white px-3 py-1.5 text-sm font-semibold text-emerald-600 shadow-sm hover:bg-emerald-50 transition-colors"
            onClick={() => openAuthModal('signup')}
          >
            Offer Service
          </button>
        </div>
      </div>
      {/* Mobile: Two-row flowing card carousel */}
      <div className="lg:hidden">
        <div className="relative space-y-3 p-0 m-0 pt-32">
          {/* Mobile top bar: Menu left, centered logo, actions right */}
          <div className="fixed top-0 inset-x-0 z-30 flex items-center justify-between bg-white/90 backdrop-blur px-4 pt-3 pb-2">
            <button
              className="flex items-center gap-2 text-sm font-semibold text-slate-800"
              onClick={() => setMobileMenuOpen((v) => !v)}
            >
              <svg className="h-5 w-5 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Menu</span>
            </button>

            <div className="absolute inset-x-0 flex justify-center pointer-events-none">
              <img
                src="/logo.svg"
                alt="Logo"
                className="h-9 w-auto object-contain"
                loading="lazy"
                decoding="async"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                className="rounded-lg border border-emerald-500 bg-white px-3 py-1.5 text-sm font-semibold text-emerald-600 shadow-sm"
                onClick={() => openAuthModal('signup')}
              >
                Offer Service
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="fixed inset-0 z-40 flex items-start">
              <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
                onClick={() => setMobileMenuOpen(false)}
              />
              <div className="relative mt-4 ml-0 h-auto max-h-[75vh] w-72 max-w-[85%] flex flex-col bg-gradient-to-b from-emerald-50 via-white to-sky-50 shadow-2xl rounded-2xl translate-x-0 transition-transform overflow-hidden">
                <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-emerald-700 uppercase tracking-[0.18em]">Menu</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="h-8 w-8 rounded-full bg-white/80 border border-slate-200 text-slate-700 flex items-center justify-center shadow-sm hover:bg-white transition"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
                <div className="p-4 space-y-3 overflow-y-auto">
                  <button
                    className="w-full text-left rounded-xl bg-white border border-emerald-200 text-emerald-700 font-semibold px-4 py-3 shadow-sm hover:shadow-md hover:border-emerald-300 transition"
                    onClick={() => openAuthModal('signup')}
                  >
                    Sign Up
                  </button>
                  <button
                    className="w-full text-left rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold px-4 py-3 shadow-sm hover:shadow-md hover:border-slate-300 transition"
                    onClick={() => openAuthModal('login')}
                  >
                    Login
                  </button>
                  <button
                    className="w-full text-left rounded-xl bg-white border border-slate-200 text-slate-800 font-semibold px-4 py-3 shadow-sm hover:shadow-md hover:border-slate-300 transition"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Help
                  </button>
                </div>
              </div>
              <div className="mt-auto px-4 pb-4">
                <div className="flex items-center gap-2 justify-center rounded-xl border border-slate-200 bg-white/90 px-4 py-2 shadow-sm">
                  <img
                    src="/logo.svg"
                    alt="Logo"
                    className="h-6 w-auto object-contain"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>
            </div>
          )}
          {/* Hero text - Premium styling */}
          <div className="text-center space-y-3 px-5 animate-fadeIn" style={{ animationDelay: '0.1s' }}>
            <h1 className="text-[30px] sm:text-4xl font-extrabold leading-[1.15] tracking-tight">
              <span className="text-slate-800">Find Certified</span>
              <br />
              <span className="relative inline-block mt-1">
                <span className="bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Home Professionals
                </span>
                <svg className="absolute -bottom-1 left-0 w-full h-2 text-sky-400/40" viewBox="0 0 200 8" preserveAspectRatio="none">
                  <path d="M0 7 Q50 0 100 7 T200 7" stroke="currentColor" strokeWidth="3" fill="none" />
                </svg>
              </span>
              <br />
              <span className="text-slate-800">in Minutes</span>
            </h1>

            <p className="text-[15px] text-slate-500 leading-relaxed max-w-[280px] mx-auto">
              Get matched with certified local professionals and receive quotes fast.
            </p>
          </div>

          {renderForm && (
            <div className="mt-4 px-4 lg:hidden">
              {renderForm}
            </div>
          )}

          {/* Two-row flowing carousel - seamless infinite with edge fade */}
          <div className="relative py-4 carousel-container">
            {/* Edge fade overlays */}
            <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-white/60 to-transparent z-10 pointer-events-none"></div>
            <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-white/60 to-transparent z-10 pointer-events-none"></div>
            
            <div className="space-y-3">
              {/* Top row - flows left */}
              <div className="overflow-hidden">
                <div className="marquee-track-left flex gap-3">
                  {[...topRowServices, ...topRowServices].map((service, idx) => (
                    <div key={`top-${idx}`} className="flex-shrink-0 w-[130px] sm:w-40">
                      <div className="carousel-card relative h-24 sm:h-28">
                        <img
                          src={service.img}
                          alt={service.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent pointer-events-none"></div>
                        <div className="absolute bottom-2 left-2 right-2">
                          <div className="flex items-center">
                            <span className="text-white text-[11px] font-bold drop-shadow-lg px-1.5 py-0.5 rounded-md bg-black/40">
                              {service.name}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom row - flows right */}
              <div className="overflow-hidden">
                <div className="marquee-track-right flex gap-3">
                  {[...bottomRowServices, ...bottomRowServices].map((service, idx) => (
                    <div key={`bottom-${idx}`} className="flex-shrink-0 w-[130px] sm:w-40">
                      <div className="carousel-card relative h-24 sm:h-28">
                        <img
                          src={service.img}
                          alt={service.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent pointer-events-none"></div>
                        <div className="absolute bottom-2 left-2 right-2">
                          <div className="flex items-center">
                            <span className="text-white text-[11px] font-bold drop-shadow-lg px-1.5 py-0.5 rounded-md bg-black/40">
                              {service.name}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
  

  
          {/* Trust metrics row */}
          <div className="flex items-center justify-center gap-4 px-4 pt-1">
            <div className="flex items-center gap-1">
              <div className="flex">
                {[1,2,3,4,5].map((i) => (
                  <svg key={i} className="w-4 h-4 text-amber-400 fill-current" viewBox="0 0 20 20">
                    <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                  </svg>
                ))}
              </div>
              <span className="text-xs font-semibold text-slate-700">4.9</span>
            </div>
            <div className="w-px h-4 bg-slate-300"></div>
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-1.5">
                {[roofingImg, electricianImg, remodelingImg].map((img, i) => (
                  <div key={i} className="w-6 h-6 rounded-full border-2 border-white overflow-hidden shadow-sm">
                  <img
                    src={img}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  </div>
                ))}
              </div>
              <span className="text-xs font-semibold text-slate-700">10K+ projects</span>
            </div>
          </div>

          {/* 3-step summary */}
          <div className="px-4">
            <StepsStrip compact />
          </div>

          {/* Bottom trust badges */}
          <div className="flex items-center justify-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-[11px] font-semibold text-emerald-700">Verified</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200">
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-[11px] font-semibold text-amber-700">Fast</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-50 border border-sky-200">
              <svg className="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-[11px] font-semibold text-sky-700">Local</span>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: Side by side layout */}
      <div className="hidden lg:grid relative z-10 grid-cols-[1.05fr_0.95fr] gap-8 xl:gap-12 items-start max-w-6xl mx-auto px-6 xl:px-8 py-6 lg:min-h-[calc(100vh-128px)]">
        <div className="flex flex-col gap-5 xl:gap-6 animate-fadeIn lg:-mt-[3px]">
          <div className="flex items-center gap-3">
            <img
              src="/logo.svg"
              alt="Miyomint Lead Generation"
              className="h-12 w-auto drop-shadow-lg object-contain"
              loading="lazy"
            />
            <span className="px-3 py-1 rounded-full border border-sky-100 bg-sky-50 text-xs font-semibold text-sky-800">
              Certified pros, fast quotes
            </span>
          </div>

          <div className="space-y-3">
            <h1 className="text-5xl xl:text-6xl font-extrabold leading-tight tracking-tight">
              <span className="text-slate-800">Find Certified</span>
              <br />
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Home Professionals
                </span>
                <svg className="absolute -bottom-2 left-0 w-full h-3 text-sky-400/30" viewBox="0 0 200 8" preserveAspectRatio="none">
                  <path d="M0 7 Q50 0 100 7 T200 7" stroke="currentColor" strokeWidth="3" fill="none" />
                </svg>
              </span>
              <br />
              <span className="text-slate-800">in Minutes</span>
            </h1>

            <p className="text-lg xl:text-xl text-slate-500 max-w-xl leading-relaxed">
              Describe your project, get matched with certified local professionals, and receive quotes fast.
            </p>
          </div>

          {renderForm && (
            <div className="hidden lg:block w-full max-w-xl">
              {renderForm}
            </div>
          )}
        </div>

        <div className="relative h-full flex flex-col items-start lg:mt-16 xl:mt-18 gap-6 w-full">
          <div className="relative w-full">
            <div className="absolute -inset-2 lg:-inset-4 bg-gradient-to-r from-sky-100 via-indigo-100 to-emerald-100 rounded-2xl lg:rounded-3xl blur-2xl lg:blur-3xl opacity-60"></div>
            <div className="relative grid grid-cols-2 gap-1.5 sm:gap-2 lg:gap-4">
              <div className="space-y-1.5 sm:space-y-2 lg:space-y-4">
                <div className="relative rounded-lg lg:rounded-2xl overflow-hidden aspect-[4/3] shadow-lg lg:shadow-2xl">
                  <img
                    src={plumberImg}
                    alt="Professional plumber"
                    className="w-full h-full object-cover"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>
                  <div className="absolute bottom-1.5 left-1.5 lg:bottom-3 lg:left-3 lg:right-3">
                    <span className="px-1.5 py-0.5 lg:px-2 lg:py-1 bg-sky-500 text-white text-[10px] lg:text-xs font-semibold rounded lg:rounded-lg">Roofing</span>
                  </div>
                </div>
                <div className="relative rounded-lg lg:rounded-2xl overflow-hidden aspect-square shadow-lg lg:shadow-2xl">
                  <img
                    src={hvacImg}
                    alt="HVAC technician"
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>
                  <div className="absolute bottom-1.5 left-1.5 lg:bottom-3 lg:left-3 lg:right-3">
                    <span className="px-1.5 py-0.5 lg:px-2 lg:py-1 bg-emerald-500 text-white text-[10px] lg:text-xs font-semibold rounded lg:rounded-lg">HVAC</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5 sm:space-y-2 lg:space-y-4 pt-3 sm:pt-4 lg:pt-8">
                <div className="relative rounded-lg lg:rounded-2xl overflow-hidden aspect-square shadow-lg lg:shadow-2xl">
                  <img
                    src={electricianImg}
                    alt="Professional electrician"
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>
                  <div className="absolute bottom-1.5 left-1.5 lg:bottom-3 lg:left-3 lg:right-3">
                    <span className="px-1.5 py-0.5 lg:px-2 lg:py-1 bg-amber-500 text-white text-[10px] lg:text-xs font-semibold rounded lg:rounded-lg">Electrical</span>
                  </div>
                </div>
                <div className="relative rounded-lg lg:rounded-2xl overflow-hidden aspect-[4/3] shadow-lg lg:shadow-2xl">
                  <img
                    src={contractorImg}
                    alt="Home contractor"
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>
                  <div className="absolute bottom-1.5 left-1.5 lg:bottom-3 lg:left-3 lg:right-3">
                    <span className="px-1.5 py-0.5 lg:px-2 lg:py-1 bg-indigo-500 text-white text-[10px] lg:text-xs font-semibold rounded lg:rounded-lg">Remodeling</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full space-y-3">
            <StepsStrip />
            <div className="grid grid-cols-3 gap-3">
              {trustBadges.map((badge, index) => (
                <div
                  key={badge.label}
                  className="group flex items-center gap-3 rounded-2xl border border-slate-100 bg-white/90 backdrop-blur shadow-[0_14px_36px_rgba(15,23,42,0.12)] hover:shadow-[0_18px_48px_rgba(59,130,246,0.16)] hover:-translate-y-0.5 transition-all duration-200 px-3.5 py-3.5"
                  style={{ animationDelay: `${index * 0.08}s` }}
                >
                  <div className="relative flex h-11 w-11 items-center justify-center">
                    <div className="relative">{badge.icon}</div>
                  </div>
                  <div className="leading-tight">
                    <p className="text-sm font-semibold text-slate-900">{badge.label}</p>
                    <p className="text-xs text-slate-500">{badge.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 pt-1">
              <div className="flex -space-x-2">
                {[plumberImg, electricianImg, hvacImg].map((img, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-white overflow-hidden shadow-md"
                  >
                    <img
                      src={img}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ))}
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-slate-800">10,000+ projects completed</p>
                <p className="text-xs text-slate-500">Join thousands of happy homeowners</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop-only testimonial block removed per request */}

      {authModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
            onClick={closeAuthModal}
          />
          <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-fadeIn">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500 font-semibold">
                  {authModal.mode === 'login' ? 'Login' : 'Sign Up'}
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {authModal.mode === 'login' ? 'Welcome back' : 'Create your account'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeAuthModal}
                className="h-8 w-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div className="px-5 pt-4 pb-5 space-y-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => updateAuthForm('role', 'company')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${authForm.role === 'company' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                >
                  Company / Firm
                </button>
                <button
                  type="button"
                  onClick={() => updateAuthForm('role', 'pro')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${authForm.role === 'pro' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                >
                  Individual / Pro
                </button>
              </div>
              {authModal.mode === 'signup' && (
                <>
                  {authForm.role === 'company' && (
                    <input
                      type="text"
                      placeholder="Company name"
                      value={authForm.companyName}
                      onChange={(e) => updateAuthForm('companyName', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition"
                    />
                  )}
                  {authForm.role === 'company' && (
                    <input
                      type="text"
                      placeholder="Company position"
                      value={authForm.position}
                      onChange={(e) => updateAuthForm('position', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition"
                    />
                  )}
                  <input
                    type="text"
                    placeholder="Full name"
                    value={authForm.name}
                    onChange={(e) => updateAuthForm('name', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition"
                  />
                </>
              )}
              <input
                type="email"
                placeholder={authForm.role === 'company' ? 'Company email' : 'Email'}
                value={authForm.email}
                onChange={(e) => updateAuthForm('email', e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition"
              />
              <input
                type="password"
                placeholder="Password"
                value={authForm.password}
                onChange={(e) => {
                  setAuthStatus({ loading: false, error: '', success: '' });
                  updateAuthForm('password', e.target.value);
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition"
              />
              <div className="flex items-center gap-2">
                <div className="h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-200 ${
                      passwordStrengthPercent >= 80 ? 'bg-emerald-500' : 'bg-amber-400'
                    }`}
                    style={{ width: `${passwordStrengthPercent}%` }}
                  />
                </div>
                <span className="text-[10px] font-semibold text-slate-500">{Math.round(passwordStrengthPercent)}%</span>
              </div>
              {passwordHint && <p className="text-xs text-rose-600 -mt-1">{passwordHint}</p>}
              {authModal.mode === 'signup' && (
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={authForm.confirm}
                  onChange={(e) => {
                    setAuthStatus({ loading: false, error: '', success: '' });
                    updateAuthForm('confirm', e.target.value);
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition"
                />
              )}
              {confirmHint && <p className="text-xs text-rose-600 -mt-2">{confirmHint}</p>}
              <div className="flex items-center gap-3 pt-1">
                <Button
                  size="lg"
                  className="flex-1 h-11 text-sm rounded-lg"
                  onClick={submitAuth}
                  disabled={submitDisabled}
                >
                  {authStatus.loading
                    ? 'Working...'
                    : authModal.mode === 'login'
                    ? 'Login'
                    : 'Create Account'}
                </Button>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{authModal.mode === 'login' ? 'Need an account?' : 'Already have an account?'}</span>
                <button
                  type="button"
                  className="text-emerald-600 font-semibold hover:text-emerald-700 transition"
                  onClick={() => openAuthModal(authModal.mode === 'login' ? 'signup' : 'login')}
                >
                  {authModal.mode === 'login' ? 'Sign up instead' : 'Log in instead'}
                </button>
              </div>
              {(authStatus.error || authStatus.success || passwordHint || confirmHint) && (
                <div className="text-xs font-semibold space-y-1">
                  {passwordHint && <p className="text-rose-600">{passwordHint}</p>}
                  {confirmHint && <p className="text-rose-600">{confirmHint}</p>}
                  {authStatus.error && <p className="text-rose-600">{authStatus.error}</p>}
                  {authStatus.success && <p className="text-emerald-600">{authStatus.success}</p>}
                </div>
              )}
            </div>
            <div className="pb-5 flex justify-center">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-4 py-2 shadow-sm">
                <img
                  src="/logo.svg"
                  alt="Logo"
                  className="h-7 w-auto object-contain"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
