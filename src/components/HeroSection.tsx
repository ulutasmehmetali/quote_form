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

const BrandLogo = ({ className = 'w-4.5 h-4.5 text-white' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none">
    <circle cx="32" cy="32" r="14" stroke="currentColor" strokeWidth="2.5" />
    <path d="M32 18v28m-10-22h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M18 22c5.523-2 11-2 14 0 3 2 7.5 6 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M22 12c-5 4-6 10-5 18s4 12 6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M46 12c5 4 6 10 5 18s-4 12-6 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M34 44l7.5 4-7.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20 44l-7.5 4 7.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="14" cy="44" r="4" fill="currentColor" />
    <circle cx="50" cy="44" r="4" fill="currentColor" />
  </svg>
);

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
      <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
      </svg>
    ),
  },
  {
    label: 'Fast Quotes',
    desc: 'Within hours',
    icon: (
      <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    label: 'Local Experts',
    desc: 'In your area',
    icon: (
      <svg className="w-5 h-5 text-sky-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
  },
];

const steps = [
  { title: 'Tell us the issue or pick a service', desc: 'Describe your need briefly or choose from the list' },
  { title: 'Enter your ZIP code', desc: 'We’ll match you with nearby certified pros' },
  { title: 'Finish the form', desc: 'Local pros will reach out to you shortly' },
];

const StepsStrip = ({ compact = false }: { compact?: boolean }) => (
  <div className={`grid ${compact ? 'grid-cols-1 sm:grid-cols-3 gap-2' : 'grid-cols-3 gap-3'} w-full`}>
    {steps.map((step, idx) => (
      <div
        key={step.title}
        className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white/80 backdrop-blur px-3 py-3 shadow-sm"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-white font-bold">
          {idx + 1}
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900">{step.title}</p>
          <p className="text-xs text-slate-600">{step.desc}</p>
        </div>
      </div>
    ))}
  </div>
);


export default function HeroSection() {
  return (
    <section className="relative overflow-visible">
      {/* Mobile: Two-row flowing card carousel */}
      <div className="lg:hidden">
        <div className="relative space-y-5 pt-4">
          {/* Brand Logo - Premium */}
          <div className="flex justify-center animate-fadeIn">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400 via-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-sky-500/25">
                <BrandLogo className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-clip-text text-transparent">
                MIYOMINT
              </span>
            </div>
          </div>

          {/* Hero text - Premium styling */}
          <div className="text-center space-y-3 px-5 animate-fadeIn" style={{ animationDelay: '0.1s' }}>
            <h1 className="text-[28px] sm:text-4xl font-extrabold leading-[1.2] tracking-tight">
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

          {/* Two-row flowing carousel - seamless infinite with edge fade */}
          <div className="relative py-4 carousel-container">
            {/* Edge fade overlays */}
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-50 to-transparent z-10 pointer-events-none"></div>
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-50 to-transparent z-10 pointer-events-none"></div>
            
            <div className="space-y-3">
              {/* Top row - flows left */}
              <div className="overflow-hidden">
                <div className="marquee-track-left flex gap-3">
                  {[...topRowServices, ...topRowServices].map((service, idx) => (
                    <div key={`top-${idx}`} className="flex-shrink-0 w-[130px] sm:w-40">
                      <div className="carousel-card relative h-24 sm:h-28">
                        <img src={service.img} alt={service.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent pointer-events-none"></div>
                        <div className="absolute bottom-2 left-2 right-2">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-5 h-5 rounded-md ${service.color} flex items-center justify-center shadow-sm`}>
                              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            </div>
                            <span className="text-white text-[11px] font-bold drop-shadow-lg">{service.name}</span>
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
                        <img src={service.img} alt={service.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent pointer-events-none"></div>
                        <div className="absolute bottom-2 left-2 right-2">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-5 h-5 rounded-md ${service.color} flex items-center justify-center shadow-sm`}>
                              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            </div>
                            <span className="text-white text-[11px] font-bold drop-shadow-lg">{service.name}</span>
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
                    <img src={img} alt="" className="w-full h-full object-cover" />
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
      <div className="hidden lg:grid relative z-10 grid-cols-2 gap-12 items-center">
        <div className="space-y-6 animate-fadeIn">
          {/* Brand Logo - Premium with icon */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 via-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-sky-500/25">
              <BrandLogo className="w-5 h-5 text-white" />
            </div>
            <span className="text-3xl font-black tracking-tight bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-clip-text text-transparent">
              MIYOMINT
            </span>
          </div>

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

          <p className="text-xl text-slate-500 max-w-lg leading-relaxed">
            Describe your project, get matched with certified local professionals, and receive quotes fast.
          </p>

          <StepsStrip />

          <div className="flex items-stretch gap-3">
            {trustBadges.map((badge, index) => (
              <div
                key={badge.label}
                className="group flex-1 flex flex-col items-center justify-center gap-2 px-3 py-4 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-200 text-center cursor-default"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-50">
                  <div className="scale-75">{badge.icon}</div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800">{badge.label}</p>
                  <p className="text-[10px] text-slate-500">{badge.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <div className="flex -space-x-2">
              {[plumberImg, electricianImg, hvacImg].map((img, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full border-2 border-white overflow-hidden shadow-md"
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800">10,000+ projects completed</p>
              <p className="text-[10px] text-slate-500">Join thousands of happy homeowners</p>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-2 lg:-inset-4 bg-gradient-to-r from-sky-100 via-indigo-100 to-emerald-100 rounded-2xl lg:rounded-3xl blur-2xl lg:blur-3xl opacity-60"></div>
          <div className="relative grid grid-cols-2 gap-1.5 sm:gap-2 lg:gap-4">
            <div className="space-y-1.5 sm:space-y-2 lg:space-y-4">
              <div className="relative rounded-lg lg:rounded-2xl overflow-hidden aspect-[4/3] shadow-lg lg:shadow-2xl">
                <img
                  src={plumberImg}
                  alt="Professional plumber"
                  className="w-full h-full object-cover"
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
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>
                <div className="absolute bottom-1.5 left-1.5 lg:bottom-3 lg:left-3 lg:right-3">
                  <span className="px-1.5 py-0.5 lg:px-2 lg:py-1 bg-indigo-500 text-white text-[10px] lg:text-xs font-semibold rounded lg:rounded-lg">Remodeling</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop-only testimonial block removed per request */}
    </section>
  );
}
