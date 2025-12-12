import { useState, useEffect, useRef } from 'react';



import { useAuth } from '../context/AuthContext';



import USMap, { usaStateNames } from '../components/USMap';



import { apiUrl } from '../../lib/api';
import DailyTopCategoriesChart from '../../components/charts/DailyTopCategoriesChart';
import HourlyActivityChart from '../../components/charts/HourlyActivityChart';
interface Stats {



  overview: {



    total: number;



    today: number;



    thisWeek: number;



    thisMonth: number;



    avgPerDay: number;



  };



  weeklyTrendService: { serviceType: string; count: number } | null;



  completionRate: number;



  byStatus: Record<string, number>;



  byServiceType: Array<{ serviceType: string; count: number }>;



  byCountry: Array<{ country: string | null; countryCode: string | null; count: number }>;



  byBrowser: Array<{ browser: string; count: number }>;



  byDeviceType: Array<{ deviceType: string; count: number }>;



  byOS: Array<{ os: string; count: number }>;



  byUSState: Array<{ state: string; count: number }>;



  dailyTrend: Array<{ date: string; count: number }>;



  hourlyActivity: Array<{ hour: number; count: number; avg_session_duration: number | null }>;



  weekdayDistribution: Array<{ weekday: number; count: number }>;



  partialDrafts: number;



  newStatusBuckets: {
    fresh: number;
    today: number;
    yesterday: number;
    older: number;
  };

  topDeviceModels: Record<string, { model: string; count: number }>;

}







interface RecentSubmission {



  id: number;



  name: string;



  service_type?: string;



  serviceType?: string;



  email?: string;



  status: string;



  country?: string | null;



  country_code?: string | null;



  countryCode?: string | null;



  created_at?: string;



  createdAt?: string;



  device?: string | null;



  device_type?: string | null;



  deviceType?: string | null;



}







interface AdminDashboardProps {



  onNavigate: (page: string) => void;



}







const COUNTRY_CODE_ALIASES: Record<string, string> = {



  'UNITED STATES': 'US',



  'UNITED STATES OF AMERICA': 'US',



  'U.S.': 'US',



  'USA': 'US',



  'AMERICA': 'US',



  'US': 'US',



  'UNITED KINGDOM': 'GB',



  'UK': 'GB',



  'GREAT BRITAIN': 'GB',



  'BRITAIN': 'GB',



  'TURKEY': 'TR',



  'TURKIYE': 'TR',





  'RUSSIA': 'RU',



  'SOUTH KOREA': 'KR',



  'KOREA, SOUTH': 'KR',



  'NORTH KOREA': 'KP',



  'KOREA, NORTH': 'KP',



  'UAE': 'AE',



  'UNITED ARAB EMIRATES': 'AE',



  'SAUDI ARABIA': 'SA',



  'UKRAINE': 'UA',



};







const resolveCountryCode = (countryCode?: string | null, countryName?: string | null) => {



  const sanitize = (value?: string | null) => (typeof value === 'string' ? value.trim().toUpperCase() : '');



  const codeCandidate = sanitize(countryCode);



  if (codeCandidate) {



    if (/^[A-Z]{2}$/.test(codeCandidate)) {



      return codeCandidate;



    }



    if (COUNTRY_CODE_ALIASES[codeCandidate]) {



      return COUNTRY_CODE_ALIASES[codeCandidate];



    }



  }



  const nameCandidate = sanitize(countryName);



  if (nameCandidate) {



    if (COUNTRY_CODE_ALIASES[nameCandidate]) {



      return COUNTRY_CODE_ALIASES[nameCandidate];



    }



    if (/^[A-Z]{2}$/.test(nameCandidate)) {



      return nameCandidate;



    }



  }



  return undefined;



};







const toFlagEmoji = (code?: string | null) => {

  if (!code || code.length !== 2) return '🌍';

  const normalized = code.toUpperCase();



  const offset = 0x1f1e6;



  const chars = [...normalized];



  if (!chars.every((char) => char >= 'A' && char <= 'Z')) {



    return '???';



  }



  return chars.map((char) => String.fromCodePoint(offset + char.charCodeAt(0) - 65)).join('');



};







const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];






