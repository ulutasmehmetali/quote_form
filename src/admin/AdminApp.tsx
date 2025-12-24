import { useCallback } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
  Outlet,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AdminLayout from './components/AdminLayout';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminSubmissions from './pages/AdminSubmissions';
import AdminLogs from './pages/AdminLogs';
import AdminSettings from './pages/AdminSettings';
import AdminProfessionals from './pages/AdminProfessionals';
import AdminUsers from './pages/AdminUsers';
import AdminWebhooks from './pages/AdminWebhooks';
import AdminPartners from './pages/AdminPartners';
import AdminDistributionLogs from './pages/AdminDistributionLogs';
import AdminAutomations from './pages/AdminAutomations';

type AdminPageComponent = React.ComponentType<{
  onNavigate: (page: string) => void;
}>;

const ADMIN_ROUTES: Array<{ path: string; Component: AdminPageComponent }> = [
  { path: 'dashboard', Component: AdminDashboard },
  { path: 'submissions', Component: AdminSubmissions },
  { path: 'logs', Component: AdminLogs },
  { path: 'professionals', Component: AdminProfessionals },
  { path: 'partners', Component: AdminPartners },
  { path: 'webhooks', Component: AdminWebhooks },
  { path: 'automations', Component: AdminAutomations },
  { path: 'users', Component: AdminUsers },
  { path: 'settings', Component: AdminSettings },
  { path: 'distribution-logs', Component: AdminDistributionLogs },
];

function AdminLoadingScreen() {
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
        <p className="text-slate-400 animate-pulse">Loading...</p>
      </div>
    </div>
  );
}

function PageRenderer({ Component }: { Component: AdminPageComponent }) {
  const navigate = useNavigate();
  const handleNavigate = useCallback(
    (page: string) => {
      const target = page === 'dashboard' ? '/dashboard' : `/${page}`;
      navigate(target);
    },
    [navigate],
  );
  return <Component onNavigate={handleNavigate} />;
}

function RequireAuth() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <AdminLoadingScreen />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

function LoginRoute() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <AdminLogin onLoginSuccess={() => navigate('/dashboard', { replace: true })} />;
}

function AdminRouter() {
  const { isLoading } = useAuth();
  if (isLoading) return <AdminLoadingScreen />;

  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<RequireAuth />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          {ADMIN_ROUTES.map(({ path, Component }) => (
            <Route key={path} path={`/${path}`} element={<PageRenderer Component={Component} />} />
          ))}
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function AdminApp() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/admin">
        <AdminRouter />
      </BrowserRouter>
    </AuthProvider>
  );
}
