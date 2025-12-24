import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../../lib/api';

interface Professional {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  service_types: string[];
  zip_codes: string[];
  license_number: string | null;
  insurance_verified: boolean;
  background_checked: boolean;
  rating: number;
  total_jobs: number;
  status: string;
  notes: string | null;
  created_at: string;
}

interface AdminProfessionalsProps {
  onNavigate: (page: string) => void;
}

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  pending: { bg: 'bg-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-500' },
  approved: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  suspended: { bg: 'bg-red-500/20', text: 'text-red-400', dot: 'bg-red-500' },
  rejected: { bg: 'bg-slate-500/20', text: 'text-slate-400', dot: 'bg-slate-500' },
};

export default function AdminProfessionals({ onNavigate }: AdminProfessionalsProps) {
  const { logout, getAuthHeaders } = useAuth();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingPro, setEditingPro] = useState<Professional | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    companyName: '',
    serviceTypes: [] as string[],
    zipCodes: '',
    licenseNumber: '',
    notes: '',
  });

  const serviceOptions = ['Roofing', 'Electrical', 'HVAC', 'Plumbing', 'Remodeling', 'Flooring', 'Handyman', 'Cleaning', 'Carpentry', 'Concrete', 'Drywall', 'Fencing', 'Garage Door'];

  const fetchProfessionals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (status !== 'all') params.append('status', status);
      if (search) params.append('search', search);

      const res = await fetch(apiUrl(`/api/admin/professionals?${params}`), {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      setProfessionals(data.professionals || []);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      console.error('Fetch professionals error:', error);
    } finally {
      setLoading(false);
    }
  }, [page, status, search, getAuthHeaders]);

  useEffect(() => {
    fetchProfessionals();
  }, [fetchProfessionals]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingPro ? apiUrl(`/api/admin/professionals/${editingPro.id}`) : apiUrl('/api/admin/professionals');
      const method = editingPro ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          zipCodes: formData.zipCodes.split(',').map(z => z.trim()).filter(Boolean),
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setEditingPro(null);
        setFormData({ name: '', email: '', phone: '', companyName: '', serviceTypes: [], zipCodes: '', licenseNumber: '', notes: '' });
        fetchProfessionals();
      }
    } catch (error) {
      console.error('Submit error:', error);
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await fetch(apiUrl(`/api/admin/professionals/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      fetchProfessionals();
    } catch (error) {
      console.error('Status update error:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this professional?')) return;
    try {
      await fetch(apiUrl(`/api/admin/professionals/${id}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      fetchProfessionals();
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const openEditModal = (pro: Professional) => {
    setEditingPro(pro);
    setFormData({
      name: pro.name,
      email: pro.email,
      phone: pro.phone || '',
      companyName: pro.company_name || '',
      serviceTypes: pro.service_types || [],
      zipCodes: (pro.zip_codes || []).join(', '),
      licenseNumber: pro.license_number || '',
      notes: pro.notes || '',
    });
    setShowModal(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header data-admin-page-chrome className="bg-slate-900/50 backdrop-blur-xl border-b border-white/5 px-6 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => onNavigate('dashboard')} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-all">
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
              { id: 'submissions', label: 'Submissions', icon: '📋' },
              { id: 'professionals', label: 'Professionals', icon: '👷' },
              { id: 'settings', label: 'Settings', icon: '⚙️' },
            ].map(item => (
              <button key={item.id} onClick={() => onNavigate(item.id)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${item.id === 'professionals' ? 'bg-gradient-to-r from-sky-500/20 to-indigo-500/20 text-white border border-sky-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                {item.icon} {item.label}
              </button>
            ))}
            <button onClick={logout} className="ml-4 px-4 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm font-medium transition-all">Log Out</button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">👷 Professionals</h2>
            <p className="text-slate-400 mt-1">{total} professionals</p>
          </div>
          <button onClick={() => { setEditingPro(null); setFormData({ name: '', email: '', phone: '', companyName: '', serviceTypes: [], zipCodes: '', licenseNumber: '', notes: '' }); setShowModal(true); }} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-medium shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 transition-all flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            New Profesyonel
          </button>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <input type="text" placeholder="Ara..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder-slate-400 focus:outline-none focus:border-sky-500/50 w-64" />
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white focus:outline-none focus:border-sky-500/50">
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="suspended">Suspended</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center py-20"><div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin mx-auto"></div></div>
        ) : professionals.length === 0 ? (
          <div className="text-center py-20 text-slate-400">No professional records yet.</div>
        ) : (
          <div className="grid gap-4">
            {professionals.map((pro) => (
              <div key={pro.id} className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl">
                      {pro.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{pro.name}</h3>
                      <p className="text-slate-400 text-sm">{pro.company_name || 'Bireysel'}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-slate-500 text-xs">{pro.email}</span>
                        {pro.phone && <span className="text-slate-500 text-xs">• {pro.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`px-3 py-1 rounded-full ${statusColors[pro.status]?.bg || 'bg-slate-500/20'} ${statusColors[pro.status]?.text || 'text-slate-400'} text-xs font-medium flex items-center gap-1.5`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusColors[pro.status]?.dot || 'bg-slate-500'}`}></span>
                      {pro.status === 'pending' ? 'Pending' : pro.status === 'approved' ? 'Approved' : pro.status === 'suspended' ? 'Suspended' : 'Rejected'}
                    </div>
                    <button onClick={() => openEditModal(pro)} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-all">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => handleDelete(pro.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-all">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 mt-4">
                  {(pro.service_types || []).map((st) => (
                    <span key={st} className="px-2 py-1 rounded-lg bg-sky-500/10 text-sky-400 text-xs">{st}</span>
                  ))}
                </div>

                <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    {pro.insurance_verified && <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs flex items-center gap-1"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>Insured</span>}
                    {pro.background_checked && <span className="px-2 py-1 rounded-lg bg-purple-500/10 text-purple-400 text-xs flex items-center gap-1"><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>Background Checked</span>}
                  </div>
                  <div className="flex items-center gap-4 ml-auto text-sm">
                    <span className="text-slate-400">⭐ {pro.rating || '0.0'}</span>
                    <span className="text-slate-400">{pro.total_jobs || 0} jobs</span>
                  </div>
                  <div className="flex gap-2">
                    {pro.status === 'pending' && (
                      <>
                        <button onClick={() => handleStatusChange(pro.id, 'approved')} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-medium transition-all">Onayla</button>
                        <button onClick={() => handleStatusChange(pro.id, 'rejected')} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-all">Reddet</button>
                      </>
                    )}
                    {pro.status === 'approved' && (
                      <button onClick={() => handleStatusChange(pro.id, 'suspended')} className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs font-medium transition-all">Suspend</button>
                    )}
                    {pro.status === 'suspended' && (
                      <button onClick={() => handleStatusChange(pro.id, 'approved')} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-medium transition-all">Activate</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {total > 20 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-xl bg-slate-800/50 text-slate-300 disabled:opacity-50 hover:bg-slate-700 transition-all text-sm font-medium">Previous</button>
            <span className="px-4 py-2 text-slate-400 text-sm">Sayfa {page} / {Math.ceil(total / 20)}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 20)} className="px-4 py-2 rounded-xl bg-slate-800/50 text-slate-300 disabled:opacity-50 hover:bg-slate-700 transition-all text-sm font-medium">Sonraki</button>
          </div>
        )}
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-white/10">
            <div className="p-6 border-b border-white/10">
              <h3 className="text-xl font-bold text-white">{editingPro ? 'Profesyonel Edit' : 'New Profesyonel'}</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Ad Soyad *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="w-full px-4 py-2.5 rounded-xl bg-slate-700/50 border border-white/10 text-white focus:outline-none focus:border-sky-500/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Email *</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required className="w-full px-4 py-2.5 rounded-xl bg-slate-700/50 border border-white/10 text-white focus:outline-none focus:border-sky-500/50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Telefon</label>
                  <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-700/50 border border-white/10 text-white focus:outline-none focus:border-sky-500/50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Company Name</label>
                  <input type="text" value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-700/50 border border-white/10 text-white focus:outline-none focus:border-sky-500/50" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Service Types</label>
                <div className="flex flex-wrap gap-2">
                  {serviceOptions.map((service) => (
                    <button key={service} type="button" onClick={() => {
                      setFormData({
                        ...formData,
                        serviceTypes: formData.serviceTypes.includes(service)
                          ? formData.serviceTypes.filter(s => s !== service)
                          : [...formData.serviceTypes, service]
                      });
                    }} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${formData.serviceTypes.includes(service) ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>{service}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Service Regions (ZIP codes, comma separated)</label>
                <input type="text" value={formData.zipCodes} onChange={(e) => setFormData({ ...formData, zipCodes: e.target.value })} placeholder="90210, 90211, 90212" className="w-full px-4 py-2.5 rounded-xl bg-slate-700/50 border border-white/10 text-white focus:outline-none focus:border-sky-500/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">License Number</label>
                <input type="text" value={formData.licenseNumber} onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-700/50 border border-white/10 text-white focus:outline-none focus:border-sky-500/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} className="w-full px-4 py-2.5 rounded-xl bg-slate-700/50 border border-white/10 text-white focus:outline-none focus:border-sky-500/50 resize-none" />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600 font-medium transition-all">Cancelled</button>
                <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-medium shadow-lg hover:shadow-sky-500/25 transition-all">{editingPro ? 'Update' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

