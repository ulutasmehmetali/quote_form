import { useState, useEffect, useRef, forwardRef } from 'react';

// =========================
//      TYPE DEFINITIONS
// =========================

type Testimonial = {
  id: number;
  name: string;
  location: string;
  service: string;
  rating: number;
  review: string;
  avatar: string;
  color: string;
  verified: boolean;
  date: string;
};

// =========================
//     TESTIMONIAL DATA
// =========================

const testimonials: Testimonial[] = [
  {
    id: 1,
    name: 'Sarah Mitchell',
    location: 'Austin, TX',
    service: 'Roofing Repair',
    rating: 5,
    review:
      'Found an amazing roofer within hours! The whole process was seamless and the quality of work exceeded my expectations. Highly recommend MIYOMINT!',
    avatar: 'SM',
    color: 'from-rose-400 to-pink-500',
    verified: true,
    date: '2 weeks ago',
  },
  {
    id: 2,
    name: 'Michael Rodriguez',
    location: 'Phoenix, AZ',
    service: 'Electrical Work',
    rating: 5,
    review:
      'The electrician was licensed, professional, and fixed everything in one visit. Love how easy this platform makes finding trusted pros!',
    avatar: 'MR',
    color: 'from-blue-400 to-indigo-500',
    verified: true,
    date: '1 week ago',
  },
  {
    id: 3,
    name: 'Jennifer Lee',
    location: 'Denver, CO',
    service: 'HVAC Service',
    rating: 5,
    review:
      'Quick response, fair pricing, and excellent service. My AC was repaired the same day I submitted my request! Will definitely use again.',
    avatar: 'JL',
    color: 'from-emerald-400 to-teal-500',
    verified: true,
    date: '3 days ago',
  },
  {
    id: 4,
    name: 'David Thompson',
    location: 'Seattle, WA',
    service: 'Home Remodeling',
    rating: 5,
    review:
      'Transformed our kitchen completely! The contractor was detail-oriented and kept us updated throughout the entire project. Outstanding results!',
    avatar: 'DT',
    color: 'from-amber-400 to-orange-500',
    verified: true,
    date: '5 days ago',
  },
  {
    id: 5,
    name: 'Emily Carter',
    location: 'Nashville, TN',
    service: 'Flooring Installation',
    rating: 5,
    review:
      'Installed new hardwood floors in three rooms within a day. Communication was clear and the crew left the house spotless.',
    avatar: 'EC',
    color: 'from-slate-500 to-slate-700',
    verified: true,
    date: '1 week ago',
  },
  {
    id: 6,
    name: 'Marcus Bennett',
    location: 'Orlando, FL',
    service: 'Pool Deck Repair',
    rating: 5,
    review:
      'Repaired our cracked concrete pool deck in record time. The crew showed up exactly when promised and kept us updated every step.',
    avatar: 'MB',
    color: 'from-cyan-400 to-blue-500',
    verified: true,
    date: '4 days ago',
  },
  {
    id: 7,
    name: 'Priya Patel',
    location: 'San Diego, CA',
    service: 'Landscaping',
    rating: 5,
    review:
      'Reimagined our backyard with drought-resistant plants and smart lighting. The design felt custom and the installation was flawless.',
    avatar: 'PP',
    color: 'from-emerald-500 to-lime-500',
    verified: true,
    date: '3 days ago',
  },
  {
    id: 8,
    name: 'Luis Gomez',
    location: 'El Paso, TX',
    service: 'Concrete Repair',
    rating: 5,
    review:
      'Patched the driveway and resealed the walkway. The surface looks better than the day it was poured.',
    avatar: 'LG',
    color: 'from-orange-400 to-amber-500',
    verified: true,
    date: '5 days ago',
  },
  {
    id: 9,
    name: 'Hannah Brooks',
    location: 'Portland, OR',
    service: 'Drywall Repair',
    rating: 5,
    review:
      'Fixed extensive drywall damage after a ceiling leak. The texture and paint match was perfect and the crew cleaned up meticulously.',
    avatar: 'HB',
    color: 'from-purple-400 to-indigo-500',
    verified: true,
    date: '2 days ago',
  },
  {
    id: 10,
    name: 'Rebecca Morgan',
    location: 'Charlotte, NC',
    service: 'Interior Painting',
    rating: 5,
    review:
      'Painted our entire main level with zero drips. The attention to detail around trim and light fixtures was impressive.',
    avatar: 'RM',
    color: 'from-rose-500 to-pink-500',
    verified: true,
    date: '1 day ago',
  },
  {
    id: 11,
    name: 'Tyler Nguyen',
    location: 'Orlando, FL',
    service: 'HVAC Installation',
    rating: 5,
    review:
      'Installed a new energy-efficient heat pump and explained how to maintain it. The savings already show in our electric bill.',
    avatar: 'TN',
    color: 'from-sky-500 to-indigo-500',
    verified: true,
    date: '6 days ago',
  },
  {
    id: 12,
    name: 'Olivia Hart',
    location: 'Boston, MA',
    service: 'Electrical',
    rating: 5,
    review:
      'Rewired our outdated kitchen and added smart lighting. Super professional, clean, and punctual.',
    avatar: 'OH',
    color: 'from-cyan-600 to-blue-700',
    verified: true,
    date: '8 days ago',
  },
  {
    id: 13,
    name: 'Ethan Reed',
    location: 'Denver, CO',
    service: 'Solar Panels',
    rating: 5,
    review:
      'Installed panels on a tricky roof pitch with no drama. The estimator walked me through every incentive.',
    avatar: 'ER',
    color: 'from-amber-400 to-yellow-500',
    verified: true,
    date: '2 weeks ago',
  },
  {
    id: 14,
    name: 'Mia Kline',
    location: 'Minneapolis, MN',
    service: 'Roofing Replacement',
    rating: 5,
    review:
      'Replaced our roof after storm damage. The crew stayed late to get it done before the next forecasted snow.',
    avatar: 'MK',
    color: 'from-emerald-400 to-teal-500',
    verified: true,
    date: '3 weeks ago',
  },
  {
    id: 15,
    name: 'Jordan Lewis',
    location: 'Atlanta, GA',
    service: 'Garage Door Repair',
    rating: 5,
    review:
      'Fixed the opener, realigned the tracks, and replaced the rollers. Quiet, smooth operation now.',
    avatar: 'JD',
    color: 'from-slate-400 to-slate-600',
    verified: true,
    date: '1 week ago',
  },
  {
    id: 16,
    name: 'Ava Patel',
    location: 'Seattle, WA',
    service: 'Plumbing',
    rating: 5,
    review:
      'Replaced corroded piping and installed a water softener in one visit. My water tastes better already.',
    avatar: 'AP',
    color: 'from-indigo-500 to-purple-600',
    verified: true,
    date: '4 days ago',
  },
  {
    id: 17,
    name: 'Noah King',
    location: 'Chicago, IL',
    service: 'Pest Control',
    rating: 5,
    review:
      'Took care of a stubborn rodent issue with humane traps and follow-up visits. Totally relieved to see zero activity.',
    avatar: 'NK',
    color: 'from-lime-500 to-emerald-500',
    verified: true,
    date: '5 days ago',
  },
  {
    id: 18,
    name: 'Grace White',
    location: 'Philadelphia, PA',
    service: 'Deep Cleaning',
    rating: 5,
    review:
      'Sparkling clean after they tackled the entire first floor. Every surface shined and the smell was amazing.',
    avatar: 'GW',
    color: 'from-cyan-400 to-teal-500',
    verified: true,
    date: '3 days ago',
  },
  {
    id: 19,
    name: 'Mateo Cruz',
    location: 'Las Vegas, NV',
    service: 'Fencing',
    rating: 5,
    review:
      'Installed a modern metal fence that gives privacy and still looks airy. Showed up early and finished ahead of schedule.',
    avatar: 'MC',
    color: 'from-orange-500 to-red-500',
    verified: true,
    date: '1 day ago',
  },
  {
    id: 20,
    name: 'Zoe Park',
    location: 'San Jose, CA',
    service: 'Kitchen Remodeling',
    rating: 5,
    review:
      'The team remodeled our kitchen with custom cabinets and quartz countertops. Clean, communicative, and careful with our home.',
    avatar: 'ZP',
    color: 'from-rose-500 to-orange-500',
    verified: true,
    date: '6 days ago',
  },
];

