import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface ActivityLog {
  id: number;
  action: string;
  entityType: string;
  entityId: number | null;
  adminId: number | null;
  adminUsername: string | null;
  details: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AdminLogsProps {
  onNavigate: (page: string) => void;
}

const actionConfig: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  login_success: { icon: '🔓', label: 'Giriş Başarılı', color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/30' },
  login_failed: { icon: '🚫', label: 'Giriş Başarısız', color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30' },
  logout: { icon: '🚪', label: 'Çıkış', color: 'text-slate-400', bg: 'bg-slate-500/20 border-slate-500/30' },
  view_submission: { icon: '👁️', label: 'Görüntüleme', color: 'text-blue-400', bg: 'bg-blue-500/20 border-blue-500/30' },
  update_submission: { icon: '✏️', label: 'Güncelleme', color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/30' },
  delete_submission: { icon: '🗑️', label: 'Silme', color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30' },
  add_note: { icon: '📝', label: 'Not Ekleme', color: 'text-purple-400', bg: 'bg-purple-500/20 border-purple-500/30' },
  change_password: { icon: '🔑', label: 'Şifre Değiştirme', color: 'text-indigo-400', bg: 'bg-indigo-500/20 border-indigo-500/30' },
};

export default function AdminLogs({ onNavigate }: AdminLogsProps) {
  const { logout, user, getAuthHeaders } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('all');
  const [filterEntityType, setFilterEntityType] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [filterAction, filterEntityType, page]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '30',
        action: filterAction,
        entityType: filterEntityType,
      });
      
      const res = await fetch(`/api/admin/logs?${params}`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      setLogs(data.logs);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Az önce';
    if (diffMins < 60) return `${diffMins} dk önce`;
    if (diffHours < 24) return `${diffHours} saat önce`;
    if (diffDays < 7) return `${diffDays} gün önce`;
    return date.toLocaleDateString('tr-TR');
  };

  const actions = Object.keys(actionConfig);
  const entityTypes = ['admin', 'submission'];

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
            <button onClick={() => onNavigate('reports')} className="px-5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 font-medium transition-all">
              <span className="flex items-center gap-2">📈 Raporlar</span>
            </button>
            <button onClick={() => onNavigate('logs')} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-medium shadow-lg shadow-sky-500/20">
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
              📜 Aktivite Logları
            </h2>
            <p className="text-slate-400 mt-1">{total} aktivite kaydedildi</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={filterAction}
              onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
              className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white focus:outline-none focus:border-sky-500/50 text-sm"
            >
              <option value="all">Tüm İşlemler</option>
              {actions.map(a => (
                <option key={a} value={a}>{actionConfig[a]?.icon} {actionConfig[a]?.label}</option>
              ))}
            </select>
            <select
              value={filterEntityType}
              onChange={(e) => { setFilterEntityType(e.target.value); setPage(1); }}
              className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white focus:outline-none focus:border-sky-500/50 text-sm"
            >
              <option value="all">Tüm Tipler</option>
              {entityTypes.map(t => (
                <option key={t} value={t}>{t === 'admin' ? '👤 Admin' : '📋 Başvuru'}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[
            { icon: '🔓', label: 'Girişler', count: logs.filter(l => l.action === 'login_success').length, color: 'from-emerald-500 to-teal-600' },
            { icon: '👁️', label: 'Görüntülemeler', count: logs.filter(l => l.action === 'view_submission').length, color: 'from-blue-500 to-indigo-600' },
            { icon: '✏️', label: 'Güncellemeler', count: logs.filter(l => l.action === 'update_submission').length, color: 'from-amber-500 to-orange-600' },
            { icon: '📝', label: 'Notlar', count: logs.filter(l => l.action === 'add_note').length, color: 'from-purple-500 to-pink-600' },
          ].map(stat => (
            <div key={stat.label} className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-4 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-2xl shadow-lg`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stat.count}</p>
                <p className="text-xs text-slate-400">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-sky-500/20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-sky-500 animate-spin"></div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl overflow-hidden">
            <div className="divide-y divide-white/5">
              {logs.map((log) => {
                const config = actionConfig[log.action] || { icon: '📋', label: log.action, color: 'text-slate-400', bg: 'bg-slate-500/20 border-slate-500/30' };
                return (
                  <div
                    key={log.id}
                    className="px-6 py-4 hover:bg-white/5 transition-all cursor-pointer group"
                    onClick={() => setSelectedLog(log)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl ${config.bg} border flex items-center justify-center text-2xl group-hover:scale-110 transition-transform`}>
                          {config.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${config.bg} ${config.color}`}>
                              {config.label}
                            </span>
                            <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-700/50 rounded-full">
                              {log.entityType === 'admin' ? '👤' : '📋'} {log.entityType}
                            </span>
                            {log.entityId && (
                              <span className="text-xs text-slate-500 font-mono">
                                #{log.entityId}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-3 text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                                {(log.adminUsername || 'S').charAt(0).toUpperCase()}
                              </div>
                              <span className="text-white font-medium">{log.adminUsername || 'Sistem'}</span>
                            </div>
                            {log.ipAddress && (
                              <span className="text-slate-500 font-mono text-xs px-2 py-0.5 bg-slate-700/30 rounded">
                                {log.ipAddress}
                              </span>
                            )}
                          </div>
                          {log.details && Object.keys(log.details).length > 0 && (
                            <div className="mt-2 text-xs text-slate-500 bg-slate-700/30 rounded-lg px-3 py-1.5 inline-block max-w-md truncate">
                              {JSON.stringify(log.details).substring(0, 80)}
                              {JSON.stringify(log.details).length > 80 && '...'}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm text-slate-300 font-medium">{formatTimeAgo(log.createdAt)}</div>
                        <div className="text-xs text-slate-500">{new Date(log.createdAt).toLocaleTimeString('tr-TR')}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {logs.length === 0 && (
                <div className="px-6 py-16 text-center">
                  <div className="text-6xl mb-4">📭</div>
                  <p className="text-slate-400 text-lg">Log bulunamadı</p>
                  <p className="text-slate-500 text-sm mt-1">Filtrelerinizi değiştirmeyi deneyin</p>
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 p-6 border-t border-white/5">
                <button onClick={() => setPage(1)} disabled={page === 1} className="px-4 py-2 rounded-xl bg-slate-700/50 text-slate-300 disabled:opacity-50 hover:bg-slate-700 transition-all text-sm font-medium">İlk</button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-xl bg-slate-700/50 text-slate-300 disabled:opacity-50 hover:bg-slate-700 transition-all text-sm font-medium">Önceki</button>
                <span className="text-slate-400 text-sm px-4">Sayfa {page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-2 rounded-xl bg-slate-700/50 text-slate-300 disabled:opacity-50 hover:bg-slate-700 transition-all text-sm font-medium">Sonraki</button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-4 py-2 rounded-xl bg-slate-700/50 text-slate-300 disabled:opacity-50 hover:bg-slate-700 transition-all text-sm font-medium">Son</button>
              </div>
            )}
          </div>
        )}
      </main>

      {selectedLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-white/10 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl ${actionConfig[selectedLog.action]?.bg || 'bg-slate-500/20'} border flex items-center justify-center text-3xl`}>
                  {actionConfig[selectedLog.action]?.icon || '📋'}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{actionConfig[selectedLog.action]?.label || selectedLog.action}</h3>
                  <p className="text-sm text-slate-400">Log #{selectedLog.id}</p>
                </div>
              </div>
              <button onClick={() => setSelectedLog(null)} className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-700/30 rounded-xl p-4 border border-white/5">
                  <label className="text-xs text-slate-500">İşlem</label>
                  <p className={`mt-1 inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${actionConfig[selectedLog.action]?.bg} ${actionConfig[selectedLog.action]?.color}`}>
                    {actionConfig[selectedLog.action]?.icon} {actionConfig[selectedLog.action]?.label}
                  </p>
                </div>
                <div className="bg-slate-700/30 rounded-xl p-4 border border-white/5">
                  <label className="text-xs text-slate-500">Varlık Tipi</label>
                  <p className="font-medium text-white mt-1 capitalize">{selectedLog.entityType === 'admin' ? '👤 Admin' : '📋 Başvuru'}</p>
                </div>
                <div className="bg-slate-700/30 rounded-xl p-4 border border-white/5">
                  <label className="text-xs text-slate-500">Varlık ID</label>
                  <p className="font-medium text-white mt-1">{selectedLog.entityId || 'Yok'}</p>
                </div>
                <div className="bg-slate-700/30 rounded-xl p-4 border border-white/5">
                  <label className="text-xs text-slate-500">Admin</label>
                  <p className="font-medium text-white mt-1">{selectedLog.adminUsername || 'Sistem'}</p>
                </div>
                <div className="bg-slate-700/30 rounded-xl p-4 border border-white/5">
                  <label className="text-xs text-slate-500">IP Adresi</label>
                  <p className="font-mono text-white mt-1 text-sm">{selectedLog.ipAddress || 'Bilinmiyor'}</p>
                </div>
                <div className="bg-slate-700/30 rounded-xl p-4 border border-white/5">
                  <label className="text-xs text-slate-500">Zaman</label>
                  <p className="font-medium text-white mt-1">{new Date(selectedLog.createdAt).toLocaleString('tr-TR')}</p>
                </div>
              </div>
              
              {selectedLog.userAgent && (
                <div className="bg-slate-700/30 rounded-xl p-4 border border-white/5">
                  <label className="text-xs text-slate-500">User Agent</label>
                  <p className="font-medium text-slate-300 text-sm mt-2 break-all">{selectedLog.userAgent}</p>
                </div>
              )}

              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div className="bg-slate-700/30 rounded-xl p-4 border border-white/5">
                  <label className="text-xs text-slate-500">Detaylar</label>
                  <pre className="font-mono text-slate-300 text-sm mt-2 overflow-x-auto bg-slate-800/50 rounded-lg p-3">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
