import { useState, useEffect } from 'react';
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

function AdminContent() {
  const { user, isLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'd': e.preventDefault(); setCurrentPage('dashboard'); break;
          case 's': e.preventDefault(); setCurrentPage('submissions'); break;
          case 'r': e.preventDefault(); setCurrentPage('reports'); break;
          case 'l': e.preventDefault(); setCurrentPage('logs'); break;
          case 'p': e.preventDefault(); setCurrentPage('professionals'); break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-sky-500/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-sky-500 animate-spin"></div>
            <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          </div>
          <p className="text-slate-400 animate-pulse">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AdminLogin onLoginSuccess={() => setCurrentPage('dashboard')} />;
  }

  switch (currentPage) {
    case 'submissions':
      return <AdminSubmissions onNavigate={setCurrentPage} />;
    case 'reports':
      return <AdminReports onNavigate={setCurrentPage} />;
    case 'logs':
      return <AdminLogs onNavigate={setCurrentPage} />;
    case 'settings':
      return <AdminSettings onNavigate={setCurrentPage} />;
    case 'professionals':
      return <AdminProfessionals onNavigate={setCurrentPage} />;
    case 'users':
      return <AdminUsers onNavigate={setCurrentPage} />;
    case 'webhooks':
      return <AdminWebhooks onNavigate={setCurrentPage} />;
    case 'partners':
      return <AdminPartners onNavigate={setCurrentPage} />;
    case 'distribution-logs':
      return <AdminDistributionLogs onNavigate={setCurrentPage} />;
    default:
      return <AdminDashboard onNavigate={setCurrentPage} />;
  }
}

export default function AdminApp() {
  return (
    <AuthProvider>
      <AdminContent />
    </AuthProvider>
  );
}
