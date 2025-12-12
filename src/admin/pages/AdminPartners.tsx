import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, Play, Check, X, AlertCircle, Link, Key, Clock, RefreshCw, Activity, Eye, EyeOff } from 'lucide-react';
import { apiUrl } from '../../lib/api';
import { useAuth } from '../context/AuthContext';

interface Partner {
  id: number;
  name: string;
  endpoint_url: string;
  http_method: string;
  auth_method: string;
  is_active: boolean;
  service_types: string[];
  timeout_ms: number;
  retry_count: number;
  success_count: number;
  failure_count: number;
  last_success_at: string | null;
  last_failure_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
  workflow?: { id: string; name: string; isActive: boolean } | null;
}

interface PartnerFormData {
  name: string;
  endpointUrl: string;
  httpMethod: string;
  authMethod: string;
  authConfig: {
    apiKey?: string;
    bearerToken?: string;
    username?: string;
    password?: string;
    headerName?: string;
    headerValue?: string;
  };
  serviceTypes: string[];
  timeoutMs: number;
  retryCount: number;
  notes: string;
}

const SERVICE_OPTIONS = [
  'Roofing', 'Plumbing', 'Electrical', 'HVAC', 'Painting', 'Flooring',
  'Landscaping', 'Remodeling', 'Windows & Doors', 'Siding', 'Fencing',
  'Deck & Patio', 'Bathroom Remodel', 'Kitchen Remodel', 'Solar Installation'
];

interface AdminPartnersProps {
  onNavigate: (page: string) => void;
}

