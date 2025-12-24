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

export default function HeroSection() {
  return (
    <section className="relative overflow-visible">

      {/* MOBILE SECTION */}
      <div className="lg:hidden">
        <div className="relative space-y-5 pt-4">

          {/* Logo */}
          <div className="flex justify-center animate-fadeIn">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400 via-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-sky-500/25">
                <svg className="w-4.5 h-4.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3L4 9v12h16V9l-8-6zm0 2.236L18 9.708V19H6V9.708l6-4.472zM12 12a2 2 0 100 4 2 2 0 000-4z"/>
                </svg>
              </div>
              <span className="text-2xl font-black bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-clip-text text-transparent">
                MIYOMINT
              </span>
            </div>
          </div>

          {/* Hero Text */}
          <div className="text-center space-y-3 px-5 animate-fadeIn" style={{ animationDelay: '0.1s' }}>
            <h1 className="text-[28px] sm:text-4xl font-extrabold leading-[1.2] tracking-tight">
              <span className="text-slate-800">Find Certified</span>
              <br />
              <span className="relative inline-block mt-1">
                <span className="bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Home Professionals
                </span>
              </span>
              <br />
              <span className="text-slate-800">in Minutes</span>
            </h1>

            <p className="text-[15px] text-slate-500 leading-relaxed max-w-[280px] mx-auto">
              Get matched with certified local professionals and receive quotes fast.
            </p>
          </div>

          {/* MOBILE KAYAN SERVISLER (KALDI) */}
          <div className="relative py-4 carousel-container">
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-50 to-transparent z-10 pointer-events-none"></div>
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-50 to-transparent z-10 pointer-events-none"></div>
            
            <div className="space-y-3">

              {/* TOP ROW */}
              <div className="overflow-hidden">
                <div className="marquee-track-left flex gap-3">
                  {[...topRowServices, ...topRowServices].map((service, idx) => (
                    <div key={`top-${idx}`} className="flex-shrink-0 w-[130px] sm:w-40">
                      <div className="carousel-card relative h-24 sm:h-28">
                        <img src={service.img} alt={service.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent"></div>
                        <div className="absolute bottom-2 left-2 right-2">
                          <span className="text-white text-[11px] font-bold drop-shadow-lg">{service.name}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* BOTTOM ROW */}
              <div className="overflow-hidden">
                <div className="marquee-track-right flex gap-3">
                  {[...bottomRowServices, ...bottomRowServices].map((service, idx) => (
                    <div key={`bottom-${idx}`} className="flex-shrink-0 w-[130px] sm:w-40">
                      <div className="carousel-card relative h-24 sm:h-28">
                        <img src={service.img} alt={service.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent"></div>
                        <div className="absolute bottom-2 left-2 right-2">
                          <span className="text-white text-[11px] font-bold drop-shadow-lg">{service.name}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* ❌ MOBİL YORUM BANDI (KALDIRILDI) */}
          {/* BURASI ARTIK YOK */}

          {/* Trust Badges */}
          <div className="flex items-center justify-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-[11px] font-semibold text-emerald-700">Verified</span>
            </div>
          </div>
        </div>
      </div>

      {/* DESKTOP */}
      <div className="hidden lg:grid relative z-10 grid-cols-2 gap-12 items-center">
        
        {/* LEFT TEXT */}
        <div className="space-y-6 animate-fadeIn">

          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 via-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg">
              <svg className="w-5 h-5 text-white" fill="currentColor">
                <path d="M12 3L4 9v12h16V9l-8-6z" />
              </svg>
            </div>
            <span className="text-3xl font-black bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-clip-text text-transparent">
              MIYOMINT
            </span>
          </div>

          <h1 className="text-5xl xl:text-6xl font-extrabold leading-tight tracking-tight">
            <span className="text-slate-800">Find Certified</span>
            <br />
            <span className="bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 bg-clip-text text-transparent">Home Professionals</span>
            <br />
            <span className="text-slate-800">in Minutes</span>
          </h1>

          <p className="text-xl text-slate-500 max-w-lg leading-relaxed">
            Describe your project, get matched with certified local professionals, and receive quotes fast.
          </p>

          {/* DESKTOP BADGES */}
          <div className="flex items-stretch gap-3">
            {trustBadges.map((badge, index) => (
              <div key={badge.label} className="flex-1 px-3 py-4 rounded-xl bg-white border border-slate-200 shadow-sm text-center">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-50">
                  <div className="scale-75">{badge.icon}</div>
                </div>
                <p className="text-xs font-semibold">{badge.label}</p>
                <p className="text-[10px] text-slate-500">{badge.desc}</p>
              </div>
            ))}
          </div>

        </div>

        {/* DESKTOP IMG GRID */}
        <div className="relative">
          <div className="absolute -inset-2 bg-gradient-to-r from-sky-100 via-indigo-100 to-emerald-100 rounded-2xl blur-2xl opacity-60"></div>

          <div className="relative grid grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden aspect-[4/3] shadow-xl">
                <img src={plumberImg} className="w-full h-full object-cover" />
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-sky-500 text-white text-xs font-semibold rounded">Roofing</div>
              </div>

              <div className="relative rounded-xl overflow-hidden aspect-square shadow-xl">
                <img src={hvacImg} className="w-full h-full object-cover" />
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-emerald-500 text-white text-xs font-semibold rounded">HVAC</div>
              </div>
            </div>

            <div className="space-y-4 pt-8">
              <div className="relative rounded-xl overflow-hidden aspect-square shadow-xl">
                <img src={electricianImg} className="w-full h-full object-cover" />
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-amber-500 text-white text-xs font-semibold rounded">Electrical</div>
              </div>

              <div className="relative rounded-xl overflow-hidden aspect-[4/3] shadow-xl">
                <img src={contractorImg} className="w-full h-full object-cover" />
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-indigo-500 text-white text-xs font-semibold rounded">Remodeling</div>
              </div>
            </div>

          </div>
        </div>
      </div>

    </section>
  );
}
