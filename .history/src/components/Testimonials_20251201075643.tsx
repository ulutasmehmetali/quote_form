import { useState, useEffect } from 'react';

const testimonials = [
  {
    id: 1,
    name: 'Sarah Mitchell',
    location: 'Austin, TX',
    service: 'Roofing Repair',
    rating: 5,
    review: 'Found an amazing roofer within hours! The whole process was seamless and the quality of work exceeded my expectations. Highly recommend MIYOMINT!',
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
    review: 'The electrician was licensed, professional, and fixed everything in one visit. Love how easy this platform makes finding trusted pros!',
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
    review: 'Quick response, fair pricing, and excellent service. My AC was repaired the same day I submitted my request! Will definitely use again.',
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
    review: 'Transformed our kitchen completely! The contractor was detail-oriented and kept us updated throughout the entire project. Outstanding results!',
    avatar: 'DT',
    color: 'from-amber-400 to-orange-500',
    verified: true,
    date: '5 days ago',
  },
  {
    id: 5,
    name: 'Emily Carter',
    location: 'Miami, FL',
    service: 'Plumbing',
    rating: 5,
    review: 'Had a major leak and needed help fast. MIYOMINT connected me with a plumber who arrived within 2 hours. Crisis averted! Thank you!',
    avatar: 'EC',
    color: 'from-purple-400 to-violet-500',
    verified: true,
    date: '1 day ago',
  },
  {
    id: 6,
    name: 'Robert Kim',
    location: 'Chicago, IL',
    service: 'Flooring',
    rating: 5,
    review: 'Beautiful hardwood floors installed perfectly. The team was professional, clean, and finished ahead of schedule. Couldn\'t be happier!',
    avatar: 'RK',
    color: 'from-cyan-400 to-sky-500',
    verified: true,
    date: '4 days ago',
  },
];

function TestimonialCard({ testimonial }: { testimonial: typeof testimonials[0] }) {
  return (
    <div className="group flex-shrink-0 w-[320px] sm:w-[360px] p-6 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-xl hover:border-slate-300 hover:-translate-y-1 transition-all duration-300">
      <div className="flex items-center gap-0.5 mb-3">
        {[...Array(testimonial.rating)].map((_, i) => (
          <svg key={i} className="w-5 h-5 text-amber-400 fill-current" viewBox="0 0 20 20">
            <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
          </svg>
        ))}
      </div>
      
      <p className="text-slate-700 mb-4 leading-relaxed text-sm">"{testimonial.review}"</p>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${testimonial.color} flex items-center justify-center text-white font-bold text-sm shadow-md`}>
            {testimonial.avatar}
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">{testimonial.name}</p>
            <p className="text-xs text-slate-500">{testimonial.location} • {testimonial.service}</p>
          </div>
        </div>
        
        {testimonial.verified && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200">
            <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>
      
      <div className="mt-3 pt-3 border-t border-slate-100">
        <p className="text-xs text-slate-400">{testimonial.date}</p>
      </div>
    </div>
  );
}

export default function Testimonials() {
  const [isPaused, setIsPaused] = useState(false);

  return (
    <section className="py-16 lg:py-20 bg-gradient-to-b from-white to-slate-50 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-10">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold mb-4">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
            </svg>
            Customer Reviews
          </span>
          <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
            Loved by <span className="bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">Homeowners</span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Join thousands of satisfied homeowners who found their perfect professional through MIYOMINT.
          </p>
          
          <div className="flex items-center justify-center gap-4 mt-6">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-5 h-5 text-amber-400 fill-current" viewBox="0 0 20 20">
                  <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                </svg>
              ))}
            </div>
            <span className="text-slate-600 font-medium">4.9/5 from 2,500+ reviews</span>
          </div>
        </div>
      </div>

      <div 
        className="relative"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
        
        <div className="overflow-hidden">
          <div 
            className={`flex gap-6 ${isPaused ? '' : 'animate-scroll-testimonials'}`}
            style={{ width: 'max-content' }}
          >
            {[...testimonials, ...testimonials].map((testimonial, index) => (
              <TestimonialCard key={`${testimonial.id}-${index}`} testimonial={testimonial} />
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { value: '10,000+', label: 'Projects Completed', icon: '🏠' },
            { value: '2,500+', label: 'Verified Pros', icon: '👷' },
            { value: '4.9/5', label: 'Average Rating', icon: '⭐' },
            { value: '98%', label: 'Satisfaction Rate', icon: '💯' },
          ].map((stat) => (
            <div key={stat.label} className="text-center p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
              <div className="text-2xl mb-2">{stat.icon}</div>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-sm text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes scroll-testimonials {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-scroll-testimonials {
          animation: scroll-testimonials 40s linear infinite;
        }
      `}</style>
    </section>
  );
}
