import { useState, useEffect } from 'react';

import { useAuth } from '../context/AuthContext';

import { apiUrl } from '../../lib/api';



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



interface SubmissionFallback {

  id: number;

  name?: string;

  serviceType?: string;

  status?: string;

  country?: string | null;

  countryCode?: string | null;

  createdAt?: string;

}

type AccessLog = {
  id: string;
  sessionId: string | null;
  userIp: string | null;
  country: string | null;
  city: string | null;
  path: string | null;
  method: string | null;
  referer: string | null;
  enteredAt: string | null;
  leftAt: string | null;
  createdAt: string | null;
};



interface AdminLogsProps {

  onNavigate: (page: string) => void;

}



const actionConfig: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  login_success: { icon: '✅', label: 'Login Success', color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/30' },
  login_failed: { icon: '❌', label: 'Login Failed', color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30' },
  logout: { icon: '🚪', label: 'Logout', color: 'text-slate-400', bg: 'bg-slate-500/20 border-slate-500/30' },
  view_submission: { icon: '📝', label: 'View', color: 'text-blue-400', bg: 'bg-blue-500/20 border-blue-500/30' },
  update_submission: { icon: '🔄', label: 'Update', color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/30' },
  delete_submission: { icon: '🗑️', label: 'Delete', color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30' },
  add_note: { icon: '🗒️', label: 'Add Note', color: 'text-purple-400', bg: 'bg-purple-500/20 border-purple-500/30' },
  change_password: { icon: '🔐', label: 'Password Change', color: 'text-indigo-400', bg: 'bg-indigo-500/20 border-indigo-500/30' },
};



export default function AdminLogs({ onNavigate }: AdminLogsProps) {

  const { logout, user, getAuthHeaders } = useAuth();

  const [logs, setLogs] = useState<ActivityLog[]>([]);

  const [recentSubmissions, setRecentSubmissions] = useState<SubmissionFallback[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  const [filterAction, setFilterAction] = useState('all');

  const [filterEntityType, setFilterEntityType] = useState('all');

  const [page, setPage] = useState(1);

  const [totalPages, setTotalPages] = useState(1);

  const [total, setTotal] = useState(0);

  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [accessFilters, setAccessFilters] = useState({
    ip: '',
    country: '',
    city: '',
    path: '',
  });



  useEffect(() => {

    fetchLogs();

  }, [filterAction, filterEntityType, page]);



  const fetchRecentSubmissions = async () => {

    try {

      const params = new URLSearchParams({

        limit: '5',

        sortBy: 'createdAt',

        sortOrder: 'desc',

      });

      const res = await fetch(apiUrl(`/api/admin/submissions?${params}`), {

        headers: getAuthHeaders(),

        credentials: 'include',

      });

      if (!res.ok) {

        throw new Error('Failed to load fallback submissions');

      }

      const payload = await res.json();

      const submissions = Array.isArray(payload?.submissions) ? payload.submissions : [];

      setRecentSubmissions(submissions);

    } catch (error) {

      console.error('Failed to load fallback submissions:', error);

      setRecentSubmissions([]);

    }

  };



  const fetchLogs = async () => {

    setIsLoading(true);

    try {

      const params = new URLSearchParams({

        page: page.toString(),

        limit: '30',

        action: filterAction,

        entityType: filterEntityType,

      });

      

      const res = await fetch(apiUrl(`/api/admin/logs?${params}`), {

        headers: getAuthHeaders(),

        credentials: 'include',

      });

      const data = await res.json();

      if (!res.ok) {

        throw new Error(data?.error || 'Failed to load logs');

      }

      const pagination = data?.pagination || { totalPages: 1, total: 0 };

      const fetchedLogs = Array.isArray(data?.logs) ? data.logs : [];

      setLogs(fetchedLogs);

      setTotalPages(pagination.totalPages || 1);

      setTotal(pagination.total || 0);

      if (fetchedLogs.length === 0) {

        await fetchRecentSubmissions();

      } else {

        setRecentSubmissions([]);

      }

    } catch (error) {
      console.error('Failed to fetch logs:', error);
      setLogs([]);
      await fetchRecentSubmissions();
    } finally {
      setIsLoading(false);
    }
  };



  const fetchAccessLogs = async () => {

    setAccessLoading(true);

    setAccessError('');

    try {

      const res = await fetch(apiUrl('/api/admin/access-logs?limit=200'), {

        headers: getAuthHeaders(),

        credentials: 'include',

      });

      const data = await res.json();

      if (!res.ok) {

        throw new Error(data?.error || 'Failed to load access logs');

      }

      const payload = Array.isArray(data?.logs) ? data.logs : [];

      setAccessLogs(payload);

    } catch (error) {
      console.error('Failed to fetch access logs:', error);
      setAccessError((error as any)?.message || 'Failed to load access logs');
      setAccessLogs([]);
    } finally {
      setAccessLoading(false);
    }
  };


  const formatTimeAgo = (dateString: string) => {

    const date = new Date(dateString);

    const now = new Date();

    const diffMs = now.getTime() - date.getTime();

    const diffMins = Math.floor(diffMs / 60000);

    const diffHours = Math.floor(diffMs / 3600000);

    const diffDays = Math.floor(diffMs / 86400000);



    if (diffMins < 1) return 'Just now';

    if (diffMins < 60) return `${diffMins} min ago`;

    if (diffHours < 24) return `${diffHours} hours ago`;

    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US');

  };

  const formatDateTime = (value?: string | null) => {

    if (!value) return '—';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleString('en-US');

  };

  const filteredAccessLogs = accessLogs.filter((log) => {
    const matches = (value: string | null, filter: string) =>
      !filter || (value || '').toLowerCase().includes(filter.toLowerCase());
    return (
      matches(log.userIp, accessFilters.ip) &&
      matches(log.country, accessFilters.country) &&
      matches(log.city, accessFilters.city) &&
      matches(log.path, accessFilters.path)
    );
  });

  const exportAccessLogs = () => {
    const rows = filteredAccessLogs.map((log) => ({
      id: log.id,
      sessionId: log.sessionId || '',
      userIp: log.userIp || '',
      country: log.country || '',
      city: log.city || '',
      path: log.path || '',
      method: log.method || '',
      referer: log.referer || '',
      enteredAt: log.enteredAt || log.createdAt || '',
      leftAt: log.leftAt || '',
    }));
    const header = Object.keys(rows[0] || {}).join(',');
    const body = rows
      .map((r) =>
        Object.values(r)
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');
    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `access-logs-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };



  const actions = Object.keys(actionConfig);

  const entityTypes = ['admin', 'submission'];



  return (

    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">

      <header data-admin-page-chrome className="bg-slate-900/50 backdrop-blur-xl border-b border-white/5 px-6 py-4 sticky top-0 z-40">

        <div className="max-w-7xl mx-auto flex items-center justify-between">

          <div className="flex items-center gap-4">

            <div className="relative group">

              <div className="absolute -inset-1 bg-gradient-to-r from-sky-500 to-indigo-500 rounded-xl blur opacity-40 group-hover:opacity-60 transition"></div>

              <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">M</div>

            </div>

            <div>

              <h1 className="font-bold text-white text-lg">MIYOMINT</h1>
              <p className="text-sm text-slate-400 hidden sm:block">Admin Panel</p>

            </div>

          </div>

          

          <nav className="hidden md:flex items-center gap-1 bg-slate-800/50 rounded-2xl p-1">

            <button onClick={() => onNavigate('dashboard')} className="px-5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 font-medium transition-all">

              <span className="flex items-center gap-2">📊 Dashboard</span>

            </button>

            <button onClick={() => onNavigate('submissions')} className="px-5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 font-medium transition-all">

              <span className="flex items-center gap-2">📋 Submissions</span>

            </button>

            <button onClick={() => onNavigate('logs')} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-medium shadow-lg shadow-sky-500/20">

              <span className="flex items-center gap-2">🗂 Logs</span>

            </button>

            <button onClick={() => onNavigate('settings')} className="px-5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 font-medium transition-all">

              <span className="flex items-center gap-2">⚙️ Settings</span>

            </button>

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



      <main className="max-w-7xl mx-auto px-6 py-8">

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">

          <div>

            <h2 className="text-3xl font-bold text-white flex items-center gap-3">

              🗃 Activity Logs

            </h2>

            <p className="text-slate-400 mt-1">{total} activities recorded</p>

          </div>

          <div className="flex items-center gap-3">

            <button

              onClick={fetchAccessLogs}

              disabled={accessLoading}

              className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white text-sm hover:bg-slate-700/60 disabled:opacity-60"

            >

              {accessLoading ? 'Loading IP logs...' : 'Access Logs'}

            </button>

            <select

              value={filterAction}

              onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}

              className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white focus:outline-none focus:border-sky-500/50 text-sm"

            >

              <option value="all">All Actions</option>

              {actions.map(a => (

                <option key={a} value={a}>{actionConfig[a]?.icon} {actionConfig[a]?.label}</option>

              ))}

            </select>

            <select

              value={filterEntityType}

              onChange={(e) => { setFilterEntityType(e.target.value); setPage(1); }}

              className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white focus:outline-none focus:border-sky-500/50 text-sm"

            >

              <option value="all">All Types</option>

              {entityTypes.map(t => (

                <option key={t} value={t}>{t === 'admin' ? 'Admin' : 'Submission'}</option>

              ))}

            </select>

          </div>

        </div>



        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">

          {[

            { icon: '🔐', label: 'Logins', count: logs.filter(l => l.action === 'login_success').length, color: 'from-emerald-500 to-teal-600' },

            { icon: '🖥️', label: 'Views', count: logs.filter(l => l.action === 'view_submission').length, color: 'from-blue-500 to-indigo-600' },

            { icon: '✏️', label: 'Updates', count: logs.filter(l => l.action === 'update_submission').length, color: 'from-amber-500 to-orange-600' },

            { icon: '🗒️', label: 'Notes', count: logs.filter(l => l.action === 'add_note').length, color: 'from-purple-500 to-pink-600' },

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

        <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-lg font-semibold text-white">Access Logs (IP)</h3>
              <p className="text-slate-400 text-sm">Recent visits with IP, country, city, and entry/exit times.</p>
            </div>
            {accessLogs.length > 0 && (
              <span className="text-xs text-slate-400 bg-white/5 px-3 py-1 rounded-full">
                Showing {filteredAccessLogs.length} of {accessLogs.length} records
              </span>
            )}
          </div>
          {accessError && <p className="text-sm text-red-300 mb-3">{accessError}</p>}
          {accessLoading ? (
            <div className="py-6 text-slate-400 text-sm">Loading access logs...</div>
          ) : accessLogs.length === 0 ? (
            <p className="text-slate-500 text-sm">Click “Access Logs” above to load recent visit data.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-3 mb-3">
                <input
                  value={accessFilters.ip}
                  onChange={(e) => setAccessFilters({ ...accessFilters, ip: e.target.value })}
                  placeholder="Filter IP"
                  className="px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-sm text-white"
                />
                <input
                  value={accessFilters.country}
                  onChange={(e) => setAccessFilters({ ...accessFilters, country: e.target.value })}
                  placeholder="Filter country"
                  className="px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-sm text-white"
                />
                <input
                  value={accessFilters.city}
                  onChange={(e) => setAccessFilters({ ...accessFilters, city: e.target.value })}
                  placeholder="Filter city"
                  className="px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-sm text-white"
                />
                <input
                  value={accessFilters.path}
                  onChange={(e) => setAccessFilters({ ...accessFilters, path: e.target.value })}
                  placeholder="Filter path"
                  className="px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-sm text-white"
                />
                <button
                  onClick={() => setAccessFilters({ ip: '', country: '', city: '', path: '' })}
                  className="px-3 py-2 rounded-lg bg-slate-800/60 border border-white/10 text-sm text-white"
                >
                  Clear filters
                </button>
                <button
                  onClick={exportAccessLogs}
                  className="px-3 py-2 rounded-lg bg-sky-600 text-white text-sm hover:bg-sky-500"
                >
                  Export CSV
                </button>
              </div>
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-slate-400">
                    <tr>
                      <th className="px-2 py-2">IP</th>
                      <th className="px-2 py-2">Country</th>
                      <th className="px-2 py-2">City</th>
                      <th className="px-2 py-2">Path</th>
                      <th className="px-2 py-2">Entered</th>
                      <th className="px-2 py-2">Left</th>
                    </tr>
                  </thead>
                  <tbody className="text-white divide-y divide-white/5">
                    {filteredAccessLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-2 py-2 font-mono text-xs">{log.userIp || '—'}</td>
                        <td className="px-2 py-2">{log.country || 'Unknown'}</td>
                        <td className="px-2 py-2">{log.city || 'Unknown'}</td>
                        <td className="px-2 py-2 text-slate-300">{log.path || '—'} {log.method ? `(${log.method})` : ''}</td>
                        <td className="px-2 py-2 text-slate-300">{formatDateTime(log.enteredAt || log.createdAt)}</td>
                        <td className="px-2 py-2 text-slate-300">{formatDateTime(log.leftAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
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

                const config = actionConfig[log.action] || { icon: '📂', label: log.action, color: 'text-slate-400', bg: 'bg-slate-500/20 border-slate-500/30' };

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

                              {log.entityType === 'admin' ? 'Admin' : 'Submission'}

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

                        <div className="text-xs text-slate-500">{new Date(log.createdAt).toLocaleTimeString('en-US')}</div>

                      </div>

                    </div>

                  </div>

                );

              })}

              {logs.length === 0 && (

                <div className="px-6 py-16 text-center">

                  <div className="text-6xl mb-4">⚠️</div>

                  <p className="text-slate-400 text-lg">No logs found</p>

                  <p className="text-slate-500 text-sm mt-1">Try adjusting your filters</p>

                </div>

              )}

            </div>



            {logs.length === 0 && recentSubmissions.length > 0 && (

              <div className="px-6 py-6 border-t border-white/5 bg-slate-900/40">

                <div className="flex items-center justify-between mb-4">

                  <p className="text-sm font-semibold text-white">Recent submissions (log table empty)</p>

                  <span className="text-xs text-slate-400">{recentSubmissions.length} records</span>

                </div>

                <div className="space-y-3">

                  {recentSubmissions.map((sub) => {

                    const label = sub.serviceType || 'Unknown';

                    const timestamp = sub.createdAt ? new Date(sub.createdAt).toLocaleString('en-US') : 'Zaman yok';

                    return (

                      <div key={sub.id} className="flex items-center justify-between rounded-xl bg-slate-800/60 px-4 py-3 border border-white/5">

                        <div>

                          <p className="text-white font-medium">{sub.name || 'No name'}</p>

                          <p className="text-slate-400 text-xs">{label}</p>

                        </div>

                        <div className="text-right text-xs text-slate-500">

                          <p>{sub.country || sub.countryCode || 'No country'}</p>

                          <p className="text-[11px]">{timestamp}</p>

                        </div>

                      </div>

                    );

                  })}

                </div>

              </div>

            )}\r\n            {totalPages > 1 && (

              <div className="flex items-center justify-center gap-2 p-6 border-t border-white/5">

                <button onClick={() => setPage(1)} disabled={page === 1} className="px-4 py-2 rounded-xl bg-slate-700/50 text-slate-300 disabled:opacity-50 hover:bg-slate-700 transition-all text-sm font-medium">First</button>

                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-xl bg-slate-700/50 text-slate-300 disabled:opacity-50 hover:bg-slate-700 transition-all text-sm font-medium">Previous</button>

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

                  {actionConfig[selectedLog.action]?.icon || '📂'}

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

                  <label className="text-xs text-slate-500">Action</label>

                  <p className={`mt-1 inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${actionConfig[selectedLog.action]?.bg} ${actionConfig[selectedLog.action]?.color}`}>

                    {actionConfig[selectedLog.action]?.icon} {actionConfig[selectedLog.action]?.label}

                  </p>

                </div>

                <div className="bg-slate-700/30 rounded-xl p-4 border border-white/5">

                  <label className="text-xs text-slate-500">Entity Type</label>

                  <p className="font-medium text-white mt-1 capitalize">{selectedLog.entityType === 'admin' ? 'Admin' : 'Submission'}</p>

                </div>

                <div className="bg-slate-700/30 rounded-xl p-4 border border-white/5">

                  <label className="text-xs text-slate-500">Entity ID</label>

                  <p className="font-medium text-white mt-1">{selectedLog.entityId || 'Yok'}</p>

                </div>

                <div className="bg-slate-700/30 rounded-xl p-4 border border-white/5">

                  <label className="text-xs text-slate-500">Admin</label>

                  <p className="font-medium text-white mt-1">{selectedLog.adminUsername || 'Sistem'}</p>

                </div>

                <div className="bg-slate-700/30 rounded-xl p-4 border border-white/5">

                  <label className="text-xs text-slate-500">IP Adresi</label>

                  <p className="font-mono text-white mt-1 text-sm">{selectedLog.ipAddress || 'Unknown'}</p>

                </div>

                <div className="bg-slate-700/30 rounded-xl p-4 border border-white/5">

                  <label className="text-xs text-slate-500">Zaman</label>

                  <p className="font-medium text-white mt-1">{new Date(selectedLog.createdAt).toLocaleString('en-US')}</p>

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