// =========================
//    TESTIMONIAL CARD
// =========================

type TestimonialCardProps = {
  testimonial: Testimonial;
  onClick: () => void;
};

const TestimonialCard = forwardRef<HTMLDivElement, TestimonialCardProps>(function TestimonialCard(
  { testimonial, onClick },
  ref
) {
  return (
    <div
      ref={ref}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="group flex-shrink-0 w-[320px] sm:w-[360px] p-6 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-xl hover:border-slate-300 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
    >
      <div className="flex items-center gap-0.5 mb-3">
        {[...Array(testimonial.rating)].map((_, i) => (
          <svg
            key={i}
            className="w-5 h-5 text-amber-400 fill-current"
            viewBox="0 0 20 20"
          >
            <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
          </svg>
        ))}
      </div>

      <p className="text-slate-700 mb-4 leading-relaxed text-sm">
        "{testimonial.review}"
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full bg-gradient-to-br ${testimonial.color} flex items-center justify-center text-white font-bold text-sm shadow-md`}
          >
            {testimonial.avatar}
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">
              {testimonial.name}
            </p>
            <p className="text-xs text-slate-500">
              {testimonial.location} • {testimonial.service}
            </p>
          </div>
        </div>

        {testimonial.verified && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200">
            <svg
              className="w-4 h-4 text-emerald-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100">
        <p className="text-xs text-slate-400">{testimonial.date}</p>
      </div>
    </div>
  );
});

// =========================
//       MAIN SECTION
// =========================

export default function Testimonials() {
  const [isPaused, setIsPaused] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [focusOffset, setFocusOffset] = useState(0);
  const trackWrapperRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (focusedIndex === null) {
      setFocusOffset(0);
      return;
    }
    const card = cardRefs.current[focusedIndex];
    const wrapper = trackWrapperRef.current;
    if (!card || !wrapper) return;

    const offset =
      card.offsetLeft + card.offsetWidth / 2 - wrapper.clientWidth / 2;
    setFocusOffset(Math.max(0, offset));
  }, [focusedIndex]);

  useEffect(() => {
    if (focusedIndex === null) return undefined;

    const handleResize = () => {
      const card = cardRefs.current[focusedIndex];
      const wrapper = trackWrapperRef.current;
      if (!card || !wrapper) return;
      const offset =
        card.offsetLeft + card.offsetWidth / 2 - wrapper.clientWidth / 2;
      setFocusOffset(Math.max(0, offset));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [focusedIndex]);

  return (
    <section className="py-16 lg:py-24 bg-white overflow-hidden">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-10">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold mb-4">
            ⭐ Customer Reviews
          </span>

          <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
            Loved by{' '}
            <span className="bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
              Homeowners
            </span>
          </h2>
        </div>
      </div>

      {/* Sliding testimonials */}
      <div
        className="relative"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

          <div
            className="overflow-hidden"
            onClick={() => {
              if (focusedIndex !== null) {
                setFocusedIndex(null);
                setIsPaused(false);
              }
            }}
          >
            <div
              ref={trackWrapperRef}
              className="flex gap-6 animate-scroll-testimonials"
              style={{
                width: 'max-content',
                animationPlayState: isPaused ? 'paused' : 'running',
                transform:
                  focusedIndex !== null
                    ? `translateX(-${focusOffset}px)`
                    : undefined,
              }}
            >
              {[...testimonials, ...testimonials].map((t, idx) => (
                <TestimonialCard
                  key={`${t.id}-${idx}`}
                  ref={(el) => {
                    cardRefs.current[idx] = el;
                  }}
                  testimonial={t}
                  onClick={() => {
                    setFocusedIndex(idx);
                    setIsPaused(true);
                  }}
                />
              ))}
            </div>
          </div>
      </div>

      {/* Animation Keyframe */}
      <style>{`
        @keyframes scroll-testimonials {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scroll-testimonials {
          animation: scroll-testimonials 120s linear infinite;
        }
      `}</style>
    </section>
  );
}
