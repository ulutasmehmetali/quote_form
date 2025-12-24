import { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, CheckCircle, XCircle, Clock, AlertCircle, Filter, ChevronLeft, ChevronRight, Eye, RotateCcw } from 'lucide-react';
import { apiUrl } from '../../lib/api';

interface DistributionLog {
  id: number;
  submission_id: number;
  partner_api_id: number;
  partner_name: string;
  partner_url: string;
  status: string;
  attempt_count: number;
  response_status: number | null;
  response_body: string | null;
  error_message: string | null;
  latency_ms: number | null;
  customer_name: string;
  customer_email: string;
  service_type: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface Partner {
  id: number;
  name: string;
}

interface Stats {
  overview: {
    total: number;
    success: number;
    failed: number;
    pending: number;
    today: number;
  };
  byPartner: Array<{
    id: number;
    name: string;
    total: number;
    success: number;
    failed: number;
  }>;
}

interface AdminDistributionLogsProps {
  onNavigate: (page: string) => void;
}

export default function AdminDistributionLogs({ onNavigate }: AdminDistributionLogsProps) {
  const [logs, setLogs] = useState<DistributionLog[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<number | null>(null);
  const [viewingLog, setViewingLog] = useState<DistributionLog | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({
    partnerId: 'all',
    status: 'all',
    dateFrom: '',
    dateTo: '',
  });

  const fetchLogs = async (page = 1) => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pagination.limit),
        ...(filters.partnerId !== 'all' && { partnerId: filters.partnerId }),
        ...(filters.status !== 'all' && { status: filters.status }),
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo }),
      });

      const res = await fetch(apiUrl(`/api/admin/distribution-logs?${params}`), { credentials: 'include' });
      const data = await res.json();
      setLogs(data.logs || []);
      setPagination(prev => ({ ...prev, ...data.pagination }));
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPartners = async () => {
    try {
      const res = await fetch(apiUrl('/api/admin/partners'), { credentials: 'include' });
      const data = await res.json();
      setPartners(data.partners || []);
    } catch (error) {
      console.error('Failed to fetch partners:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(apiUrl('/api/admin/distribution-stats'), { credentials: 'include' });
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchPartners();
    fetchStats();
  }, []);

  useEffect(() => {
    fetchLogs(1);
  }, [filters]);

  const getCSRFToken = () => {
    return document.cookie.split('; ').find(row => row.startsWith('csrf_token='))?.split('=')[1] || '';
  };

  const handleRetry = async (id: number) => {
    setRetrying(id);
    try {
      const res = await fetch(apiUrl(`/api/admin/distribution-logs/${id}/retry`), {
        method: 'POST',
        headers: { 'X-CSRF-Token': getCSRFToken() },
        credentials: 'include',
      });

      if (res.ok) {
        fetchLogs(pagination.page);
        fetchStats();
      }
    } catch (error) {
      console.error('Retry failed:', error);
    } finally {
      setRetrying(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-US');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium">
            <CheckCircle className="w-3 h-3" /> Successful
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-medium">
            <XCircle className="w-3 h-3" /> Failed
          </span>
        );
      case 'pending':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'retrying':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">
            <RefreshCw className="w-3 h-3 animate-spin" /> Retrying
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-slate-500/20 text-slate-400 rounded-full text-xs">{status}</span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('settings')} className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Distribution Logs</h1>
            <p className="text-slate-400 text-sm">Track customer data sent to partner APIs</p>
          </div>
        </div>
        <button
          onClick={() => { fetchLogs(pagination.page); fetchStats(); }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
            <p className="text-slate-400 text-sm">Total</p>
            <p className="text-2xl font-bold text-white">{stats.overview.total}</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
            <p className="text-slate-400 text-sm">Successful</p>
            <p className="text-2xl font-bold text-emerald-400">{stats.overview.success}</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
            <p className="text-slate-400 text-sm">Failed</p>
            <p className="text-2xl font-bold text-red-400">{stats.overview.failed}</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
            <p className="text-slate-400 text-sm">Pending</p>
            <p className="text-2xl font-bold text-amber-400">{stats.overview.pending}</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
            <p className="text-slate-400 text-sm">Today</p>
            <p className="text-2xl font-bold text-sky-400">{stats.overview.today}</p>
          </div>
        </div>
      )}

      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400 text-sm">Filter:</span>
          </div>
          
          <select
            value={filters.partnerId}
            onChange={(e) => setFilters({ ...filters, partnerId: e.target.value })}
            className="px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-sky-500"
          >
            <option value="all">All Partners</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-sky-500"
          >
            <option value="all">All Statuses</option>
            <option value="success">Successful</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>

          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            className="px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-sky-500"
            placeholder="Start"
          />

          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            className="px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-sky-500"
            placeholder="End"
          />

          {(filters.partnerId !== 'all' || filters.status !== 'all' || filters.dateFrom || filters.dateTo) && (
            <button
              onClick={() => setFilters({ partnerId: 'all', status: 'all', dateFrom: '', dateTo: '' })}
              className="px-3 py-2 text-slate-400 hover:text-white text-sm transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No distribution logs yet</h3>
          <p className="text-slate-400">Entries will appear here when data is sent to partner APIs</p>
        </div>
      ) : (
        <>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900/50">
                  <tr>
                    <th className="text-left p-4 text-slate-400 text-sm font-medium">Customer</th>
                    <th className="text-left p-4 text-slate-400 text-sm font-medium">Partner</th>
                    <th className="text-left p-4 text-slate-400 text-sm font-medium">Service</th>
                    <th className="text-left p-4 text-slate-400 text-sm font-medium">Status</th>
                    <th className="text-left p-4 text-slate-400 text-sm font-medium">Latency</th>
                    <th className="text-left p-4 text-slate-400 text-sm font-medium">Date</th>
                    <th className="text-left p-4 text-slate-400 text-sm font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="p-4">
                        <div>
                          <p className="text-white font-medium">{log.customer_name || '-'}</p>
                          <p className="text-slate-400 text-sm">{log.customer_email || '-'}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-sky-400">{log.partner_name}</p>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-slate-700/50 text-slate-300 rounded text-sm">
                          {log.service_type || '-'}
                        </span>
                      </td>
                      <td className="p-4">
                        {getStatusBadge(log.status)}
                        {log.attempt_count > 1 && (
                          <p className="text-slate-500 text-xs mt-1">Attempt: {log.attempt_count}</p>
                        )}
                      </td>
                      <td className="p-4 text-slate-300">
                        {log.latency_ms ? `${log.latency_ms}ms` : '-'}
                      </td>
                      <td className="p-4 text-slate-400 text-sm">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setViewingLog(log)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {log.status === 'failed' && (
                            <button
                              onClick={() => handleRetry(log.id)}
                              disabled={retrying === log.id}
                              className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/20 rounded transition-colors disabled:opacity-50"
                              title="Retry"
                            >
                              {retrying === log.id ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <RotateCcw className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-slate-400 text-sm">
                Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} records
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchLogs(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="p-2 bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-white px-4">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => fetchLogs(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="p-2 bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {viewingLog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700/50 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Distribution Details</h2>
              <button
                onClick={() => setViewingLog(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-slate-400 text-sm mb-1">Customer</h4>
                  <p className="text-white">{viewingLog.customer_name || '-'}</p>
                  <p className="text-slate-400 text-sm">{viewingLog.customer_email || '-'}</p>
                </div>
                <div>
                  <h4 className="text-slate-400 text-sm mb-1">Partner</h4>
                  <p className="text-sky-400">{viewingLog.partner_name}</p>
                  <p className="text-slate-500 text-xs break-all">{viewingLog.partner_url}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <h4 className="text-slate-400 text-sm mb-1">Status</h4>
                  {getStatusBadge(viewingLog.status)}
                </div>
                <div>
                  <h4 className="text-slate-400 text-sm mb-1">HTTP Status</h4>
                  <p className="text-white">{viewingLog.response_status || '-'}</p>
                </div>
                <div>
                  <h4 className="text-slate-400 text-sm mb-1">Latency</h4>
                  <p className="text-white">{viewingLog.latency_ms ? `${viewingLog.latency_ms}ms` : '-'}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-slate-400 text-sm mb-1">Start</h4>
                  <p className="text-white text-sm">{formatDate(viewingLog.started_at)}</p>
                </div>
                <div>
                  <h4 className="text-slate-400 text-sm mb-1">End</h4>
                  <p className="text-white text-sm">{formatDate(viewingLog.completed_at)}</p>
                </div>
              </div>

              <div>
                <h4 className="text-slate-400 text-sm mb-1">Attempt Count</h4>
                <p className="text-white">{viewingLog.attempt_count}</p>
              </div>

              {viewingLog.error_message && (
                <div>
                  <h4 className="text-red-400 text-sm mb-2">Error Message</h4>
                  <pre className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm overflow-x-auto">
                    {viewingLog.error_message}
                  </pre>
                </div>
              )}

              {viewingLog.response_body && (
                <div>
                  <h4 className="text-slate-400 text-sm mb-2">API Response</h4>
                  <pre className="p-4 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-300 text-sm overflow-x-auto max-h-48">
                    {viewingLog.response_body}
                  </pre>
                </div>
              )}

              {viewingLog.status === 'failed' && (
                <div className="pt-4 border-t border-slate-700/50">
                  <button
                    onClick={() => { handleRetry(viewingLog.id); setViewingLog(null); }}
                    disabled={retrying === viewingLog.id}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Retry
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