export default function AdminPartners({ onNavigate }: AdminPartnersProps) {
  const { getAuthHeaders } = useAuth();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [testing, setTesting] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ partnerId: number; success: boolean; message: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [workflows, setWorkflows] = useState<{ id: string; name: string; isActive: boolean }[]>([]);
  const [workflowLoading, setWorkflowLoading] = useState(true);
  const [formData, setFormData] = useState<PartnerFormData>({
    name: '',
    endpointUrl: '',
    httpMethod: 'POST',
    authMethod: 'api_key',
    authConfig: {},
    serviceTypes: [],
    timeoutMs: 10000,
    retryCount: 3,
    notes: '',
  });

  const fetchPartners = async () => {
    try {
      const res = await fetch(apiUrl('/api/admin/partners'), {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      setPartners(data.partners || []);
    } catch (error) {
      console.error('Failed to fetch partners:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkflows = async () => {
    setWorkflowLoading(true);
    try {
      const res = await fetch(apiUrl('/api/admin/automations'), {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      setWorkflows(json.workflows || []);
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
      setWorkflows([]);
    } finally {
      setWorkflowLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
    fetchWorkflows();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingPartner 
        ? apiUrl(`/api/admin/partners/${editingPartner.id}`) 
        : apiUrl('/api/admin/partners');
      
      const res = await fetch(url, {
        method: editingPartner ? 'PATCH' : 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        fetchPartners();
        setShowModal(false);
        resetForm();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save partner');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save partner');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bu partner API\'yi silmek istediğinizden emin misiniz?')) return;
    
    try {
      const res = await fetch(apiUrl(`/api/admin/partners/${id}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (res.ok) {
        fetchPartners();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete partner');
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const handleToggleActive = async (partner: Partner) => {
    try {
      const res = await fetch(apiUrl(`/api/admin/partners/${partner.id}`), {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({ isActive: !partner.is_active }),
      });

      if (res.ok) {
        fetchPartners();
      }
    } catch (error) {
      console.error('Toggle error:', error);
    }
  };

  const handleTest = async (id: number) => {
    setTesting(id);
    setTestResult(null);
    
    try {
      const res = await fetch(apiUrl(`/api/admin/partners/${id}/test`), {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      const data = await res.json();
      setTestResult({
        partnerId: id,
        success: data.success,
        message: data.success 
          ? `Successful! Status: ${data.status}, Latency: ${data.latency}ms`
          : `Failed: ${data.error || `Status ${data.status}`}`,
      });
    } catch (error) {
      setTestResult({
        partnerId: id,
        success: false,
        message: 'Connection error',
      });
    } finally {
      setTesting(null);
    }
  };

  const handleOpenWorkflow = (workflowId?: string | null) => {
    if (!workflowId) return;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('focusWorkflowId', workflowId);
    }
    onNavigate('automations');
  };

  const resetForm = () => {
    setFormData({
      name: '',
      endpointUrl: '',
      httpMethod: 'POST',
      authMethod: 'api_key',
      authConfig: {},
      serviceTypes: [],
      timeoutMs: 10000,
      retryCount: 3,
      notes: '',
    });
    setEditingPartner(null);
    setShowPassword(false);
  };

  const openEditModal = (partner: Partner) => {
    setEditingPartner(partner);
    setFormData({
      name: partner.name,
      endpointUrl: partner.endpoint_url,
      httpMethod: partner.http_method,
      authMethod: partner.auth_method,
      authConfig: {},
      serviceTypes: partner.service_types || [],
      timeoutMs: partner.timeout_ms,
      retryCount: partner.retry_count,
      notes: partner.notes || '',
    });
    setShowModal(true);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-US');
  };

  const getSuccessRate = (partner: Partner) => {
    const total = partner.success_count + partner.failure_count;
    if (total === 0) return '-';
    return `${Math.round((partner.success_count / total) * 100)}%`;
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('settings')} className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Partner API Management</h1>
            <p className="text-slate-400 text-sm">Customer verilerini göndermek için harici API'ler yapılandırın</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-lg hover:from-sky-600 hover:to-blue-700 transition-all shadow-lg"
          >
            <Plus className="w-4 h-4" />
            New Partner Add
          </button>
          <button
            onClick={() => onNavigate('automations')}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-sky-500 text-white rounded-lg hover:from-emerald-600 hover:to-sky-600 transition-all shadow-lg"
          >
            <Activity className="w-4 h-4" />
            Workflow ile Entegre Ol
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="bg-slate-800/60 border border-white/5 rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Workflow Senkronizasyonu</p>
              <h2 className="text-lg font-semibold text-white">Partner API'ler + Workflow</h2>
              <p className="text-sm text-slate-400">
                Manage Partner APIs linked to your workflows. Each partner record can become a workflow step.
              </p>
            </div>
            <button
              onClick={() => onNavigate('automations')}
              className="px-3 py-1.5 text-xs rounded-full border border-slate-600 text-slate-200 hover:border-slate-400 hover:text-white transition"
            >
              Workflows'a Git
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {workflowLoading ? (
              <span className="text-xs text-slate-400">Loading workflows...</span>
            ) : workflows.length === 0 ? (
              <span className="text-xs text-slate-400">Hiç workflow yok. New bir workflow oluşturun.</span>
            ) : (
              workflows.slice(0, 3).map((workflow) => (
                <div
                  key={workflow.id}
                  className="flex-1 min-w-[180px] rounded-2xl border border-white/5 bg-slate-900/60 p-3"
                >
                  <div className="text-sm text-slate-400">{workflow.isActive ? 'Aktif' : 'Pasif'}</div>
                  <div className="text-white font-semibold">{workflow.name}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {partners.length === 0 ? (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-12 text-center">
          <Link className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Partner APIs yet</h3>
          <p className="text-slate-400 mb-6">Customer verilerini otomatik olarak göndermek için partner API'leri ekleyin</p>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="px-4 py-2 bg-sky-500/20 text-sky-400 rounded-lg hover:bg-sky-500/30 transition-colors"
          >
            First Partner'ı Add
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {partners.map((partner) => (
            <div
              key={partner.id}
              className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{partner.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      partner.is_active
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {partner.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs font-medium">
                      {partner.http_method}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-xs font-medium">
                      {partner.auth_method.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-slate-400 mb-3">
                    <Link className="w-4 h-4" />
                    <code className="bg-slate-900/50 px-2 py-0.5 rounded text-slate-300">{partner.endpoint_url}</code>
                  </div>

                  {partner.service_types && partner.service_types.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {partner.service_types.map((type) => (
                        <span key={type} className="px-2 py-0.5 bg-slate-700/50 text-slate-300 rounded text-xs">
                          {type}
                        </span>
                      ))}
                    </div>
                  )}

                  {partner.workflow ? (
                    <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-200">
                      <span className="font-semibold text-white">Workflow</span>
                      <span className="px-2 py-1 rounded-full bg-slate-900/70 text-white text-[11px]">{partner.workflow.name}</span>
                      <button
                        type="button"
                        onClick={() => handleOpenWorkflow(partner.workflow?.id)}
                        className="px-3 py-1 rounded-full border border-white/10 text-[11px] text-slate-200 hover:border-slate-400 hover:text-white transition"
                      >
                        Workflow'a Git
                      </button>
                    </div>
                  ) : (
                    <div className="mb-3 text-xs text-slate-400">
                      Workflow ile bağlantı bulunmuyor. New partner eklediğinizde otomatik workflow oluşturulur.
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">Başarılı</span>
                      <p className="text-emerald-400 font-medium">{partner.success_count}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Başarısız</span>
                      <p className="text-red-400 font-medium">{partner.failure_count}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Success Rate</span>
                      <p className="text-white font-medium">{getSuccessRate(partner)}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Last Success</span>
                      <p className="text-slate-300 text-xs">{formatDate(partner.last_success_at)}</p>
                    </div>
                  </div>

                  {testResult && testResult.partnerId === partner.id && (
                    <div className={`mt-4 p-3 rounded-lg ${
                      testResult.success 
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
                        : 'bg-red-500/10 border border-red-500/30 text-red-400'
                    }`}>
                      <div className="flex items-center gap-2">
                        {testResult.success ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        {testResult.message}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleTest(partner.id)}
                    disabled={testing === partner.id}
                    className="p-2 text-sky-400 hover:bg-sky-500/20 rounded-lg transition-colors disabled:opacity-50"
                    title="Test Connection"
                  >
                    {testing === partner.id ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Play className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleToggleActive(partner)}
                    className={`p-2 rounded-lg transition-colors ${
                      partner.is_active
                        ? 'text-emerald-400 hover:bg-emerald-500/20'
                        : 'text-slate-400 hover:bg-slate-500/20'
                    }`}
                    title={partner.is_active ? 'Disable' : 'Enable'}
                  >
                    {partner.is_active ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => openEditModal(partner)}
                    className="p-2 text-amber-400 hover:bg-amber-500/20 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(partner.id)}
                    className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                    title="Sil"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700/50 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700/50">
              <h2 className="text-xl font-bold text-white">
                {editingPartner ? 'Partner API Edit' : 'New Partner API Add'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Partner Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="e.g., Acme Lead API"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">HTTP Metod</label>
                  <select
                    value={formData.httpMethod}
                    onChange={(e) => setFormData({ ...formData, httpMethod: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  >
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="GET">GET</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Endpoint URL *</label>
                <input
                  type="url"
                  value={formData.endpointUrl}
                  onChange={(e) => setFormData({ ...formData, endpointUrl: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="https://api.partner.com/leads"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Authentication Method</label>
                <select
                  value={formData.authMethod}
                  onChange={(e) => setFormData({ ...formData, authMethod: e.target.value, authConfig: {} })}
                  className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                >
                  <option value="none">Yok</option>
                  <option value="api_key">API Key (X-API-Key Header)</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="basic">Basic Auth</option>
                  <option value="custom_header">Custom Header</option>
                </select>
              </div>

              {formData.authMethod === 'api_key' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">API Key</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.authConfig.apiKey || ''}
                      onChange={(e) => setFormData({ ...formData, authConfig: { ...formData.authConfig, apiKey: e.target.value } })}
                      className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent pr-12"
                      placeholder="Enter your API key"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              )}

              {formData.authMethod === 'bearer' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Bearer Token</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.authConfig.bearerToken || ''}
                      onChange={(e) => setFormData({ ...formData, authConfig: { ...formData.authConfig, bearerToken: e.target.value } })}
                      className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent pr-12"
                      placeholder="Enter your token"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              )}

              {formData.authMethod === 'basic' && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">User Adı</label>
                    <input
                      type="text"
                      value={formData.authConfig.username || ''}
                      onChange={(e) => setFormData({ ...formData, authConfig: { ...formData.authConfig, username: e.target.value } })}
                      className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.authConfig.password || ''}
                        onChange={(e) => setFormData({ ...formData, authConfig: { ...formData.authConfig, password: e.target.value } })}
                        className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {formData.authMethod === 'custom_header' && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Header Name</label>
                    <input
                      type="text"
                      value={formData.authConfig.headerName || ''}
                      onChange={(e) => setFormData({ ...formData, authConfig: { ...formData.authConfig, headerName: e.target.value } })}
                      className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                      placeholder="X-Custom-Auth"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Header Value</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.authConfig.headerValue || ''}
                        onChange={(e) => setFormData({ ...formData, authConfig: { ...formData.authConfig, headerValue: e.target.value } })}
                        className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Service Types (optional)</label>
                <p className="text-xs text-slate-500 mb-2">Send data only for selected service types. Leave empty to allow all types.</p>
                <div className="flex flex-wrap gap-2">
                  {SERVICE_OPTIONS.map((service) => (
                    <button
                      key={service}
                      type="button"
                      onClick={() => {
                        const types = formData.serviceTypes.includes(service)
                          ? formData.serviceTypes.filter(t => t !== service)
                          : [...formData.serviceTypes, service];
                        setFormData({ ...formData, serviceTypes: types });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        formData.serviceTypes.includes(service)
                          ? 'bg-sky-500/30 text-sky-300 border border-sky-500/50'
                          : 'bg-slate-700/50 text-slate-400 border border-slate-600 hover:bg-slate-700'
                      }`}
                    >
                      {service}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Timeout (ms)</label>
                  <input
                    type="number"
                    value={formData.timeoutMs}
                    onChange={(e) => setFormData({ ...formData, timeoutMs: parseInt(e.target.value) || 10000 })}
                    className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    min="1000"
                    max="60000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Retry Count</label>
                  <input
                    type="number"
                    value={formData.retryCount}
                    onChange={(e) => setFormData({ ...formData, retryCount: parseInt(e.target.value) || 3 })}
                    className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    min="0"
                    max="10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  rows={3}
                  placeholder="Notes about this partner..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/50">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                >
                  Cancelled
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-lg hover:from-sky-600 hover:to-blue-700 transition-all shadow-lg"
                >
                  {editingPartner ? 'Update' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

