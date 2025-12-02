import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

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
}

interface RecentSubmission {
  id: number;
  name: string;
  email: string;
  serviceType: string;
  status: string;
  country: string | null;
  countryCode: string | null;
  createdAt: string;
}

interface AdminDashboardProps {
  onNavigate: (page: string) => void;
}

const countryFlags: Record<string, string> = {
  US: '🇺🇸', TR: '🇹🇷', DE: '🇩🇪', GB: '🇬🇧', FR: '🇫🇷', ES: '🇪🇸', IT: '🇮🇹',
  NL: '🇳🇱', BE: '🇧🇪', AT: '🇦🇹', CH: '🇨🇭', PL: '🇵🇱', CZ: '🇨🇿', RU: '🇷🇺',
  UA: '🇺🇦', JP: '🇯🇵', CN: '🇨🇳', KR: '🇰🇷', IN: '🇮🇳', BR: '🇧🇷', MX: '🇲🇽',
  CA: '🇨🇦', AU: '🇦🇺', NZ: '🇳🇿', ZA: '🇿🇦', AE: '🇦🇪', SA: '🇸🇦', EG: '🇪🇬',
};

const weekdays = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

export default function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const { logout, user, getAuthHeaders } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentSubmissions, setRecentSubmissions] = useState<RecentSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [showNotification, setShowNotification] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const prevTotalRef = useRef<number>(0);

  const fetchStats = async () => {
    try {
      const headers = getAuthHeaders();
      const [statsRes, submissionsRes] = await Promise.all([
        fetch('/api/admin/stats', { headers, credentials: 'include' }),
        fetch('/api/admin/submissions?limit=5&sortBy=createdAt&sortOrder=desc', { headers, credentials: 'include' }),
      ]);
      
      const statsData = await statsRes.json();
      const submissionsData = await submissionsRes.json();
      
      if (prevTotalRef.current > 0 && statsData.overview.total > prevTotalRef.current) {
        setNewCount(statsData.overview.total - prevTotalRef.current);
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 5000);
      }
      prevTotalRef.current = statsData.overview.total;
      
      setStats(statsData);
      setRecentSubmissions(submissionsData.submissions);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const statusConfig: Record<string, { color: string; bg: string; icon: string }> = {
    new: { color: 'text-blue-600', bg: 'bg-blue-500', icon: '🆕' },
    contacted: { color: 'text-amber-600', bg: 'bg-amber-500', icon: '📞' },
    in_progress: { color: 'text-purple-600', bg: 'bg-purple-500', icon: '⚙️' },
    completed: { color: 'text-emerald-600', bg: 'bg-emerald-500', icon: '✅' },
    cancelled: { color: 'text-red-600', bg: 'bg-red-500', icon: '❌' },
  };

  const deviceIcons: Record<string, { icon: string; color: string }> = {
    desktop: { icon: '🖥️', color: 'from-slate-500 to-slate-700' },
    mobile: { icon: '📱', color: 'from-sky-500 to-blue-600' },
    tablet: { icon: '📲', color: 'from-purple-500 to-indigo-600' },
  };

  const browserColors: Record<string, string> = {
    Chrome: '#4285F4',
    Safari: '#000000',
    Firefox: '#FF7139',
    Edge: '#0078D7',
    Opera: '#FF1B2D',
    Samsung: '#1428A0',
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-sky-500/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-sky-500 animate-spin"></div>
            <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          </div>
          <p className="text-slate-400 animate-pulse">Veriler yükleniyor...</p>
        </div>
      </div>
    );
  }

  const totalByStatus = Object.values(stats?.byStatus || {}).reduce((a, b) => a + b, 0);
  const totalDevices = stats?.byDeviceType.reduce((a, b) => a + b.count, 0) || 1;
  const conversionRate = totalByStatus > 0 ? ((stats?.byStatus.completed || 0) / totalByStatus * 100).toFixed(1) : '0';
  const avgDaily = stats?.overview.thisMonth ? (stats.overview.thisMonth / 30).toFixed(1) : '0';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {showNotification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl">🎉</div>
            <div>
              <p className="font-bold">{newCount} Yeni Başvuru!</p>
              <p className="text-sm text-white/80">Az önce yeni başvuru(lar) geldi</p>
            </div>
          </div>
        </div>
      )}

      <header className="bg-slate-900/50 backdrop-blur-xl border-b border-white/5 px-6 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-sky-500 to-indigo-500 rounded-xl blur opacity-40 group-hover:opacity-60 transition"></div>
              <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                M
              </div>
            </div>
            <div>
              <h1 className="font-bold text-white text-lg">MIYOMINT</h1>
              <p className="text-sm text-slate-400">Yönetim Paneli</p>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-1 bg-slate-800/50 rounded-2xl p-1">
            <button onClick={() => onNavigate('dashboard')} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-medium shadow-lg shadow-sky-500/20">
              <span className="flex items-center gap-2">📊 Dashboard</span>
            </button>
            <button onClick={() => onNavigate('submissions')} className="px-5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 font-medium transition-all">
              <span className="flex items-center gap-2">📋 Başvurular</span>
            </button>
            <button onClick={() => onNavigate('reports')} className="px-5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 font-medium transition-all">
              <span className="flex items-center gap-2">📈 Raporlar</span>
            </button>
            <button onClick={() => onNavigate('logs')} className="px-5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 font-medium transition-all">
              <span className="flex items-center gap-2">📜 Loglar</span>
            </button>
            <button onClick={() => onNavigate('settings')} className="px-5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 font-medium transition-all">
              <span className="flex items-center gap-2">⚙️ Ayarlar</span>
            </button>
          </nav>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-400">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span>Son güncelleme: {lastUpdate.toLocaleTimeString('tr-TR')}</span>
            </div>
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white">Hoş Geldiniz! 👋</h2>
            <p className="text-slate-400 mt-1">İşte bugünün özeti ve performans metrikleri</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchStats} className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium transition-all flex items-center gap-2 border border-slate-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Yenile
            </button>
            <button onClick={() => onNavigate('submissions')} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-medium shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 transition-all flex items-center gap-2">
              Tüm Başvurular
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/20 to-indigo-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all"></div>
            <div className="relative bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:border-sky-500/30 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-2xl shadow-lg shadow-sky-500/30">
                  📊
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-white">{stats?.overview.total || 0}</p>
                  <p className="text-xs text-slate-400 mt-1">Toplam Başvuru</p>
                </div>
              </div>
              <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all"></div>
            <div className="relative bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:border-emerald-500/30 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-2xl shadow-lg shadow-emerald-500/30">
                  🌟
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-white">{stats?.overview.today || 0}</p>
                  <p className="text-xs text-slate-400 mt-1">Bugün</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-emerald-400 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span>Ortalama: {avgDaily}/gün</span>
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all"></div>
            <div className="relative bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:border-amber-500/30 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-2xl shadow-lg shadow-amber-500/30">
                  📅
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-white">{stats?.overview.thisWeek || 0}</p>
                  <p className="text-xs text-slate-400 mt-1">Bu Hafta</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-amber-400 text-sm">
                <span>📈 Haftalık trend aktif</span>
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all"></div>
            <div className="relative bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:border-purple-500/30 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-2xl shadow-lg shadow-purple-500/30">
                  ✅
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-white">{conversionRate}%</p>
                  <p className="text-xs text-slate-400 mt-1">Tamamlanma</p>
                </div>
              </div>
              <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" style={{ width: `${conversionRate}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="text-2xl">📈</span> Son 30 Günlük Trend
              </h3>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500"></div>
                Günlük Başvuru
              </div>
            </div>
            <div className="h-64 flex items-end gap-1 relative">
              <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-slate-500 pr-2">
                {[100, 75, 50, 25, 0].map((val) => (
                  <span key={val}>{Math.round((Math.max(...(stats?.dailyTrend.map(d => d.count) || [1])) * val / 100))}</span>
                ))}
              </div>
              <div className="flex-1 flex items-end gap-0.5 ml-8">
                {stats?.dailyTrend.map((day, index) => {
                  const maxCount = Math.max(...(stats?.dailyTrend.map(d => d.count) || [1]));
                  const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                  const isToday = index === stats.dailyTrend.length - 1;
                  return (
                    <div key={index} className="flex-1 group relative">
                      <div
                        className={`w-full rounded-t transition-all duration-300 ${isToday ? 'bg-gradient-to-t from-emerald-500 to-teal-400' : 'bg-gradient-to-t from-sky-500/80 to-indigo-500/80 hover:from-sky-400 hover:to-indigo-400'}`}
                        style={{ height: `${Math.max(height, 3)}%` }}
                      />
                      <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-xl border border-white/10">
                        <div className="font-bold">{day.count} başvuru</div>
                        <div className="text-slate-400">{new Date(day.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
              <span className="text-2xl">🎯</span> Durum Dağılımı
            </h3>
            <div className="relative w-48 h-48 mx-auto mb-6">
              <svg viewBox="0 0 100 100" className="transform -rotate-90">
                {(() => {
                  let offset = 0;
                  const entries = Object.entries(stats?.byStatus || {});
                  return entries.map(([status, count], index) => {
                    const percentage = totalByStatus > 0 ? (count / totalByStatus) * 100 : 0;
                    const circumference = 2 * Math.PI * 40;
                    const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
                    const strokeDashoffset = -offset * (circumference / 100);
                    offset += percentage;
                    const colors: Record<string, string> = {
                      new: '#3B82F6',
                      contacted: '#F59E0B',
                      in_progress: '#8B5CF6',
                      completed: '#10B981',
                      cancelled: '#EF4444',
                    };
                    return (
                      <circle
                        key={status}
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke={colors[status] || '#64748B'}
                        strokeWidth="20"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-500"
                      />
                    );
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">{totalByStatus}</p>
                  <p className="text-xs text-slate-400">Toplam</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {Object.entries(stats?.byStatus || {}).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{statusConfig[status]?.icon || '📌'}</span>
                    <span className="text-slate-300 text-sm capitalize">{status.replace('_', ' ')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold">{count}</span>
                    <span className="text-slate-500 text-xs">({totalByStatus > 0 ? ((count / totalByStatus) * 100).toFixed(0) : 0}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
              <span className="text-2xl">🌍</span> Ülke Dağılımı
            </h3>
            <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
              {stats?.byCountry.slice(0, 10).map(({ country, countryCode, count }, index) => {
                const maxCount = Math.max(...(stats?.byCountry.map(c => c.count) || [1]));
                const percentage = (count / maxCount) * 100;
                return (
                  <div key={countryCode} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{countryFlags[countryCode] || '🌍'}</span>
                        <span className="text-slate-300 text-sm">{country}</span>
                      </div>
                      <span className="text-white font-bold">{count}</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500 group-hover:from-emerald-400 group-hover:to-cyan-400"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {(stats?.byCountry.length || 0) === 0 && (
                <p className="text-slate-500 text-center py-8">Henüz konum verisi yok</p>
              )}
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
              <span className="text-2xl">📱</span> Cihaz & Tarayıcı
            </h3>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {stats?.byDeviceType.map(({ deviceType, count }) => {
                const percentage = ((count / totalDevices) * 100).toFixed(0);
                const config = deviceIcons[deviceType] || { icon: '📱', color: 'from-slate-500 to-slate-600' };
                return (
                  <div key={deviceType} className="bg-slate-700/50 rounded-xl p-4 text-center group hover:bg-slate-700 transition-all">
                    <div className="text-3xl mb-2">{config.icon}</div>
                    <p className="text-2xl font-bold text-white">{percentage}%</p>
                    <p className="text-xs text-slate-400 capitalize">{deviceType}</p>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-white/5 pt-4">
              <p className="text-sm text-slate-400 mb-3">Tarayıcılar</p>
              <div className="flex flex-wrap gap-2">
                {stats?.byBrowser.slice(0, 6).map(({ browser, count }) => (
                  <span
                    key={browser}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border"
                    style={{
                      backgroundColor: `${browserColors[browser] || '#64748B'}15`,
                      borderColor: `${browserColors[browser] || '#64748B'}40`,
                      color: browserColors[browser] || '#94A3B8',
                    }}
                  >
                    {browser}: {count}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
              <span className="text-2xl">⏰</span> Saatlik Aktivite
            </h3>
            <div className="h-48 flex items-end gap-0.5">
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
            <div className="flex justify-between mt-2 text-xs text-slate-500">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>23:00</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="text-2xl">🏆</span> Popüler Hizmetler
              </h3>
            </div>
            <div className="space-y-4">
              {stats?.byServiceType.slice(0, 6).map(({ serviceType, count }, index) => {
                const maxCount = Math.max(...(stats?.byServiceType.map(s => s.count) || [1]));
                const percentage = (count / maxCount) * 100;
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <div key={serviceType} className="group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{medals[index] || `#${index + 1}`}</span>
                        <span className="text-slate-300">{serviceType}</span>
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
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="text-2xl">📋</span> Son Başvurular
              </h3>
              <button onClick={() => onNavigate('submissions')} className="text-sky-400 hover:text-sky-300 text-sm font-medium">
                Tümünü Gör →
              </button>
            </div>
            <div className="space-y-3">
              {recentSubmissions.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 transition-all group cursor-pointer" onClick={() => onNavigate('submissions')}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                      {sub.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">{sub.name}</p>
                      <p className="text-slate-400 text-xs">{sub.serviceType}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{countryFlags[sub.countryCode || 'XX'] || '🌍'}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig[sub.status]?.color} bg-white/5`}>
                      {statusConfig[sub.status]?.icon} {sub.status}
                    </span>
                    <span className="text-slate-500 text-xs">
                      {new Date(sub.createdAt).toLocaleDateString('tr-TR')}
                    </span>
                  </div>
                </div>
              ))}
              {recentSubmissions.length === 0 && (
                <p className="text-slate-500 text-center py-8">Henüz başvuru yok</p>
              )}
            </div>
          </div>
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
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
