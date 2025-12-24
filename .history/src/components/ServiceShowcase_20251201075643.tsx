import plumberImg from '@assets/roofing services_1764316007803.webp';
import electricianImg from '@assets/electric_1764315995946.jpg';
import hvacImg from '@assets/hvac_1764316003781.jpg';
import handymanImg from '@assets/handyman_1764336231412.jpg';
import flooringImg from '@assets/flooring_1764336237108.webp';
import drywallImg from '@assets/drywall_1764336241264.jpg';
import cleaningImg from '@assets/cleaning_1764336246728.jpg';
import remodelingImg from '@assets/remodeling_1764336249973.webp';

const services = [
  {
    name: 'Roofing',
    description: 'Expert roof repairs, replacements, and inspections by certified professionals.',
    image: plumberImg,
    color: 'from-sky-500 to-blue-600',
    features: ['Leak repairs', 'Full replacements', 'Inspections'],
    avgPrice: '$300-$15,000',
  },
  {
    name: 'Electrical',
    description: 'Licensed electricians for all your wiring, outlets, and electrical panel needs.',
    image: electricianImg,
    color: 'from-amber-500 to-orange-600',
    features: ['Wiring', 'Panel upgrades', 'Lighting'],
    avgPrice: '$150-$5,000',
  },
  {
    name: 'HVAC',
    description: 'Heating and cooling installation, repairs, and maintenance services.',
    image: hvacImg,
    color: 'from-emerald-500 to-teal-600',
    features: ['AC repair', 'Heating', 'Maintenance'],
    avgPrice: '$100-$10,000',
  },
  {
    name: 'Remodeling',
    description: 'Transform your space with kitchen, bathroom, and whole-home renovations.',
    image: remodelingImg,
    color: 'from-indigo-500 to-purple-600',
    features: ['Kitchens', 'Bathrooms', 'Additions'],
    avgPrice: '$5,000-$100,000+',
  },
  {
    name: 'Flooring',
    description: 'Installation and refinishing for hardwood, tile, carpet, and vinyl floors.',
    image: flooringImg,
    color: 'from-rose-500 to-pink-600',
    features: ['Hardwood', 'Tile', 'Carpet'],
    avgPrice: '$1,000-$15,000',
  },
  {
    name: 'Handyman',
    description: 'General repairs and maintenance for all your home improvement needs.',
    image: handymanImg,
    color: 'from-teal-500 to-cyan-600',
    features: ['Repairs', 'Assembly', 'Maintenance'],
    avgPrice: '$50-$500',
  },
  {
    name: 'Drywall',
    description: 'Professional drywall installation, repair, and finishing services.',
    image: drywallImg,
    color: 'from-slate-500 to-gray-600',
    features: ['Installation', 'Repair', 'Finishing'],
    avgPrice: '$200-$3,000',
  },
  {
    name: 'Cleaning',
    description: 'Professional deep cleaning and regular maintenance for your home.',
    image: cleaningImg,
    color: 'from-lime-500 to-green-600',
    features: ['Deep clean', 'Regular', 'Move-out'],
    avgPrice: '$100-$500',
  },
];

export default function ServiceShowcase() {
  return (
    <section className="py-16 lg:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-semibold mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            Our Services
          </span>
          <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
            Professional <span className="bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">Home Services</span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            From quick repairs to major renovations, we connect you with verified professionals for every home project.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service) => (
            <div
              key={service.name}
              className="group relative rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="relative h-40 overflow-hidden">
                <img
                  src={service.image}
                  alt={service.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />
                <div className={`absolute top-3 left-3 px-3 py-1 rounded-lg bg-gradient-to-r ${service.color} text-white text-xs font-bold shadow-lg`}>
                  {service.name}
                </div>
              </div>
              
              <div className="p-4">
                <p className="text-sm text-slate-600 mb-3 leading-relaxed line-clamp-2">
                  {service.description}
                </p>
                
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {service.features.map((feature) => (
                    <span
                      key={feature}
                      className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
                
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div>
                    <p className="text-xs text-slate-400">Avg. Cost</p>
                    <p className="text-sm font-semibold text-slate-800">{service.avgPrice}</p>
                  </div>
                  <button className={`p-2 rounded-lg bg-gradient-to-r ${service.color} text-white shadow-md hover:shadow-lg transition-all`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-slate-500 mb-4">Don't see your service?</p>
          <button className="px-6 py-3 rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 text-white font-semibold shadow-lg hover:shadow-xl transition-all inline-flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            Describe Your Project
          </button>
        </div>
      </div>
    </section>
  );
}
