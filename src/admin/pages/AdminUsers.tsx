import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../../lib/api';

interface AdminUser {
  id: number;
  username: string;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
}

interface AdminUsersProps {
  onNavigate: (page: string) => void;
}

const roleColors: Record<string, { bg: string; text: string }> = {
  admin: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  editor: { bg: 'bg-sky-500/20', text: 'text-sky-400' },
  viewer: { bg: 'bg-slate-500/20', text: 'text-slate-400' },
};

export default function AdminUsers({ onNavigate }: AdminUsersProps) {
  const { logout, user, getAuthHeaders } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '', confirmPassword: '', role: 'viewer' });
  const [error, setError] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/admin/admin-users'), {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Fetch users error:', error);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match!');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters!');
      return;
    }

    const passwordStrength = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.])[A-Za-z\d@$!%*?&.]{8,}$/;
    if (!passwordStrength.test(formData.password)) {
      setError('Password must include upper/lowercase letters, a number, and a special character!');
      return;
    }

    try {
      const res = await fetch(apiUrl('/api/admin/admin-users'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          role: formData.role,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setShowModal(false);
        setFormData({ username: '', password: '', confirmPassword: '', role: 'viewer' });
        fetchUsers();
      } else {
        setError(data.error || 'Failed to create user');
      }
    } catch (error) {
      setError('An error occurred');
    }
  };

  const handleDelete = async (id: number, username: string) => {
    if (!confirm(`Are you sure you want to delete "${username}"?`)) return;
    
    try {
      const res = await fetch(apiUrl(`/api/admin/admin-users/${id}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (res.ok) {
        fetchUsers();
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
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
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">👥 Admin Users</h2>
            <p className="text-slate-400 mt-1">{users.length} users registered</p>
          </div>
          {user?.role === 'admin' && (
            <button onClick={() => setShowModal(true)} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-medium shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 transition-all flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              New User
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20"><div className="w-12 h-12 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin mx-auto"></div></div>
        ) : (
          <div className="space-y-4">
            {users.map((u) => (
              <div key={u.id} className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        {u.username}
                        {u.id === user?.id && <span className="text-xs text-sky-400">(siz)</span>}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${roleColors[u.role]?.bg} ${roleColors[u.role]?.text}`}>
                          {u.role === 'admin' ? 'Admin' : u.role === 'editor' ? 'Editor' : 'Viewer'}
                        </span>
                        <span className="text-slate-500 text-xs">Created: {new Date(u.createdAt).toLocaleDateString('en-US')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Last Login</p>
                      <p className="text-sm text-slate-300">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('en-US') : 'Not yet'}</p>
                    </div>
                    {user?.role === 'admin' && u.id !== user?.id && (
                      <button onClick={() => handleDelete(u.id, u.username)} className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-all">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                  </div>
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
              <h3 className="text-xl font-bold text-white">New Admin User</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Username *</label>
                <input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} required minLength={3} maxLength={50} className="w-full px-4 py-2.5 rounded-xl bg-slate-700/50 border border-white/10 text-white focus:outline-none focus:border-sky-500/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Password *</label>
                <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required className="w-full px-4 py-2.5 rounded-xl bg-slate-700/50 border border-white/10 text-white focus:outline-none focus:border-sky-500/50" />
                <p className="text-xs text-slate-500 mt-1">At least 8 characters, uppercase/lowercase, number, and special character</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Password Confirm *</label>
                <input type="password" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} required className="w-full px-4 py-2.5 rounded-xl bg-slate-700/50 border border-white/10 text-white focus:outline-none focus:border-sky-500/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Rol</label>
                <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-700/50 border border-white/10 text-white focus:outline-none focus:border-sky-500/50">
                  <option value="viewer">Viewer - Read only</option>
                  <option value="editor">Editor - Can edit</option>
                  <option value="admin">Admin - Tam yetki</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600 font-medium transition-all">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-medium shadow-lg hover:shadow-sky-500/25 transition-all">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

