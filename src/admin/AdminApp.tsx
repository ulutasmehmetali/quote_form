import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminSubmissions from './pages/AdminSubmissions';
import AdminReports from './pages/AdminReports';
import AdminLogs from './pages/AdminLogs';
import AdminSettings from './pages/AdminSettings';
import AdminProfessionals from './pages/AdminProfessionals';
import AdminUsers from './pages/AdminUsers';
import AdminWebhooks from './pages/AdminWebhooks';
import AdminPartners from './pages/AdminPartners';
import AdminDistributionLogs from './pages/AdminDistributionLogs';
import AdminAutomations from './pages/AdminAutomations';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'submissions', label: 'Basvurular' },
  { id: 'reports', label: 'Raporlar' },
  { id: 'logs', label: 'Loglar' },
  { id: 'professionals', label: 'Profesyoneller' },
  { id: 'partners', label: 'Partnerler' },
  { id: 'webhooks', label: 'Webhook' },
  { id: 'automations', label: 'Otomasyonlar' },
  { id: 'users', label: 'Kullanicilar' },
  { id: 'settings', label: 'Ayarlar' },
  { id: 'distribution-logs', label: 'Dagitim' },
];

function AdminContent() {
  const { user, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState(() => {
    if (typeof window === 'undefined') return 'dashboard';
    const hash = window.location.hash?.replace('#', '');
    return hash || 'dashboard';
  });
  const initialPageRef = useRef(currentPage);

  const navigate = useCallback((page: string, { replace = false } = {}) => {
    setCurrentPage(page);
    if (typeof window === 'undefined') return;
    const targetHash = `#${page}`;
    if (replace) {
      window.history.replaceState({ adminPage: page }, '', targetHash);
    } else {
      window.history.pushState({ adminPage: page }, '', targetHash);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initialPage = initialPageRef.current;
    const initialHash = window.location.hash || `#${initialPage}`;
    window.history.replaceState({ adminPage: initialPage }, '', initialHash);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'd':
            e.preventDefault();
            navigate('dashboard');
            break;
          case 's':
            e.preventDefault();
            navigate('submissions');
            break;
          case 'r':
            e.preventDefault();
            navigate('reports');
            break;
          case 'l':
            e.preventDefault();
            navigate('logs');
            break;
          case 'p':
            e.preventDefault();
            navigate('professionals');
            break;
          case 'a':
            e.preventDefault();
            navigate('automations');
            break;
        }
      }
    };

    const handlePopState = (event: PopStateEvent) => {
      const nextPage = event.state?.adminPage || window.location.hash.replace('#', '') || 'dashboard';
      setCurrentPage(nextPage);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [navigate]);

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  }, []);

  const pageComponent = useMemo(() => {
    switch (currentPage) {
      case 'submissions':
        return <AdminSubmissions onNavigate={navigate} />;
      case 'reports':
        return <AdminReports onNavigate={navigate} />;
      case 'logs':
        return <AdminLogs onNavigate={navigate} />;
      case 'settings':
        return <AdminSettings onNavigate={navigate} />;
      case 'professionals':
        return <AdminProfessionals onNavigate={navigate} />;
      case 'users':
        return <AdminUsers onNavigate={navigate} />;
      case 'webhooks':
        return <AdminWebhooks onNavigate={navigate} />;
      case 'partners':
        return <AdminPartners onNavigate={navigate} />;
      case 'automations':
        return <AdminAutomations onNavigate={navigate} />;
      case 'distribution-logs':
        return <AdminDistributionLogs onNavigate={navigate} />;
      default:
        return <AdminDashboard onNavigate={navigate} />;
    }
  }, [currentPage, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-sky-500/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-sky-500 animate-spin"></div>
            <div
              className="absolute inset-2 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin"
              style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
            ></div>
          </div>
          <p className="text-slate-400 animate-pulse">Yukleniyor...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AdminLogin onLoginSuccess={() => navigate('dashboard', { replace: true })} />;
  }

  return (
    <div className="relative min-h-screen bg-slate-950 text-white pb-28">
      {currentPage !== 'dashboard' && (
        <button
          type="button"
          onClick={handleBack}
          className="hidden lg:flex items-center gap-2 fixed top-6 left-6 z-50 rounded-full bg-slate-900/80 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-black/40 backdrop-blur"
        >
          <ArrowLeft className="w-4 h-4" />
          Geri
        </button>
      )}
      {currentPage !== 'dashboard' && (
        <button
          type="button"
          onClick={handleBack}
          className="md:hidden fixed top-4 left-4 z-50 flex items-center gap-2 rounded-full bg-slate-900/80 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-black/40 backdrop-blur"
        >
          Geri
        </button>
      )}
      {pageComponent}
      <div className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 px-3 py-2 backdrop-blur">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {NAV_ITEMS.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className={`flex-shrink-0 rounded-2xl px-3 py-2 text-[11px] font-semibold transition ${
                  isActive
                    ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-lg shadow-sky-500/30'
                    : 'bg-white/5 text-slate-200 hover:bg-white/10'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function AdminApp() {
  return (
    <AuthProvider>
      <AdminContent />
    </AuthProvider>
  );
}
