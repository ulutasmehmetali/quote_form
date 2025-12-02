import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import USMap from '../components/USMap';

interface Stats {
  overview: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  byStatus: Record<string, number>;
  byServiceType: Array<{ serviceType: string; count: number }>;
  byCountry: Array<{ country: string; countryCode: string; count: number }>;
  byBrowser: Array<{ browser: string; count: number }>;
  byDeviceType: Array<{ deviceType: string; count: number }>;
  byOS: Array<{ os: string; count: number }>;
  dailyTrend: Array<{ date: string; count: number }>;
  hourlyDistribution: Array<{ hour: number; count: number }>;
  weekdayDistribution: Array<{ weekday: number; count: number }>;
  byUSState: Array<{ state: string; count: number }>;
}

interface AdminReportsProps {
  onNavigate: (page: string) => void;
}

const countryFlags: Record<string, string> = {
  US: '🇺🇸', TR: '🇹🇷', DE: '🇩🇪', GB: '🇬🇧', FR: '🇫🇷', ES: '🇪🇸', IT: '🇮🇹',
  NL: '🇳🇱', BE: '🇧🇪', AT: '🇦🇹', CH: '🇨🇭', PL: '🇵🇱', CZ: '🇨🇿', RU: '🇷🇺',
  UA: '🇺🇦', JP: '🇯🇵', CN: '🇨🇳', KR: '🇰🇷', IN: '🇮🇳', BR: '🇧🇷', MX: '🇲🇽',
  CA: '🇨🇦', AU: '🇦🇺', NZ: '🇳🇿', ZA: '🇿🇦', AE: '🇦🇪', SA: '🇸🇦', EG: '🇪🇬',
};

const weekdays = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

