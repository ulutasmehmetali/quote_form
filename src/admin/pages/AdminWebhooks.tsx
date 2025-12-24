import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../../lib/api';

interface Webhook {
  id: number;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  failure_count: number;
  created_at: string;
}

interface AdminWebhooksProps {
  onNavigate: (page: string) => void;
}

const eventOptions = [
  { value: 'submission.created', label: 'New BaYvuru' },
  { value: 'submission.updated', label: 'BaYvuru Updatendi' },
  { value: 'submission.deleted', label: 'Submission Deleted' },
  { value: 'professional.created', label: 'New Profesyonel' },
  { value: 'professional.approved', label: 'Professional Approved' },
];

export default function AdminWebhooks({ onNavigate }: AdminWebhooksProps) {
  const { logout, getAuthHeaders } = useAuth();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [formData, setFormData] = useState({ name: '', url: '', events: [] as string[] });
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testPayload, setTestPayload] = useState('{\n  \"ping\": \"hello\"\n}');
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const fetchWebhooks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/admin/webhooks'), {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      setWebhooks(data.webhooks || []);
    } catch (error) {
      console.error('Fetch webhooks error:', error);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetch(apiUrl('/api/admin/webhooks/logs?status=failed&limit=10'), {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) setLogs(data.logs || []);
    } catch {
      // ignore
    } finally {
      setLogsLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchWebhooks();
    fetchLogs();
  }, [fetchWebhooks, fetchLogs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingWebhook ? apiUrl(`/api/admin/webhooks/${editingWebhook.id}`) : apiUrl('/api/admin/webhooks');
      const method = editingWebhook ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.secretKey) {
          setSecretKey(data.secretKey);
        } else {
          setShowModal(false);
          setEditingWebhook(null);
          setFormData({ name: '', url: '', events: [] });
          fetchWebhooks();
        }
      }
    } catch (error) {
      console.error('Submit error:', error);
    }
  };

  const handleToggle = async (id: number, isActive: boolean) => {
    try {
      await fetch(apiUrl(`/api/admin/webhooks/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ isActive }),
      });
      fetchWebhooks();
    } catch (error) {
      console.error('Toggle error:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;
    try {
      await fetch(apiUrl(`/api/admin/webhooks/${id}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      fetchWebhooks();
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const handleTest = async (id: number) => {
    setTestingId(id);
    try {
      let parsedPayload: any = undefined;
      try {
        parsedPayload = JSON.parse(testPayload);
      } catch {
        alert('Payload JSON parse error');
        return;
      }
      const res = await fetch(apiUrl(`/api/admin/webhooks/${id}/test`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ payload: parsedPayload }),
      });
      const data = await res.json();
      alert(data.success ? 'Test successful!' : `Test failed: ${data.error}`);
      fetchWebhooks();
      fetchLogs();
    } catch (error) {
      alert('Error while sending test');
    } finally {
      setTestingId(null);
    }
  };

  const openEditModal = (webhook: Webhook) => {
    setEditingWebhook(webhook);
    setFormData({
      name: webhook.name,
      url: webhook.url,
      events: webhook.events || [],
    });
    setShowModal(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header data-admin-page-chrome className="bg-slate-900/50 backdrop-blur-xl border-b border-white/5 px-6 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => onNavigate('settings')} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">M</div>
              <span className="text-xl font-bold text-white">MIYOMINT</span>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: '📊' },
              { id: 'settings', label: 'Settings', icon: '⚙️' },
            ].map(item => (
              <button key={item.id} onClick={() => onNavigate(item.id)} className="px-4 py-2 rounded-xl text-sm font-medium transition-all text-slate-400 hover:text-white hover:bg-white/5">
                {item.icon} {item.label}
              </button>
            ))}
            <button onClick={logout} className="ml-4 px-4 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm font-medium transition-all">Log Out</button>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">🔗 Webhooks</h2>
            <p className="text-slate-400 mt-1">Send notifications to external systems</p>
          </div>
          <button onClick={() => { setEditingWebhook(null); setFormData({ name: '', url: '', events: [] }); setSecretKey(null); setShowModal(true); }} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-medium shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 transition-all flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            New Webhook
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20"><div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin mx-auto"></div></div>
        ) : webhooks.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-slate-800/50 flex items-center justify-center mx-auto mb-4 text-4xl">🔗</div>
            <p className="text-slate-400">No webhooks added yet.</p>
            <p className="text-slate-500 text-sm mt-1">Add a webhook to send notifications to external systems.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {webhooks.map((webhook) => (
              <div key={webhook.id} className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">{webhook.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${webhook.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}`}>
                        {webhook.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {webhook.failure_count > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                          {webhook.failure_count} errors
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 text-sm font-mono truncate">{webhook.url}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {(webhook.events || []).map((event) => (
                        <span key={event} className="px-2 py-1 rounded-lg bg-sky-500/10 text-sky-400 text-xs">
                          {eventOptions.find(e => e.value === event)?.label || event}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleTest(webhook.id)} disabled={testingId === webhook.id} className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 text-xs font-medium transition-all disabled:opacity-50 flex items-center gap-1">
                      {testingId === webhook.id ? (
                        <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg> Test...</>
                      ) : (
                        <><svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg> Test</>
                      )}
                    </button>
                    <button onClick={() => handleToggle(webhook.id, !webhook.is_active)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${webhook.is_active ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'}`}>
                      {webhook.is_active ? 'Stop' : 'Activate'}
                    </button>
                    <button onClick={() => openEditModal(webhook)} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => handleDelete(webhook.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5 text-xs text-slate-500">
                  <span>Created: {new Date(webhook.created_at).toLocaleDateString('en-US')}</span>
                  {webhook.last_triggered_at && (
                    <span>Last trigger: {new Date(webhook.last_triggered_at).toLocaleString('en-US')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl max-w-md w-full border border-white/10">
            <div className="p-6 border-b border-white/10">
              <h3 className="text-xl font-bold text-white">{editingWebhook ? 'Edit Webhook' : 'New Webhook'}</h3>
            </div>
            {secretKey ? (
              <div className="p-6 space-y-4">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-emerald-400 font-medium mb-2">Webhook created!</p>
                  <p className="text-slate-400 text-sm mb-3">Store the secret key below in a safe place. It will not be shown again:</p>
                  <div className="p-3 rounded-lg bg-slate-900/50 font-mono text-xs text-sky-400 break-all">{secretKey}</div>
                </div>
                <button onClick={() => { setShowModal(false); setSecretKey(null); fetchWebhooks(); }} className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-medium">Done</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="w-full px-4 py-2.5 rounded-xl bg-slate-700/50 border border-white/10 text-white focus:outline-none focus:border-sky-500/50" placeholder="e.g., Slack Notification" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">URL *</label>
                  <input type="url" value={formData.url} onChange={(e) => setFormData({ ...formData, url: e.target.value })} required className="w-full px-4 py-2.5 rounded-xl bg-slate-700/50 border border-white/10 text-white focus:outline-none focus:border-sky-500/50 font-mono text-sm" placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Events</label>
                  <div className="space-y-2">
                    {eventOptions.map((event) => (
                      <label key={event.value} className="flex items-center gap-3 p-3 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 cursor-pointer transition-all">
                        <input type="checkbox" checked={formData.events.includes(event.value)} onChange={(e) => {
                          setFormData({
                            ...formData,
                            events: e.target.checked
                              ? [...formData.events, event.value]
                              : formData.events.filter(ev => ev !== event.value)
                          });
                        }} className="w-4 h-4 rounded border-slate-500 bg-slate-600 text-sky-500 focus:ring-sky-500 focus:ring-offset-0" />
                        <span className="text-slate-300 text-sm">{event.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600 font-medium transition-all">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-medium shadow-lg hover:shadow-sky-500/25 transition-all">{editingWebhook ? 'Update' : 'Create'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
