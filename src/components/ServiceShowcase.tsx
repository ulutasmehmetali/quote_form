import SectionCard from './SectionCard';

const SERVICE_CATEGORIES = [
  {
    name: 'Roofing',
    description: 'Repairs, leaks, storm damage, and full roof replacements.',
    examples: ['Shingle replacement', 'Leak tracing', 'Flashing repair'],
  },
  {
    name: 'Plumbing',
    description: 'Fix common water, drain, and fixture issues fast.',
    examples: ['Water heater issues', 'Clogged drains', 'Pipe leaks'],
  },
  {
    name: 'Electrical',
    description: 'Safe electrical fixes and upgrades for any home.',
    examples: ['Breaker trips', 'Outlet installs', 'Lighting upgrades'],
  },
  {
    name: 'HVAC',
    description: 'Heating and cooling tune-ups, repairs, and installs.',
    examples: ['AC not cooling', 'Furnace tune-up', 'Thermostat installs'],
  },
  {
    name: 'Painting',
    description: 'Interior/exterior painting with prep and clean finishes.',
    examples: ['Interior rooms', 'Exterior refresh', 'Cabinet painting'],
  },
  {
    name: 'Flooring',
    description: 'Repair or install wood, tile, vinyl, or carpet.',
    examples: ['Hardwood refinish', 'Tile repair', 'Luxury vinyl plank'],
  },
  {
    name: 'Landscaping',
    description: 'Curb appeal, cleanups, and outdoor improvements.',
    examples: ['Seasonal cleanup', 'Sod install', 'Mulch & edging'],
  },
  {
    name: 'Concrete',
    description: 'Flatwork, patching, and small structural pours.',
    examples: ['Driveway patch', 'Walkway pour', 'Step repair'],
  },
  {
    name: 'Fencing',
    description: 'Build, repair, or replace wood and metal fences.',
    examples: ['Post reset', 'Gate repair', 'Privacy fence'],
  },
];

const LANDING_LINKS = [
  { city: 'New York, NY', service: 'Roofing' },
  { city: 'Los Angeles, CA', service: 'Plumbing' },
  { city: 'Chicago, IL', service: 'Electrical' },
  { city: 'Houston, TX', service: 'HVAC' },
  { city: 'Miami, FL', service: 'Painting' },
  { city: 'Dallas, TX', service: 'Flooring' },
  { city: 'Phoenix, AZ', service: 'Landscaping' },
  { city: 'Seattle, WA', service: 'Roofing' },
  { city: 'Denver, CO', service: 'Concrete' },
  { city: 'Atlanta, GA', service: 'Fencing' },
];

export default function ServiceShowcase() {
  return (
    <SectionCard surface="frosted" padding="lg" className="mx-auto max-w-6xl mt-10">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">SEO Blocks</p>
          <h2 className="text-3xl font-bold text-slate-900">Service Library</h2>
          <p className="text-slate-600 text-sm">
            Short descriptions and example jobs for each category, plus city/service landing links you can reuse.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICE_CATEGORIES.map((item) => (
            <div
              key={item.name}
              className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{item.name}</h3>
                  <p className="text-sm text-slate-600 mt-1">{item.description}</p>
                </div>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-slate-700 list-disc list-inside">
                {item.examples.map((example) => (
                  <li key={example}>{example}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">City + Service Landing Links</h3>
              <p className="text-sm text-slate-600">
                Pre-built URLs you can link or index for local search.
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {LANDING_LINKS.map(({ city, service }) => {
              const href = `/?service=${encodeURIComponent(service)}&city=${encodeURIComponent(city)}`;
              return (
                <a
                  key={`${city}-${service}`}
                  href={href}
                  className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm text-slate-800 shadow hover:shadow-md transition"
                >
                  <span className="font-semibold">{service}</span>
                  <span className="text-slate-500 text-xs">{city}</span>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