const stateNameToCode: Record<string, string> = Object.entries(usaStateNames).reduce((acc, [code, label]) => {



  acc[label.toLowerCase()] = code;



  return acc;



}, {} as Record<string, string>);







const EMPTY_STATS: Stats = {



  overview: { total: 0, today: 0, thisWeek: 0, thisMonth: 0, avgPerDay: 0 },



  weeklyTrendService: null,



  completionRate: 0,



  byStatus: {},



  byServiceType: [],



  byCountry: [],



  byBrowser: [],



  byDeviceType: [],



  byOS: [],



  byUSState: [],



  dailyTrend: [],



  hourlyActivity: [],



  weekdayDistribution: [],



  partialDrafts: 0,



  newStatusBuckets: {
    fresh: 0,
    today: 0,
    yesterday: 0,
    older: 0,
  },

  topDeviceModels: {},

};







export default function AdminDashboard({ onNavigate }: AdminDashboardProps) {



  const { logout, user, getAuthHeaders } = useAuth();



  const [stats, setStats] = useState<Stats>(EMPTY_STATS);



  const [recentSubmissions, setRecentSubmissions] = useState<RecentSubmission[]>([]);



  const [isLoading, setIsLoading] = useState(true);



  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());



  const [showNotification, setShowNotification] = useState(false);



  const [newCount, setNewCount] = useState(0);



  const [isRefreshing, setIsRefreshing] = useState(false);



  const prevTotalRef = useRef<number>(0);







  const fetchStats = async () => {



    setIsRefreshing(true);



    try {



      const headers = getAuthHeaders();



      const [statsRes, submissionsRes] = await Promise.all([



        fetch(apiUrl('/api/admin/stats'), { headers, credentials: 'include' }),



        fetch(apiUrl('/api/admin/submissions?limit=5&sortBy=createdAt&sortOrder=desc'), { headers, credentials: 'include' }),



      ]);







      const statsData = statsRes.ok ? await statsRes.json() : null;



      const submissionsData = submissionsRes.ok ? await submissionsRes.json() : null;







      const resolvedStats = statsData ? { ...EMPTY_STATS, ...statsData } : EMPTY_STATS;







      if (prevTotalRef.current > 0 && resolvedStats.overview.total > prevTotalRef.current) {



        setNewCount(resolvedStats.overview.total - prevTotalRef.current);



        setShowNotification(true);



        setTimeout(() => setShowNotification(false), 5000);



      }



      prevTotalRef.current = resolvedStats.overview.total;







      const recentList = (Array.isArray(submissionsData)



        ? submissionsData



        : submissionsData?.submissions ?? []) as RecentSubmission[];



      const normalizedRecent = recentList.map((sub) => ({



        ...sub,



        service_type: sub.service_type || sub.serviceType,



        country_code: sub.country_code || sub.countryCode,



        created_at: sub.created_at || sub.createdAt,



      }));







      setStats(resolvedStats);



      setRecentSubmissions(normalizedRecent);



      setLastUpdate(new Date());



    } catch (error) {



      console.error('Failed to fetch stats:', error);



      setStats(EMPTY_STATS);



      setRecentSubmissions([]);



    } finally {



      setIsRefreshing(false);



      setIsLoading(false);



    }



  };







  useEffect(() => {



    fetchStats();



    const interval = setInterval(fetchStats, 30000);



    return () => clearInterval(interval);



  }, []);







  const statusConfig: Record<string, { color: string; bg: string; icon: string; label?: string }> = {

    new: { color: 'text-blue-600', bg: 'bg-blue-500/10', icon: '🆕', label: 'New' },

    'new-fresh': { color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: '🟢', label: 'New (<3h)' },

    'new-today': { color: 'text-sky-400', bg: 'bg-sky-500/10', icon: '⏱️', label: 'Today (3-24h)' },

    'new-yesterday': { color: 'text-amber-400', bg: 'bg-amber-500/10', icon: '🕰️', label: 'Yesterday (24-48h)' },

    'new-older': { color: 'text-purple-400', bg: 'bg-purple-500/10', icon: '🗂️', label: 'Older (>48h)' },

    contacted: { color: 'text-amber-600', bg: 'bg-amber-500/10', icon: '📞', label: 'Contacted' },

    in_progress: { color: 'text-purple-600', bg: 'bg-purple-500/10', icon: '⚙️', label: 'In progress' },

    completed: { color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: '✅', label: 'Completed' },

    cancelled: { color: 'text-red-600', bg: 'bg-red-500/10', icon: '❌', label: 'Cancelled' },

  };

  const NEW_BUCKET_LABELS: Record<string, string> = {
    fresh: 'New (<3 saat)',
    today: 'Today (3-24h)',
    yesterday: 'Yesterday (24-48h)',
    older: 'Older (>48h)',
  };

  const NEW_SEGMENT_COLORS: Record<string, string> = {
    fresh: '#22C55E',
    today: '#0EA5E9',
    yesterday: '#F97316',
    older: '#A855F7',
  };

  const computeNewBucketKey = (createdAt?: string) => {
    if (!createdAt) return 'older';
    const parsed = new Date(createdAt);
    if (Number.isNaN(parsed.getTime())) return 'older';
    const diff = Date.now() - parsed.getTime();
    if (diff <= 3 * 60 * 60 * 1000) return 'fresh';
    if (diff <= 24 * 60 * 60 * 1000) return 'today';
    if (diff <= 48 * 60 * 60 * 1000) return 'yesterday';
    return 'older';
  };

  const deriveStatusKey = (status: string, createdAt?: string) => {
    if (status === 'new') {
      return `new-${computeNewBucketKey(createdAt)}`;
    }
    return status;
  };

  const prettyStatusLabel = (status: string, createdAt?: string) => {
    if (status.startsWith('new-')) {
      const bucket = status.replace('new-', '');
      return NEW_BUCKET_LABELS[bucket] || 'New';
    }
    return statusConfig[status]?.label || status.replace('_', ' ');
  };

  const deviceIcons: Record<string, { icon: string; color: string }> = {



    desktop: { icon: '🖥️', color: 'from-slate-500 to-slate-700' },



    mobile: { icon: '📱', color: 'from-sky-500 to-blue-600' },



    tablet: { icon: '📲', color: 'from-purple-500 to-indigo-600' },



  };







  const browserColors: Record<string, string> = {



    Chrome: '#4285F4',



    Safari: '#0EA5E9',



    Firefox: '#FF7139',



    Edge: '#0078D7',



    Opera: '#FF1B2D',



    Samsung: '#1428A0',



  };



  const formatUSHour = (hour: number) =>



    new Intl.DateTimeFormat('en-US', {



      hour: '2-digit',



      minute: undefined,



      hour12: false,



      timeZone: 'America/New_York',



    }).format(new Date(Date.UTC(2023, 0, 1, hour)));







  const formatDuration = (seconds?: number | null) => {



    if (!seconds) return '0s';



    const mins = Math.floor(seconds / 60);



    const secs = Math.round(seconds % 60);



    return `${mins}dk ${secs}s`;



  };







  const nowUSHour = parseInt(



    new Intl.DateTimeFormat('en-US', {



      hour: '2-digit',



      hour12: false,



      timeZone: 'America/New_York',



    }).format(new Date()),



    10



  );







  const rawCountryData = Array.isArray(stats.byCountry) ? stats.byCountry : [];

  const aggregatedCountryMap = new Map<string, { country: string; countryCode: string | null; count: number }>();

  rawCountryData.forEach((entry) => {

    const count = Number(entry.count ?? 0);

    if (count <= 0) return;

    const normalizedCode = resolveCountryCode(entry.countryCode ?? undefined, entry.country ?? undefined);

    const labelCandidate = entry.country || (normalizedCode ? undefined : 'Unknown');

    const label = labelCandidate || normalizedCode || 'Unknown';

    const key = (normalizedCode || label).toUpperCase();

    const existing = aggregatedCountryMap.get(key);

    aggregatedCountryMap.set(key, {

      country: label,

      countryCode: normalizedCode || existing?.countryCode || (label.length === 2 ? label : null),

      count: (existing?.count || 0) + count,

    });

  });

  const countryData = Array.from(aggregatedCountryMap.values()).sort((a, b) => b.count - a.count);

  const countryMax = countryData.length ? Math.max(...countryData.map((c) => c.count)) : 1;

  const topBrowsers = (Array.isArray(stats.byBrowser) ? [...stats.byBrowser] : []).sort((a, b) => b.count - a.count).slice(0, 6);



  const popularServices = (Array.isArray(stats.byServiceType) ? [...stats.byServiceType] : []).sort((a, b) => b.count - a.count);






  const usStateData = (Array.isArray(stats.byUSState) ? stats.byUSState : [])



    .map(({ state, count }) => {



      const normalized = typeof state === 'string' ? state.trim() : '';



      const code =



        normalized.length === 2



          ? normalized.toUpperCase()



          : stateNameToCode[normalized.toLowerCase()] || normalized;



      return { state: code, count };



    })



    .filter((entry) => entry.state && entry.count > 0);











  if (isLoading) {



    return (



      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">



        <div className="text-center">



          <div className="relative w-20 h-20 mx-auto mb-4">



            <div className="absolute inset-0 rounded-full border-4 border-sky-500/20"></div>



            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-sky-500 animate-spin"></div>



            <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>



          </div>



          <p className="text-slate-400 animate-pulse">Loading data...</p>


        </div>



      </div>



    );



  }







  const totalDevices = stats.byDeviceType.reduce((a, b) => a + b.count, 0) || 1;



  const avgDaily = typeof stats.overview.avgPerDay === 'number'
    ? stats.overview.avgPerDay.toFixed(1)
    : '0.0';

  const totalSubmissions = stats.overview.total || 0;
  const partialDrafts = stats.partialDrafts || 0;
  const completionRate = (() => {
    const denom = totalSubmissions + partialDrafts;
    if (!denom) return '0.0';
    return ((totalSubmissions / denom) * 100).toFixed(1);
  })();
  const completedCount = totalSubmissions;

  const incompleteCount = Math.max(totalSubmissions - completedCount, 0);



  const weeklyServiceName = stats.weeklyTrendService?.serviceType || 'No service yet';


  const weeklyServiceCount = stats.weeklyTrendService?.count || 0;



  const partialRatio = totalSubmissions ? ((partialDrafts / totalSubmissions) * 100).toFixed(1) : '0.0';

  const newBucketCounts = stats.newStatusBuckets || { fresh: 0, today: 0, yesterday: 0, older: 0 };

  const initialStatusSegments = [

    { key: 'new-fresh', label: NEW_BUCKET_LABELS.fresh, count: newBucketCounts.fresh, color: NEW_SEGMENT_COLORS.fresh },

    { key: 'new-today', label: NEW_BUCKET_LABELS.today, count: newBucketCounts.today, color: NEW_SEGMENT_COLORS.today },

    { key: 'new-yesterday', label: NEW_BUCKET_LABELS.yesterday, count: newBucketCounts.yesterday, color: NEW_SEGMENT_COLORS.yesterday },

    { key: 'new-older', label: NEW_BUCKET_LABELS.older, count: newBucketCounts.older, color: NEW_SEGMENT_COLORS.older },

  ].filter((segment) => segment.count > 0);

  const STATUS_COLOR_PALETTE: Record<string, string> = {

    contacted: '#F59E0B',

    in_progress: '#8B5CF6',

    completed: '#10B981',

    cancelled: '#EF4444',

  };

  const otherStatusSegments = Object.entries(stats.byStatus || {})

    .filter(([status]) => status !== 'new')

    .map(([status, count]) => ({

      key: status,

      label: prettyStatusLabel(status),

      count,

      color: STATUS_COLOR_PALETTE[status] || '#64748B',

    }))

    .filter((segment) => segment.count > 0);

  const combinedStatusSegments = [...initialStatusSegments, ...otherStatusSegments];

  const totalByStatus = combinedStatusSegments.reduce((sum, segment) => sum + (segment.count || 0), 0);

  const hourlyPeakEntry = (stats.hourlyActivity || []).reduce<{ hour: number; count: number } | null>((prev, current) => {

    if (!prev || current.count > prev.count) return current;

    return prev;

  }, null);

  const peakHourLabel = hourlyPeakEntry ? formatUSHour(hourlyPeakEntry.hour) : '—';

  const peakHourCount = hourlyPeakEntry ? hourlyPeakEntry.count : 0;







  return (



    <div className="min-h-screen pb-24 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">



      {showNotification && (



        <div className="fixed top-4 right-4 z-50 animate-slide-in">



          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3">



            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl">🎉</div>



            <div>



              <p className="font-bold">{newCount} New Submission!</p>



              <p className="text-sm text-white/80">New submission(s) just arrived</p>


            </div>



          </div>
        </div>

      )}







      <header data-admin-page-chrome className="bg-slate-900/50 backdrop-blur-xl border-b border-white/5 px-6 py-4 sticky top-0 z-40">



        <div className="max-w-7xl mx-auto flex items-center justify-between">



          <div className="flex items-center gap-4">



            <div className="relative group">



              <div className="absolute -inset-1 bg-gradient-to-r from-sky-500 to-indigo-500 rounded-xl blur opacity-40 group-hover:opacity-60 transition"></div>



              <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">



                M



              </div>



            </div>



            <div className="hidden sm:block">
              <h1 className="font-bold text-white text-lg">MIYOMINT</h1>
              <p className="text-sm text-slate-400 hidden sm:block">Admin Panel</p>
            </div>



          </div>







          <nav className="hidden md:flex items-center gap-1 bg-slate-800/50 rounded-2xl p-1">



            <button onClick={() => onNavigate('dashboard')} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-medium shadow-lg shadow-sky-500/20">



              <span className="flex items-center gap-2">📊 Dashboard</span>



            </button>



            <button onClick={() => onNavigate('submissions')} className="px-5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 font-medium transition-all">



              <span className="flex items-center gap-2">📋 Submissions</span>



            </button>






            <button onClick={() => onNavigate('logs')} className="px-5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 font-medium transition-all">



              <span className="flex items-center gap-2">📜 Logs</span>



            </button>



            <button onClick={() => onNavigate('settings')} className="px-5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 font-medium transition-all">



              <span className="flex items-center gap-2">⚙️ Settings</span>



            </button>



          </nav>







          <div className="flex items-center gap-4">



            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-400">



              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>



              <span>Last update: {lastUpdate.toLocaleTimeString('tr-TR')}</span>


            </div>



            <div className="flex items-center gap-3 bg-slate-800/50 rounded-xl px-4 py-2">



              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">



                {user?.username?.charAt(0).toUpperCase()}



              </div>



              <span className="text-white font-medium hidden sm:block">{user?.username}</span>



            </div>



            <button onClick={logout} className="p-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all" title="Log Out">


              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">



                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />



              </svg>



            </button>



          </div>

        </div>



      </header>







      <main className="max-w-7xl mx-auto px-6 py-8 pb-16">



        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">



          <div>



            <h2 className="text-3xl font-bold text-white">Welcome! 👋</h2>



            <p className="text-slate-400 mt-1">Here is today’s summary and performance metrics</p>


          </div>



          <div className="flex items-center gap-3">



            <button onClick={fetchStats} className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium transition-all flex items-center gap-2 border border-slate-700">



              <span className="flex items-center gap-2">



                {isRefreshing ? (



                  <span className="inline-block h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />



                ) : (



                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">



                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />



                  </svg>



                )}



                {isRefreshing ? 'Newleniyor' : 'Newle'}


              </span>



            </button>



            <button onClick={() => onNavigate('submissions')} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-medium shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 transition-all flex items-center gap-2">



              All Submissions



              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">



                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />



              </svg>



            </button>



          </div>

        </div>







        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">



          <div className="group relative overflow-hidden">



            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/20 to-indigo-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all"></div>



            <div className="relative bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:border-sky-500/30 transition-all">



              <div className="flex items-center justify-between mb-4">



                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-2xl shadow-lg shadow-sky-500/30">



                  📊



                </div>



                <div className="text-right">



                  <p className="text-3xl font-bold text-white">{stats.overview.total || 0}</p>



                  <p className="text-xs text-slate-400 mt-1">Total Submissions</p>



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



                  <p className="text-3xl font-bold text-white">{stats.overview.today || 0}</p>



                  <p className="text-xs text-slate-400 mt-1">Today</p>



                </div>



              </div>



              <div className="flex items-center gap-2 text-emerald-400 text-sm">



                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">



                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />



                </svg>



                <span>Average: {avgDaily}/day</span>



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







                  <p className="text-3xl font-bold text-white">{stats.overview.thisWeek || 0}</p>







                  <p className="text-xs text-slate-400 mt-1">Last 7 days</p>







                </div>







              </div>







              <div className="flex items-center gap-3 text-sm text-amber-100">







                <span className="text-white font-semibold">{weeklyServiceName}</span>







                {weeklyServiceCount > 0 && (



                  <span className="text-slate-400">({weeklyServiceCount} submission)</span>



                )}







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



                  <p className="text-3xl font-bold text-white">{completionRate}%</p>



                  <p className="text-xs text-slate-400 mt-1">Tamamlanma</p>



                </div>



              </div>



            <div className="h-1 bg-slate-700 rounded-full overflow-hidden">



              <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" style={{ width: `${completionRate}%` }}></div>



            </div>



            <div className="flex items-center justify-between mt-3 text-xs text-slate-400">



              <span>Tamamlanan: {completedCount}</span>



              <span>Partial form: {partialDrafts}</span>



            </div>



          </div>



        </div>



        </div>







        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

          <div className="lg:col-span-2">
            <DailyTopCategoriesChart />
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">



            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">



              <span className="text-2xl">🎯</span> Status Distribution



            </h3>



            <div className="relative w-48 h-48 mx-auto mb-6">



              <svg viewBox="0 0 100 100" className="transform -rotate-90">



                {(() => {

                  let offset = 0;

                  return combinedStatusSegments.map((segment) => {

                    const percentage = totalByStatus > 0 ? (segment.count / totalByStatus) * 100 : 0;

                    const circumference = 2 * Math.PI * 40;

                    const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;

                    const strokeDashoffset = -offset * (circumference / 100);

                    offset += percentage;

                    return (

                      <circle

                        key={segment.key}

                        cx="50"

                        cy="50"

                        r="40"

                        fill="none"

                        stroke={segment.color || '#64748B'}

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



              {combinedStatusSegments.map((segment) => {
                const percentage = totalByStatus > 0 ? ((segment.count / totalByStatus) * 100).toFixed(1) : '0.0';
                return (
                <div key={segment.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: segment.color || '#94A3B8' }}></span>
                    <span className="text-slate-300 text-sm">{segment.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold">{segment.count}</span>
                    <span className="text-slate-500 text-xs">({percentage}%)</span>
                  </div>
                </div>);
              })}

            </div>



          </div>



        </div>







        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">



          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">



            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">



              <span className="text-2xl">🌍</span> Country Distribution



            </h3>



            <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">



              {countryData.slice(0, 10).map(({ country, countryCode, count }) => {



                const percentage = countryMax > 0 ? (count / countryMax) * 100 : 0;



                const resolvedCountryCode = countryCode || resolveCountryCode(countryCode ?? undefined, country ?? undefined);



                const flagIcon = toFlagEmoji(resolvedCountryCode);



                return (



                  <div key={countryCode} className="group">



                    <div className="flex items-center justify-between mb-1">



                <div className="flex items-center gap-2">

                  <span className="text-xl">{flagIcon}</span>

                  <span className="text-slate-300 text-sm">{country || countryCode || 'Unknown'}</span>

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



              {countryData.length === 0 && (



                <p className="text-slate-500 text-center py-8">No location data yet</p>



              )}



            </div>



          </div>







          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">



            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">



              <span className="text-2xl">📱</span> Device & Browser



            </h3>



            <div className="grid grid-cols-3 gap-3 mb-6">



              {stats.byDeviceType.map(({ deviceType, count }) => {



                const percentage = ((count / totalDevices) * 100).toFixed(0);



                const config = deviceIcons[deviceType] || { icon: '📱', color: 'from-slate-500 to-slate-600' };



                return (



                  <div key={deviceType} className="bg-slate-700/50 rounded-xl p-4 text-center group hover:bg-slate-700 transition-all">



                    <div className="text-3xl mb-2">{config.icon}</div>



                    <p className="text-2xl font-bold text-white">{percentage}%</p>



                    <p className="text-xs text-slate-400 capitalize">{deviceType}</p>

                    <p className="text-[11px] text-slate-400 mt-1">
                      {stats.topDeviceModels?.[deviceType]?.model || 'Model bilgisi yok'}
                    </p>



                  </div>



                );



              })}



            </div>



            <div className="border-t border-white/5 pt-4">



              <p className="text-sm text-slate-400 mb-3">Browsers</p>



              <div className="flex flex-wrap gap-2">



                {topBrowsers.map(({ browser, count }) => (



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







          <div className="bg-transparent">
            <HourlyActivityChart />
          </div>

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">



          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">



            <div className="flex items-center justify-between mb-6">



              <h3 className="text-lg font-bold text-white flex items-center gap-2">



                <span className="text-2xl">🏆</span> Popular Services



              </h3>



            </div>



            <div className="space-y-4">



              {popularServices.slice(0, 6).map(({ serviceType, count }, index) => {



                const maxCount = popularServices.length ? popularServices[0].count : 1;



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



                <span className="text-2xl">📋</span> Recent Submissions



              </h3>



              <button onClick={() => onNavigate('submissions')} className="text-sky-400 hover:text-sky-300 text-sm font-medium">



                See All →



              </button>



            </div>



            <div className="space-y-3">



              {recentSubmissions.map((sub) => {



                const serviceTypeLabel = sub.service_type || sub.serviceType || 'Unknown';



                const deviceTypeLabel = sub.deviceType || sub.device_type || 'Unknown';



                const deviceModelLabel = sub.device || 'Model bilgisi yok';



                const normalizedSubmissionCode = resolveCountryCode(sub.countryCode ?? undefined, sub.country ?? undefined) ?? resolveCountryCode(sub.country_code ?? undefined, sub.country ?? undefined);





                const flagIcon = toFlagEmoji(normalizedSubmissionCode);



                const countryLabel = sub.country || sub.countryCode || 'Unknown';



                                const createdAtValue = sub.created_at || sub.createdAt;


                const statusKey = deriveStatusKey(sub.status, createdAtValue);


                const statusTheme = statusConfig[statusKey] || statusConfig[sub.status] || statusConfig.new;


                const statusLabelText = prettyStatusLabel(statusKey, createdAtValue);


                const dateObject = createdAtValue ? new Date(createdAtValue) : null;


                const formattedDate
                = dateObject && !Number.isNaN(dateObject.getTime())
                ? dateObject.toLocaleDateString('en-US')
                : '—';

                const formattedTime
                = dateObject && !Number.isNaN(dateObject.getTime())
                ? dateObject.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                : '—';







                return (



                  <div



                    key={sub.id}



                    className="flex items-center justify-between p-3 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 transition-all group cursor-pointer"



                    onClick={() => onNavigate('submissions')}



                  >



                    <div className="flex items-center gap-3">



                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">



                      {(sub.name || ' - ')[0]?.toUpperCase() || ' - '}



                    </div>



                      <div>



                        <p className="text-white font-medium text-sm">{sub.name}</p>



                        <p className="text-slate-400 text-xs">{serviceTypeLabel}</p>

                        <p className="text-slate-500 text-[11px] pt-1">Cihaz: {deviceTypeLabel} · {deviceModelLabel}</p>



                      </div>



                    </div>



                    <div className="flex items-center gap-3">



                      <span className="text-lg">{flagIcon}</span>

                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusTheme.color} ${statusTheme.bg}`}>
                        {statusTheme.icon} {statusLabelText}
                      </span>

                      <div className="flex flex-col items-end leading-tight">
                        <span className="text-slate-400 text-xs uppercase">{countryLabel}</span>
                        <span className="text-slate-500 text-xs">{formattedDate}</span>
                        <span className="text-slate-500 text-[11px]">{formattedTime}</span>
                      </div>



                    </div>



                  </div>



                );



              })}



              {recentSubmissions.length === 0 && (



                <p className="text-slate-500 text-center py-8">No submissions yet</p>



              )}



            </div>



          </div>



        </div>



        <div className="mt-8">



          <USMap data={usStateData} />



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


