export default function AdminReports({ onNavigate }: AdminReportsProps) {
  const { logout, user, getAuthHeaders } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats', {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const statusConfig: Record<string, { color: string; label: string }> = {
    new: { color: '#3B82F6', label: 'Yeni' },
    contacted: { color: '#F59E0B', label: 'İletişimde' },
    in_progress: { color: '#8B5CF6', label: 'Devam Ediyor' },
    completed: { color: '#10B981', label: 'Tamamlandı' },
    cancelled: { color: '#EF4444', label: 'İptal' },
  };

  const browserColors: Record<string, string> = {
    Chrome: '#4285F4',
    Safari: '#000000',
    Firefox: '#FF7139',
    Edge: '#0078D7',
    Opera: '#FF1B2D',
    Samsung: '#1428A0',
  };

  const totalByStatus = Object.values(stats?.byStatus || {}).reduce((a, b) => a + b, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-sky-500/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-sky-500 animate-spin"></div>
          </div>
          <p className="text-slate-400 animate-pulse">Raporlar yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="bg-slate-900/50 backdrop-blur-xl border-b border-white/5 px-6 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-sky-500 to-indigo-500 rounded-xl blur opacity-40 group-hover:opacity-60 transition"></div>
              <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">M</div>
            </div>
            <div>
              <h1 className="font-bold text-white text-lg">MIYOMINT</h1>
              <p className="text-sm text-slate-400">Yönetim Paneli</p>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-1 bg-slate-800/50 rounded-2xl p-1">
            <button onClick={() => onNavigate('dashboard')} className="px-5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 font-medium transition-all">
              <span className="flex items-center gap-2">📊 Dashboard</span>
            </button>
            <button onClick={() => onNavigate('submissions')} className="px-5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 font-medium transition-all">
              <span className="flex items-center gap-2">📋 Başvurular</span>
            </button>
            <button onClick={() => onNavigate('reports')} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-medium shadow-lg shadow-sky-500/20">
              <span className="flex items-center gap-2">📈 Raporlar</span>
            </button>
            <button onClick={() => onNavigate('logs')} className="px-5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 font-medium transition-all">
              <span className="flex items-center gap-2">📜 Loglar</span>
            </button>
            <button onClick={() => onNavigate('settings')} className="px-5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 font-medium transition-all">
              <span className="flex items-center gap-2">⚙️ Ayarlar</span>
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 bg-slate-800/50 rounded-xl px-4 py-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <span className="text-white font-medium hidden sm:block">{user?.username}</span>
            </div>
            <button onClick={logout} className="p-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all" title="Çıkış Yap">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
              📈 Detaylı Raporlar
            </h2>
            <p className="text-slate-400 mt-1">Kapsamlı analiz ve istatistikler</p>
          </div>
          <button onClick={fetchStats} className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium transition-all flex items-center gap-2 border border-slate-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Yenile
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: '📊', label: 'Toplam', value: stats?.overview.total || 0, color: 'from-sky-500 to-indigo-600' },
            { icon: '🌟', label: 'Bugün', value: stats?.overview.today || 0, color: 'from-emerald-500 to-teal-600' },
            { icon: '📅', label: 'Bu Hafta', value: stats?.overview.thisWeek || 0, color: 'from-amber-500 to-orange-600' },
            { icon: '📆', label: 'Bu Ay', value: stats?.overview.thisMonth || 0, color: 'from-purple-500 to-pink-600' },
          ].map(stat => (
            <div key={stat.label} className="relative group overflow-hidden">
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-10 rounded-2xl blur-xl group-hover:opacity-20 transition-all`}></div>
              <div className="relative bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-all">
                <div className="flex items-center justify-between">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-2xl shadow-lg`}>
                    {stat.icon}
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-white">{stat.value}</p>
                    <p className="text-xs text-slate-400 mt-1">{stat.label}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
              <span className="text-2xl">🎯</span> Durum Analizi
            </h3>
            <div className="flex items-center justify-center mb-6">
              <div className="relative w-56 h-56">
                <svg viewBox="0 0 100 100" className="transform -rotate-90">
                  {(() => {
                    let offset = 0;
                    return Object.entries(stats?.byStatus || {}).map(([status, count]) => {
                      const percentage = totalByStatus > 0 ? (count / totalByStatus) * 100 : 0;
                      const circumference = 2 * Math.PI * 42;
                      const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
                      const strokeDashoffset = -offset * (circumference / 100);
                      offset += percentage;
                      return (
                        <circle
                          key={status}
                          cx="50"
                          cy="50"
                          r="42"
                          fill="none"
                          stroke={statusConfig[status]?.color || '#64748B'}
                          strokeWidth="16"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                          className="transition-all duration-700"
                        />
                      );
                    });
                  })()}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-4xl font-bold text-white">{totalByStatus}</p>
                    <p className="text-sm text-slate-400">Toplam</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(stats?.byStatus || {}).map(([status, count]) => {
                const percentage = totalByStatus > 0 ? ((count / totalByStatus) * 100).toFixed(1) : '0';
                return (
                  <div key={status} className="flex items-center gap-3 bg-slate-700/30 rounded-xl p-3 border border-white/5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: statusConfig[status]?.color }}></div>
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">{statusConfig[status]?.label}</p>
                      <p className="text-xs text-slate-400">{count} ({percentage}%)</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
              <span className="text-2xl">📅</span> Haftalık Dağılım
            </h3>
            <div className="h-64 flex items-end gap-2">
              {weekdays.map((day, index) => {
                const data = stats?.weekdayDistribution.find(w => w.weekday === index);
                const count = data?.count || 0;
                const maxCount = Math.max(...(stats?.weekdayDistribution.map(w => w.count) || [1]));
                const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                const isToday = new Date().getDay() === index;
                return (
                  <div key={day} className="flex-1 flex flex-col items-center group">
                    <div className="w-full relative">
                      <div
                        className={`w-full rounded-t-lg transition-all duration-300 ${isToday ? 'bg-gradient-to-t from-amber-500 to-yellow-400' : 'bg-gradient-to-t from-sky-500/80 to-indigo-500/80 group-hover:from-sky-400 group-hover:to-indigo-400'}`}
                        style={{ height: `${Math.max(height * 1.8, 8)}px` }}
                      />
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 border border-white/10">
                        {count}
                      </div>
                    </div>
                    <span className={`text-xs mt-3 ${isToday ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>{day.slice(0, 3)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
              <span className="text-2xl">🌍</span> Coğrafi Dağılım
            </h3>
            <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
              {stats?.byCountry.map(({ country, countryCode, count }, index) => {
                const maxCount = Math.max(...(stats?.byCountry.map(c => c.count) || [1]));
                const percentage = (count / maxCount) * 100;
                return (
                  <div key={countryCode} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{countryFlags[countryCode] || '🌍'}</span>
                        <span className="text-white text-sm">{country}</span>
                      </div>
                      <span className="text-white font-bold text-sm">{count}</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
              <span className="text-2xl">🌐</span> Tarayıcılar
            </h3>
            <div className="space-y-4">
              {stats?.byBrowser.slice(0, 6).map(({ browser, count }) => {
                const total = stats?.byBrowser.reduce((a, b) => a + b.count, 0) || 1;
                const percentage = ((count / total) * 100).toFixed(1);
                return (
                  <div key={browser} className="flex items-center gap-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs"
                      style={{ backgroundColor: browserColors[browser] || '#64748B' }}
                    >
                      {browser.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white text-sm">{browser}</span>
                        <span className="text-slate-400 text-xs">{percentage}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%`, backgroundColor: browserColors[browser] || '#64748B' }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
              <span className="text-2xl">💻</span> İşletim Sistemleri
            </h3>
            <div className="space-y-4">
              {stats?.byOS.slice(0, 6).map(({ os, count }) => {
                const total = stats?.byOS.reduce((a, b) => a + b.count, 0) || 1;
                const percentage = ((count / total) * 100).toFixed(1);
                const osIcons: Record<string, string> = { Windows: '🪟', macOS: '🍎', iOS: '📱', Android: '🤖', Linux: '🐧' };
                return (
                  <div key={os} className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center text-xl">
                      {osIcons[os] || '💻'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white text-sm">{os}</span>
                        <span className="text-slate-400 text-xs">{percentage}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
              <span className="text-2xl">🏆</span> En Popüler Hizmetler
            </h3>
            <div className="space-y-4">
              {stats?.byServiceType.slice(0, 8).map(({ serviceType, count }, index) => {
                const maxCount = Math.max(...(stats?.byServiceType.map(s => s.count) || [1]));
                const percentage = (count / maxCount) * 100;
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <div key={serviceType} className="group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{medals[index] || `#${index + 1}`}</span>
                        <span className="text-white">{serviceType}</span>
                      </div>
                      <span className="text-white font-bold">{count}</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full transition-all duration-500 group-hover:from-sky-400 group-hover:to-indigo-400"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
              <span className="text-2xl">⏰</span> Saatlik Aktivite
            </h3>
            <div className="h-56 flex items-end gap-0.5">
              {Array.from({ length: 24 }, (_, hour) => {
                const data = stats?.hourlyDistribution.find(h => h.hour === hour);
                const count = data?.count || 0;
                const maxCount = Math.max(...(stats?.hourlyDistribution.map(h => h.count) || [1]));
                const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                const isNow = new Date().getHours() === hour;
                return (
                  <div key={hour} className="flex-1 group relative">
                    <div
                      className={`w-full rounded-t transition-all duration-300 ${isNow ? 'bg-gradient-to-t from-amber-500 to-yellow-400' : 'bg-gradient-to-t from-purple-500/60 to-pink-500/60 hover:from-purple-400 hover:to-pink-400'}`}
                      style={{ height: `${Math.max(height, 4)}%` }}
                    />
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 border border-white/10">
                      {hour}:00 - {count}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-3 text-xs text-slate-500">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>23:00</span>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <USMap data={stats?.byUSState || []} />
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
