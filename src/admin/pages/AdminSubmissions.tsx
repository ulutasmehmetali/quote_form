import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../../lib/api';

const getInitial = (value?: string, fallback = 'S') => {
  const text = (value || fallback).trim();
  return text ? text.charAt(0).toUpperCase() : fallback;
};

interface Submission {
  id: number;
  serviceType: string;
  zipCode: string;
  name: string;
  email: string;
  phone: string;
  answers: Record<string, string | string[] | null>;
  photoUrls: string[];
  status: string;
  notes: string | null;
  ipAddress: string | null;
  country: string | null;
  countryCode: string | null;
  city: string | null;
  region: string | null;
  timezone: string | null;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  device: string | null;
  deviceType: string | null;
  referrer: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Filters {
  countries: Array<{ country: string; countryCode: string }>;
  serviceTypes: string[];
  statuses: string[];
}

interface AdminSubmissionsProps {
  onNavigate: (page: string) => void;
}

const countryFlags: Record<string, string> = {
  US: '🇺🇸', TR: '🇹🇷', DE: '🇩🇪', GB: '🇬🇧', FR: '🇫🇷', ES: '🇪🇸', IT: '🇮🇹',
  NL: '🇳🇱', BE: '🇧🇪', AT: '🇦🇹', CH: '🇨🇭', PL: '🇵🇱', CZ: '🇨🇿', RU: '🇷🇺',
  UA: '🇺🇦', JP: '🇯🇵', CN: '🇨🇳', KR: '🇰🇷', IN: '🇮🇳', BR: '🇧🇷', MX: '🇲🇽',
  CA: '🇨🇦', AU: '🇦🇺', NZ: '🇳🇿', ZA: '🇿🇦', AE: '🇦🇪', SA: '🇸🇦', EG: '🇪🇬',
};

export default function AdminSubmissions({ onNavigate }: AdminSubmissionsProps) {
  const { logout, user, getAuthHeaders } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [submissionNotes, setSubmissionNotes] = useState<any[]>([]);
  
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCountry, setFilterCountry] = useState('all');
  const [filterService, setFilterService] = useState('all');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchSubmissions();
  }, [filterStatus, filterCountry, filterService, filterSearch, filterDateFrom, filterDateTo, page]);

  const fetchFilters = async () => {
    try {
      const res = await fetch(apiUrl('/api/admin/filters'), {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      setFilters(data);
    } catch (error) {
      console.error('Failed to fetch filters:', error);
    }
  };

  const fetchSubmissions = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        status: filterStatus,
        country: filterCountry,
        serviceType: filterService,
        search: filterSearch,
        dateFrom: filterDateFrom,
        dateTo: filterDateTo,
      });
      
      const res = await fetch(apiUrl(`/api/admin/submissions?${params}`), {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = (await res.json()) || {};
      const rows = Array.isArray(data.submissions) ? data.submissions : [];
      if (rows.length === 0) {
        const fallback = await loadFallbackSubmissions();
        if (fallback.length > 0) {
          setSubmissions(fallback);
          setTotalPages(1);
          setTotal(fallback.length);
          setUsedFallback(true);
          return;
        }
      }
      setUsedFallback(false);
      setSubmissions(rows);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || rows.length);
    } catch (error) {
      console.error('Failed to fetch submissions:', error);
      const fallback = await loadFallbackSubmissions();
      if (fallback.length > 0) {
        setSubmissions(fallback);
        setTotalPages(1);
        setTotal(fallback.length);
        setUsedFallback(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadFallbackSubmissions = async () => {
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
      if (!res.ok) return [];
      const payload = await res.json();
      return Array.isArray(payload?.submissions) ? payload.submissions : [];
    } catch (error) {
      console.warn('Failed to load fallback submissions:', error);
      return [];
    }
  };

  const fetchSubmissionDetails = async (id: number) => {
    try {
      const res = await fetch(apiUrl(`/api/admin/submissions/${id}`), {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      setSubmissionNotes(data.notes || []);
    } catch (error) {
      console.error('Failed to fetch submission details:', error);
    }
  };

  const updateStatus = async (id: number, newStatus: string) => {
    try {
      await fetch(apiUrl(`/api/admin/submissions/${id}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      fetchSubmissions();
      if (selectedSubmission?.id === id) {
        setSelectedSubmission({ ...selectedSubmission, status: newStatus });
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const bulkUpdateStatus = async (newStatus: string) => {
    try {
      await Promise.all(selectedIds.map(id =>
        fetch(apiUrl(`/api/admin/submissions/${id}`), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          credentials: 'include',
          body: JSON.stringify({ status: newStatus }),
        })
      ));
      setSelectedIds([]);
      fetchSubmissions();
    } catch (error) {
      console.error('Failed to bulk update:', error);
    }
  };

  const addNote = async () => {
    if (!selectedSubmission || !noteText.trim()) return;
    try {
      await fetch(apiUrl(`/api/admin/submissions/${selectedSubmission.id}/notes`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({ note: noteText }),
      });
      setNoteText('');
      fetchSubmissionDetails(selectedSubmission.id);
    } catch (error) {
      console.error('Failed to add note:', error);
    }
  };

  const exportData = (format: 'csv' | 'json') => {
    const dataToExport = selectedIds.length > 0
      ? submissions.filter(s => selectedIds.includes(s.id))
      : submissions;

    if (format === 'csv') {
      const headers = ['ID', 'Name', 'Email', 'Phone', 'Service', 'ZIP', 'Status', 'Country', 'City', 'Browser', 'Device', 'Created'];
      const rows = dataToExport.map(s => [
        s.id, s.name, s.email, s.phone, s.serviceType, s.zipCode, s.status,
        s.country || '', s.city || '', s.browser || '', s.deviceType || '',
        new Date(s.createdAt).toLocaleString('en-US')
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
      downloadFile(csv, 'submissions.csv', 'text/csv');
    } else {
      const json = JSON.stringify(dataToExport, null, 2);
      downloadFile(json, 'submissions.json', 'application/json');
    }
    setShowExportMenu(false);
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setFilterStatus('all');
    setFilterCountry('all');
    setFilterService('all');
    setFilterSearch('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setPage(1);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === submissions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(submissions.map(s => s.id));
    }
  };

  const openSubmissionDetail = (sub: Submission) => {
    setSelectedSubmission(sub);
    fetchSubmissionDetails(sub.id);
  };

  const statusConfig: Record<string, { color: string; bg: string; icon: string; label: string }> = {
    new: { color: 'text-blue-400', bg: 'bg-blue-500/20 border-blue-500/30', icon: '🆕', label: 'New' },
    contacted: { color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/30', icon: '📞', label: 'In contact' },
    in_progress: { color: 'text-purple-400', bg: 'bg-purple-500/20 border-purple-500/30', icon: '⚙️', label: 'In progress' },
    completed: { color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/30', icon: '✅', label: 'Completed' },
    cancelled: { color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30', icon: '❌', label: 'Cancelled' },
  };

  const deviceIcons: Record<string, string> = {
    desktop: '🖥️',
    mobile: '📱',
    tablet: '📲',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header data-admin-page-chrome className="bg-slate-900/50 backdrop-blur-xl border-b border-white/5 px-6 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-sky-500 to-indigo-500 rounded-xl blur opacity-40 group-hover:opacity-60 transition"></div>
              <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">M</div>
            </div>
            <div className="hidden sm:block">
              <h1 className="font-bold text-white text-lg">MIYOMINT</h1>
              <p className="text-sm text-slate-400">Admin Panel</p>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-1 bg-slate-800/50 rounded-2xl p-1">
            <button onClick={() => onNavigate('dashboard')} className="px-5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 font-medium transition-all">
              <span className="flex items-center gap-2">📊 Dashboard</span>
            </button>
            <button onClick={() => onNavigate('submissions')} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-medium shadow-lg shadow-sky-500/20">
              <span className="flex items-center gap-2">📋 Submissions</span>
            </button>
            <button onClick={() => onNavigate('logs')} className="px-5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 font-medium transition-all">
              <span className="flex items-center gap-2">📜 Logs</span>
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
              📋 Submissions
            </h2>
            <p className="text-slate-400 mt-1">{usedFallback ? 'Showing recent submissions (empty filters or no data).' : `${total} records found`}</p>
          </div>
          <div className="flex items-center gap-3">
              <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2.5 rounded-xl border font-medium transition-all flex items-center gap-2 ${showFilters ? 'bg-sky-500/20 border-sky-500/30 text-sky-400' : 'border-white/10 text-slate-300 hover:bg-white/5'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
            </button>
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 font-medium transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-20">
                  <button onClick={() => exportData('csv')} className="w-full px-4 py-3 text-left text-slate-300 hover:bg-white/5 flex items-center gap-3 transition-all">
                    <span className="text-lg">📊</span> Download CSV
                  </button>
                  <button onClick={() => exportData('json')} className="w-full px-4 py-3 text-left text-slate-300 hover:bg-white/5 flex items-center gap-3 transition-all">
                    <span className="text-lg">📄</span> Download JSON
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {showFilters && (
          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">🔍 Search</label>
                <input
                  type="text"
                  value={filterSearch}
                  onChange={(e) => { setFilterSearch(e.target.value); setPage(1); }}
                  placeholder="Name, email, phone, ZIP..."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-700/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">📌 Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-700/50 border border-white/10 text-white focus:outline-none focus:border-sky-500/50 transition-all"
                >
                  <option value="all">All Statuses</option>
                  {filters?.statuses.map(s => (
                    <option key={s} value={s}>{statusConfig[s]?.icon} {statusConfig[s]?.label || s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">🌍 Country</label>
                <select
                  value={filterCountry}
                  onChange={(e) => { setFilterCountry(e.target.value); setPage(1); }}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-700/50 border border-white/10 text-white focus:outline-none focus:border-sky-500/50 transition-all"
                >
                  <option value="all">All Countries</option>
                  {filters?.countries.map(c => (
                    <option key={c.countryCode} value={c.countryCode}>
                      {countryFlags[c.countryCode] || '🌍'} {c.country}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">🛠️ Service</label>
                <select
                  value={filterService}
                  onChange={(e) => { setFilterService(e.target.value); setPage(1); }}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-700/50 border border-white/10 text-white focus:outline-none focus:border-sky-500/50 transition-all"
                >
                  <option value="all">All Services</option>
                  {filters?.serviceTypes.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">📅 Start</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-700/50 border border-white/10 text-white focus:outline-none focus:border-sky-500/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">📅 End</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-700/50 border border-white/10 text-white focus:outline-none focus:border-sky-500/50 transition-all"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="px-4 py-2.5 text-slate-400 hover:text-white font-medium transition-all flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear filters
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedIds.length > 0 && (
          <div className="bg-gradient-to-r from-sky-500/10 to-indigo-500/10 border border-sky-500/20 rounded-2xl px-6 py-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sky-500/20 rounded-full flex items-center justify-center text-sky-400 font-bold">
                {selectedIds.length}
              </div>
              <span className="text-white font-medium">{selectedIds.length} records selected</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm mr-2">Bulk action:</span>
              {Object.entries(statusConfig).map(([status, config]) => (
                <button
                  key={status}
                  onClick={() => bulkUpdateStatus(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:scale-105 ${config.bg} ${config.color}`}
                >
                  {config.icon}
                </button>
              ))}
              <button
                onClick={() => setSelectedIds([])}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white ml-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-sky-500/20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-sky-500 animate-spin"></div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900/50 border-b border-white/5">
                  <tr>
                    <th className="px-4 py-4 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === submissions.length && submissions.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-sky-500 focus:ring-sky-500/20"
                      />
                    </th>
                    <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Customer</th>
                    <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Service</th>
                    <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Location</th>
                    <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Device</th>
                    <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tarih</th>
                    <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {submissions.map((sub) => {
                    const createdDate = new Date(sub.createdAt);
                    const hasValidDate = !Number.isNaN(createdDate.getTime());
                    const dateLabel = hasValidDate
                      ? createdDate.toLocaleDateString('en-US', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })
                      : '-';
                    const timeLabel = hasValidDate
                      ? createdDate.toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: false,
                        })
                      : '-';
                    return (
                      <tr key={sub.id} className={`hover:bg-white/5 transition-colors ${selectedIds.includes(sub.id) ? 'bg-sky-500/10' : ''}`}>
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(sub.id)}
                          onChange={() => toggleSelect(sub.id)}
                          className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-sky-500 focus:ring-sky-500/20"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                              {getInitial(sub.name, 'S')}
                            </div>
                          <div>
                            <p className="font-medium text-white">{sub.name}</p>
                            <p className="text-xs text-slate-400">{sub.email}</p>
                            <p className="text-xs text-slate-500">{sub.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-white text-sm">{sub.serviceType}</p>
                        <p className="text-xs text-slate-500">ZIP: {sub.zipCode}</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{countryFlags[sub.countryCode || 'XX'] || '🌍'}</span>
                          <div>
                            <p className="text-sm text-white">{sub.city || '-'}</p>
                            <p className="text-xs text-slate-500">{sub.country || 'Unknown'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{deviceIcons[sub.deviceType || 'desktop'] || '🖥️'}</span>
                          <div>
                            <p className="text-sm text-white">{sub.browser || '-'}</p>
                            <p className="text-xs text-slate-500">{sub.os || '-'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={sub.status}
                          onChange={(e) => updateStatus(sub.id, e.target.value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${statusConfig[sub.status]?.bg} ${statusConfig[sub.status]?.color}`}
                        >
                          {filters?.statuses.map(s => (
                            <option key={s} value={s}>{statusConfig[s]?.icon} {statusConfig[s]?.label || s}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-white">{dateLabel}</p>
                        <p className="text-xs text-slate-500 mt-1">{timeLabel}</p>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => openSubmissionDetail(sub)}
                          className="px-4 py-2 rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 font-medium text-sm transition-all"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                  })}
                  {submissions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-16 text-center">
                        <div className="text-6xl mb-4">📭</div>
                        <p className="text-slate-400 text-lg">No submissions found</p>
                        <p className="text-slate-500 text-sm mt-1">Try adjusting your filters</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 p-6 border-t border-white/5">
                <button onClick={() => setPage(1)} disabled={page === 1} className="px-4 py-2 rounded-xl bg-slate-700/50 text-slate-300 disabled:opacity-50 hover:bg-slate-700 transition-all text-sm font-medium">First</button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-xl bg-slate-700/50 text-slate-300 disabled:opacity-50 hover:bg-slate-700 transition-all text-sm font-medium">Previous</button>
                <div className="flex items-center gap-1 px-4">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                    if (pageNum > totalPages) return null;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-10 h-10 rounded-xl font-medium text-sm transition-all ${page === pageNum ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-2 rounded-xl bg-slate-700/50 text-slate-300 disabled:opacity-50 hover:bg-slate-700 transition-all text-sm font-medium">Next</button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-4 py-2 rounded-xl bg-slate-700/50 text-slate-300 disabled:opacity-50 hover:bg-slate-700 transition-all text-sm font-medium">Last</button>
              </div>
            )}
          </div>
        )}
      </main>

      {selectedSubmission && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-white/10 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-white/10 flex items-center justify-between sticky top-0 bg-slate-800 z-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl">
                  {getInitial(selectedSubmission.name, 'S')}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedSubmission.name}</h3>
                  <p className="text-sm text-slate-400">Submission #{selectedSubmission.id}</p>
                </div>
              </div>
              <button onClick={() => setSelectedSubmission(null)} className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-700/30 rounded-2xl p-5 border border-white/5">
                  <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <span className="text-lg">👤</span> Contact Info
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs text-slate-500">Full Name</label><p className="font-medium text-white mt-1">{selectedSubmission.name}</p></div>
                    <div><label className="text-xs text-slate-500">Phone</label><p className="font-medium text-white mt-1">{selectedSubmission.phone}</p></div>
                    <div className="col-span-2"><label className="text-xs text-slate-500">Email</label><p className="font-medium text-white mt-1">{selectedSubmission.email}</p></div>
                    <div><label className="text-xs text-slate-500">ZIP Code</label><p className="font-medium text-white mt-1">{selectedSubmission.zipCode}</p></div>
                  </div>
                </div>

                <div className="bg-slate-700/30 rounded-2xl p-5 border border-white/5">
                  <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <span className="text-lg">🌍</span> Location & Device
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs text-slate-500">Country</label><p className="font-medium text-white mt-1">{countryFlags[selectedSubmission.countryCode || 'XX']} {selectedSubmission.country || 'Unknown'}</p></div>
                    <div><label className="text-xs text-slate-500">City</label><p className="font-medium text-white mt-1">{selectedSubmission.city || '-'}</p></div>
                    <div><label className="text-xs text-slate-500">Browser</label><p className="font-medium text-white mt-1">{selectedSubmission.browser || '-'} {selectedSubmission.browserVersion || ''}</p></div>
                    <div><label className="text-xs text-slate-500">Operating System</label><p className="font-medium text-white mt-1">{selectedSubmission.os || '-'}</p></div>
                    <div><label className="text-xs text-slate-500">Device</label><p className="font-medium text-white mt-1">{deviceIcons[selectedSubmission.deviceType || 'desktop']} {selectedSubmission.deviceType || '-'}</p></div>
                    <div><label className="text-xs text-slate-500">Time Zone</label><p className="font-medium text-white mt-1">{selectedSubmission.timezone || '-'}</p></div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-700/30 rounded-xl p-4 border border-white/5">
                  <label className="text-xs text-slate-500">IP Adresi</label>
                  <p className="font-mono text-white mt-1 text-sm">{selectedSubmission.ipAddress || '-'}</p>
                </div>
                <div className="bg-slate-700/30 rounded-xl p-4 border border-white/5">
                  <label className="text-xs text-slate-500">Service</label>
                  <p className="font-medium text-white mt-1">{selectedSubmission.serviceType}</p>
                </div>
                <div className="bg-slate-700/30 rounded-xl p-4 border border-white/5">
                  <label className="text-xs text-slate-500">Status</label>
                  <select
                    value={selectedSubmission.status}
                    onChange={(e) => updateStatus(selectedSubmission.id, e.target.value)}
                    className={`mt-1 px-3 py-1.5 rounded-lg text-sm font-medium border cursor-pointer ${statusConfig[selectedSubmission.status]?.bg} ${statusConfig[selectedSubmission.status]?.color}`}
                  >
                    {filters?.statuses.map(s => (
                      <option key={s} value={s}>{statusConfig[s]?.icon} {statusConfig[s]?.label || s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedSubmission.answers && Object.keys(selectedSubmission.answers).length > 0 && (
                <div className="bg-slate-700/30 rounded-2xl p-5 border border-white/5">
                  <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <span className="text-lg">📝</span> Answers
                  </h4>
                  <div className="space-y-3">
                    {Object.entries(selectedSubmission.answers).map(([key, value]) => (
                      <div key={key} className="flex items-start gap-3">
                        <span className="text-slate-400 text-sm min-w-32">{key}:</span>
                        <span className="text-white font-medium text-sm">
                          {Array.isArray(value) ? value.join(', ') : value || '-'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedSubmission.photoUrls && selectedSubmission.photoUrls.length > 0 && (
                <div className="bg-slate-700/30 rounded-2xl p-5 border border-white/5">
                  <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <span className="text-lg">📷</span> Photos ({selectedSubmission.photoUrls.length})
                  </h4>
                  <div className="grid grid-cols-4 gap-3">
                    {selectedSubmission.photoUrls.map((url, index) => (
                      <img
                        key={index}
                        src={url}
                        alt={`Photo ${index + 1}`}
                        loading="lazy"
                        decoding="async"
                        className="rounded-xl w-full h-24 object-cover cursor-pointer hover:opacity-80 transition-all hover:scale-105"
                        onClick={() => window.open(url, '_blank')}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-slate-700/30 rounded-2xl p-5 border border-white/5">
                <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="text-lg">💬</span> Notes ({submissionNotes.length})
                </h4>
                <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                  {submissionNotes.map((note: any) => (
                    <div key={note.id} className="bg-slate-800/50 rounded-xl p-3 border border-white/5">
                      <p className="text-white text-sm">{note.note}</p>
                      <p className="text-xs text-slate-500 mt-2">{new Date(note.createdAt).toLocaleString('en-US')}</p>
                    </div>
                  ))}
                  {submissionNotes.length === 0 && (
                    <p className="text-slate-500 text-center py-4">No notes yet</p>
                  )}
                </div>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a note..."
                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
                    onKeyPress={(e) => e.key === 'Enter' && addNote()}
                  />
                  <button onClick={addNote} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-medium">Add</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                <div><label className="text-xs text-slate-500">Created</label><p className="text-white mt-1">{new Date(selectedSubmission.createdAt).toLocaleString('en-US')}</p></div>
                <div><label className="text-xs text-slate-500">Updated</label><p className="text-white mt-1">{new Date(selectedSubmission.updatedAt).toLocaleString('en-US')}</p></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

