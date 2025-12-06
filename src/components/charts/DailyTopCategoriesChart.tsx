import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { apiUrl } from '../../lib/api';

type DailyApiResponse = Array<{ day: string; category: string; count: number }>;

type DailyChartPoint = {
  day: string;
  tooltipLabel: string;
  count: number;
  category: string;
};

const ranges = [
  { label: '7 Gün', days: 7 },
  { label: '15 Gün', days: 15 },
  { label: '30 Gün', days: 30 },
];

const toDayLabel = (value: string | Date) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
};

const buildTicks = (points: DailyChartPoint[], step: number) => {
  return points
    .map((point, index) => ({ point, index }))
    .filter((item) => item.index % step === 0 || item.index === points.length - 1)
    .map((item) => item.point.day);
};

export default function DailyTopCategoriesChart() {
  const [data, setData] = useState<DailyChartPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState(ranges[2]);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(apiUrl(`/api/stats/daily-top-categories?days=${selectedRange.days}`));
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const json = (await response.json()) as DailyApiResponse;
        if (!isMounted) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const normalized = Array.from({ length: selectedRange.days }, (_, index) => {
          const pointDate = new Date(today);
          pointDate.setDate(pointDate.getDate() - (selectedRange.days - 1 - index));
          const isoKey = pointDate.toISOString().split('T')[0];
          return { date: pointDate, key: isoKey };
        });

        const resultMap = new Map((Array.isArray(json) ? json : []).map((item) => [item.day, item]));

        const mapped = normalized.map(({ key }) => {
          const payload = resultMap.get(key);
          return {
            day: key,
            tooltipLabel: toDayLabel(key),
            count: Number(payload?.count ?? 0),
            category: payload?.category ?? 'Bilgi yok',
          };
        });

        setData(mapped);
      } catch (error) {
        console.error('Daily top categories fetch failed:', error);
        if (isMounted) {
          setData([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [selectedRange]);

  const chartData = useMemo(() => data, [data]);
  const latest = chartData[chartData.length - 1];
  const tickStep =
    selectedRange.days <= 7 ? 1 : selectedRange.days <= 15 ? 2 : 4;
  const ticks = buildTicks(chartData, tickStep);

  const footerStartDate = new Date();
  footerStartDate.setDate(footerStartDate.getDate() - (selectedRange.days - 1));

  return (
    <div className="chart-card h-[360px] flex flex-col">
      <div className="chart-header flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-xl font-semibold">Trendler</h3>
          <div className="flex gap-2">
            {ranges.map((range) => (
              <button
                key={range.days}
                onClick={() => setSelectedRange(range)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                  range.days === selectedRange.days
                    ? 'bg-slate-800 text-white border border-slate-600'
                    : 'bg-slate-900/70 text-slate-300 border border-transparent hover:border-slate-600'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {latest && (
          <p className="chart-subinfo">
            Bugün en çok: <b>{latest.category}</b> ({latest.count})
          </p>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis
              dataKey="day"
              tick={{ fill: '#ccc', fontSize: 12 }}
              ticks={ticks}
              tickFormatter={toDayLabel}
            />
            <YAxis tick={{ fill: '#ccc', fontSize: 12 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#1d2736', borderRadius: '10px', border: '1px solid #3c4a5b' }}
              labelStyle={{ color: '#fff' }}
              formatter={(value, _name, props) => [`${value} başvuru`, `Kategori: ${props?.payload?.category || 'Bilgi yok'}`]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.tooltipLabel || ''}
            />
            <Line type="monotone" dataKey="count" stroke="#4dabf7" strokeWidth={3} dot={false} isAnimationActive={!isLoading} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400 mt-3">
        <p>Son {selectedRange.days} gün ({footerStartDate.toLocaleDateString('tr-TR')} – {new Date().toLocaleDateString('tr-TR')})</p>
        <p>{selectedRange.days <= 7 ? 'Günlük' : 'Her birkaç gün'}</p>
      </div>
    </div>
  );
}
