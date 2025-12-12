import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'submissions', label: 'Submissions' },
  { id: 'logs', label: 'Logs' },
  { id: 'professionals', label: 'Professionals' },
  { id: 'partners', label: 'Partners' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'automations', label: 'Automations' },
  { id: 'users', label: 'Users' },
  { id: 'settings', label: 'Settings' },
  { id: 'distribution-logs', label: 'Distribution' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const currentPage = location.pathname.replace(/^\//, '') || 'dashboard';

  const handleNavigate = (page: string) => {
    navigate(page === 'dashboard' ? '/dashboard' : `/${page}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="bg-slate-900/50 backdrop-blur-xl border-b border-white/5 px-6 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-sky-500 to-indigo-500 rounded-xl blur opacity-40 group-hover:opacity-60 transition"></div>
              <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">M</div>
            </div>
            <div className="hidden sm:block">
              <h1 className="font-bold text-white text-lg">MIYOMINT</h1>
              <p className="text-sm text-slate-400 hidden sm:block">Admin Panel</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 bg-slate-800/50 rounded-2xl p-1">
            {NAV_ITEMS.map((item) => {
              const isActive = currentPage === item.id;
              return (
                <NavLink
                  key={item.id}
                  to={item.id === 'dashboard' ? '/dashboard' : `/${item.id}`}
                  className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-lg shadow-sky-500/20'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-2">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
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

      <main className="admin-routed">
        <Outlet />
      </main>

      <div className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 px-3 py-2 backdrop-blur">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {NAV_ITEMS.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
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
