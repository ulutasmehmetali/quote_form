import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useMemo, useState } from 'react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'submissions', label: 'Submissions' },
  { id: 'logs', label: 'Logs' },
  { id: 'settings', label: 'Settings' },
  { id: 'distribution-logs', label: 'Distribution' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPalette, setShowPalette] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [showMore, setShowMore] = useState(false);

  const currentPage = location.pathname.replace(/^\//, '') || 'dashboard';
  const currentLabel = useMemo(
    () => NAV_ITEMS.find((n) => currentPage.startsWith(n.id))?.label || 'Admin',
    [currentPage],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowPalette((v) => !v);
      }
      if (e.key === 'Escape') setShowPalette(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleNavigate = (page: string) => {
    navigate(page === 'dashboard' ? '/dashboard' : `/${page}`);
    setShowPalette(false);
    setShowMore(false);
  };

  const filteredPaletteItems = NAV_ITEMS.filter((item) =>
    item.label.toLowerCase().includes(paletteQuery.toLowerCase()),
  );

  const primaryNav = NAV_ITEMS.slice(0, 4);
  const overflowNav = NAV_ITEMS.slice(4);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="bg-slate-900/50 backdrop-blur-xl border-b border-white/5 px-6 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-sky-500 to-indigo-500 rounded-xl blur opacity-40 group-hover:opacity-60 transition"></div>
              <div className="relative px-4 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-lg whitespace-nowrap">
                Admin Panel
              </div>
            </div>
          </div>

          <nav className="hidden md:flex flex-1 min-w-0 overflow-x-auto bg-slate-800/50 rounded-2xl p-1 items-center">
            <div className="flex items-center gap-2 pr-2 flex-nowrap min-w-max">
              {primaryNav.map((item) => {
                const isActive = currentPage === item.id;
                return (
                  <NavLink
                    key={item.id}
                    to={item.id === 'dashboard' ? '/dashboard' : `/${item.id}`}
                    className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-lg shadow-sky-500/20'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="flex items-center gap-2">{item.label}</span>
                  </NavLink>
                );
              })}
              {overflowNav.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowMore((v) => !v)}
                    className="px-3 py-2 rounded-xl font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-all"
                  >
                    More
                  </button>
                  {showMore && (
                    <div className="absolute right-0 mt-2 bg-slate-900/95 border border-white/10 rounded-xl shadow-2xl p-2 min-w-[160px]">
                      {overflowNav.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleNavigate(item.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                            currentPage === item.id
                              ? 'bg-sky-500/20 text-white'
                              : 'text-slate-200 hover:bg-white/5'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </nav>

          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden md:flex flex-col text-right mr-2">
              <span className="text-xs uppercase tracking-wide text-slate-400">Page</span>
              <span className="text-sm font-semibold text-white">{currentLabel}</span>
            </div>
            <div className="flex items-center gap-3 bg-slate-800/50 rounded-xl px-4 py-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <span className="text-white font-medium hidden sm:block">{user?.username}</span>
            </div>
            <button
              onClick={() => setShowPalette(true)}
              className="px-3 py-2 rounded-xl bg-white/5 text-slate-200 hover:bg-white/10 text-sm font-semibold transition"
              title="Command palette (Ctrl/Cmd + K)"
            >
              Search
            </button>
            <button onClick={logout} className="p-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all" title="Log Out">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {showPalette && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-24 px-4" onClick={() => setShowPalette(false)}>
          <div
            className="w-full max-w-lg bg-slate-900 rounded-2xl border border-white/10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-white/5 px-4 py-3">
              <input
                autoFocus
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                placeholder="Type to jump to a page…"
                className="w-full bg-slate-800 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 outline-none"
              />
            </div>
            <div className="max-h-80 overflow-y-auto">
              {filteredPaletteItems.length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-500">No matches.</div>
              ) : (
                filteredPaletteItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    className="w-full text-left px-4 py-3 hover:bg-white/5 text-slate-100 text-sm flex items-center justify-between"
                  >
                    <span>{item.label}</span>
                    <span className="text-xs text-slate-500">{item.id}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

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
