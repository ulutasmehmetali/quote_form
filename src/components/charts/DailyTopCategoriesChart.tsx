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

const toDayLabel = (value: string | Date) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
};

export default function DailyTopCategoriesChart() {
  const [data, setData] = useState<DailyChartPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const response = await fetch(apiUrl('/api/stats/daily-top-categories'));
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const json = (await response.json()) as DailyApiResponse;
        if (!isMounted) return;

        const mapped = Array.isArray(json)
          ? json
              .map((item, index) => ({
                day: (index + 1).toString().padStart(2, '0'),
                tooltipLabel: toDayLabel(item.day),
                count: Number(item.count ?? 0),
                category: item.category || '—',
              }))
              .slice(-30)
          : [];

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
  }, []);

  const chartData = useMemo(() => data, [data]);
  const latest = chartData[chartData.length - 1];

  return (
    <div className="chart-card h-[320px] flex flex-col">
      <div className="chart-header">
        <h3>Son 30 Günlük Trend</h3>
      </div>

      {latest && (
        <p className="chart-subinfo">
          Bugün en çok: <b>{latest.category}</b> ({latest.count})
        </p>
      )}

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis dataKey="day" tick={{ fill: '#ccc', fontSize: 12 }} />
            <YAxis tick={{ fill: '#ccc', fontSize: 12 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#1d2736', borderRadius: '10px', border: '1px solid #3c4a5b' }}
              labelStyle={{ color: '#fff' }}
              formatter={(value, _name, props) => [`${value} başvuru`, `Kategori: ${props?.payload?.category || '—'}`]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.tooltipLabel || ''}
            />
            <Line type="monotone" dataKey="count" stroke="#4dabf7" strokeWidth={3} dot={false} isAnimationActive={!isLoading} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
