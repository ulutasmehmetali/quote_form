import { useState, type MouseEvent } from 'react';
import usaMap from '@svg-maps/usa';

interface StateData {
  state: string;
  count: number;
}

interface USMapProps {
  data: StateData[];
}

type UsaLocation = {
  id: string;
  name: string;
  path: string;
};

const statePaths: Record<string, string> = usaMap.locations.reduce<Record<string, string>>(
  (acc: Record<string, string>, location: UsaLocation) => {
    acc[location.id.toUpperCase()] = location.path;
    return acc;
  },
  {}
);

const stateNames: Record<string, string> = usaMap.locations.reduce<Record<string, string>>(
  (acc: Record<string, string>, location: UsaLocation) => {
    acc[location.id.toUpperCase()] = location.name;
    return acc;
  },
  {}
);

export default function USMap({ data }: USMapProps) {
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const maxCount = data.length ? Math.max(...data.map((d) => d.count)) : 1;

  const getStateColor = (stateCode: string) => {
    const stateData = data.find(
      (d) =>
        d.state === stateCode ||
        d.state?.toUpperCase() === stateCode ||
        d.state === stateNames[stateCode]
    );

    if (!stateData) return 'rgba(148, 163, 184, 0.3)';

    const intensity = stateData.count / maxCount;
    if (intensity > 0.8) return 'rgba(14, 165, 233, 0.9)';
    if (intensity > 0.6) return 'rgba(14, 165, 233, 0.7)';
    if (intensity > 0.4) return 'rgba(14, 165, 233, 0.55)';
    if (intensity > 0.2) return 'rgba(14, 165, 233, 0.4)';
    return 'rgba(14, 165, 233, 0.25)';
  };

  const getStateCount = (stateCode: string) => {
    const stateData = data.find(
      (d) =>
        d.state === stateCode ||
        d.state?.toUpperCase() === stateCode ||
        d.state === stateNames[stateCode]
    );
    return stateData?.count || 0;
  };

  const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const totalUSSubmissions = data.reduce((sum, d) => sum + d.count, 0);
  const topStates = [...data].sort((a, b) => b.count - a.count).slice(0, 5);

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-2xl">🇺🇸</span> ABD Eyalet Dağılımı
        </h3>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span className="font-semibold text-white">{totalUSSubmissions}</span> toplam başvuru
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={usaMap.viewBox}
          className="w-full h-auto"
          onMouseMove={handleMouseMove}
        >
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g transform="translate(0, 0)">
            {Object.entries(statePaths).map(([stateCode, path]) => (
              <path
                key={stateCode}
                d={path}
                fill={hoveredState === stateCode ? 'rgba(14, 165, 233, 1)' : getStateColor(stateCode)}
                stroke={hoveredState === stateCode ? '#fff' : 'rgba(255,255,255,0.2)'}
                strokeWidth={hoveredState === stateCode ? 1.5 : 0.5}
                className="transition-all duration-200 cursor-pointer"
                filter={hoveredState === stateCode ? 'url(#glow)' : undefined}
                onMouseEnter={() => setHoveredState(stateCode)}
                onMouseLeave={() => setHoveredState(null)}
              />
            ))}
          </g>
        </svg>

        {hoveredState && (
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: tooltipPos.x + 15,
              top: tooltipPos.y - 10,
            }}
          >
            <div className="bg-slate-900 border border-white/20 rounded-lg px-3 py-2 shadow-xl">
              <div className="flex items-center gap-2">
                <span className="text-lg">📍</span>
                <div>
                  <p className="text-white font-semibold">{stateNames[hoveredState] || hoveredState}</p>
                  <p className="text-sky-400 text-sm">{getStateCount(hoveredState)} başvuru</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">Az</span>
          <div className="flex gap-1">
            {[0.25, 0.4, 0.55, 0.7, 0.9].map((opacity, i) => (
              <div key={i} className="w-6 h-3 rounded" style={{ backgroundColor: `rgba(14, 165, 233, ${opacity})` }} />
            ))}
          </div>
          <span className="text-xs text-slate-500">Çok</span>
        </div>
      </div>

      {topStates.length > 0 && (
        <div className="mt-6 pt-6 border-t border-white/5">
          <h4 className="text-sm font-semibold text-slate-300 mb-4">En Çok Başvuru Alan Eyaletler</h4>
          <div className="space-y-3">
            {topStates.map((state, index) => {
              const percentage = totalUSSubmissions > 0 ? (state.count / totalUSSubmissions) * 100 : 0;
              const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
              return (
                <div key={`${state.state}-${index}`} className="flex items-center gap-3">
                  <span className="text-lg w-6">{medals[index] || `#${index + 1}`}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white text-sm">{state.state}</span>
                      <span className="text-slate-400 text-xs">
                        {state.count} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          <p className="text-4xl mb-3">🗺️</p>
          <p>Henüz ABD'den başvuru verisi yok</p>
          <p className="text-sm mt-1">Başvurular geldikçe haritada görünecek</p>
        </div>
      )}
    </div>
  );
}

export const usaStateNames = stateNames;
