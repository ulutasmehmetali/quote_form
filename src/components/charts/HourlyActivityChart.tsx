import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { apiUrl } from '../../lib/api';

type HourlyApiResponse = Array<{ hour: number; count: number }>;
type HourlyChartPoint = { hour: string; count: number };

const baseHours: HourlyChartPoint[] = Array.from({ length: 24 }, (_, hour) => ({
  hour: hour.toString().padStart(2, '0'),
  count: 0,
}));

export default function HourlyActivityChart() {
  const [data, setData] = useState<HourlyChartPoint[]>(baseHours);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const response = await fetch(apiUrl('/api/stats/hourly-activity'));
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const json = (await response.json()) as HourlyApiResponse;
        if (!isMounted) return;

        const mapped = Array.isArray(json)
          ? json.map((item) => ({
              hour: Number(item.hour).toString().padStart(2, '0'),
              count: Number(item.count ?? 0),
            }))
          : baseHours;

        setData(mapped.length ? mapped : baseHours);
      } catch (error) {
        console.error('Hourly activity fetch failed:', error);
        if (isMounted) {
          setData(baseHours);
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

  const chartData = useMemo(() => {
    if (!Array.isArray(data)) return baseHours;
    const lookup = new Map(data.map((item) => [item.hour, item.count]));
    return baseHours.map((point) => ({
      ...point,
      count: lookup.get(point.hour) ?? 0,
    }));
  }, [data]);

  return (
    <div className="chart-card h-[320px] flex flex-col">
      <div className="chart-header">
        <h3>Saatlik Aktivite</h3>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="hour" tick={{ fill: '#ccc', fontSize: 12 }} />
            <YAxis tick={{ fill: '#ccc', fontSize: 12 }} allowDecimals={false} />
            <Tooltip
              formatter={(value, _name, props) => [`${value} başvuru`, `Saat: ${props.payload.hour}`]}
              labelFormatter={(label) => `Saat ${label}`}
              contentStyle={{ background: '#1d2736', borderRadius: '10px', border: '1px solid #3c4a5b' }}
              labelStyle={{ color: '#fff' }}
            />
            <Bar dataKey="count" fill="#4dabf7" radius={[8, 8, 0, 0]} isAnimationActive={!isLoading} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
