import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface AdminSettingsProps {
  onNavigate: (page: string) => void;
}

export default function AdminSettings({ onNavigate }: AdminSettingsProps) {
  const { logout, user, getAuthHeaders } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPasswords, setShowPasswords] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Yeni şifreler eşleşmiyor!' });
      return;
    }
    
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Şifre en az 8 karakter olmalı!' });
      return;
    }
    
    const passwordStrength = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.])[A-Za-z\d@$!%*?&.]{8,}$/;
    if (!passwordStrength.test(newPassword)) {
      setMessage({ type: 'error', text: 'Şifre büyük harf, küçük harf, rakam ve özel karakter içermeli!' });
      return;
    }
    
    setIsLoading(true);
    setMessage(null);
    
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setMessage({ type: 'success', text: 'Şifre başarıyla değiştirildi!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setMessage({ type: 'error', text: data.error || 'Şifre değiştirilemedi' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Bir hata oluştu' });
    } finally {
      setIsLoading(false);
    }
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
            <button onClick={() => onNavigate('logs')} className="px-5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 font-medium transition-all">
              <span className="flex items-center gap-2">📜 Loglar</span>
            </button>
            <button onClick={() => onNavigate('settings')} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-medium shadow-lg shadow-sky-500/20">
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

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            ⚙️ Ayarlar
          </h2>
          <p className="text-slate-400 mt-1">Hesap ve sistem ayarlarını yönetin</p>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{user?.username}</h3>
                <p className="text-slate-400">Yönetici Hesabı</p>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                  Aktif
                </span>
              </div>
            </div>

            <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-lg">🔐</span> Şifre Değiştir
            </h4>

            {message && (
              <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
                <span className="text-xl">{message.type === 'success' ? '✅' : '❌'}</span>
                {message.text}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Mevcut Şifre</label>
                <div className="relative">
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Mevcut şifrenizi girin"
                    className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Yeni Şifre</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Yeni şifrenizi girin (min. 6 karakter)"
                  className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 transition-all"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Yeni Şifre (Tekrar)</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Yeni şifrenizi tekrar girin"
                  className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 transition-all"
                  required
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPasswords}
                    onChange={(e) => setShowPasswords(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-sky-500 focus:ring-sky-500/20"
                  />
                  Şifreleri göster
                </label>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-medium shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Kaydediliyor...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Şifreyi Değiştir
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
            <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-lg">🔧</span> Yönetim Araçları
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button onClick={() => onNavigate('professionals')} className="p-4 rounded-xl bg-gradient-to-br from-sky-500/10 to-indigo-500/10 border border-sky-500/20 hover:border-sky-500/40 transition-all text-left group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">👷</div>
                  <div>
                    <p className="font-medium text-white">Profesyoneller</p>
                    <p className="text-xs text-slate-400">Usta ve şirket yönetimi</p>
                  </div>
                </div>
              </button>
              <button onClick={() => onNavigate('users')} className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 hover:border-purple-500/40 transition-all text-left group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">👥</div>
                  <div>
                    <p className="font-medium text-white">Admin Kullanıcıları</p>
                    <p className="text-xs text-slate-400">Yönetici hesapları</p>
                  </div>
                </div>
              </button>
              <button onClick={() => onNavigate('webhooks')} className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 hover:border-amber-500/40 transition-all text-left group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">🔗</div>
                  <div>
                    <p className="font-medium text-white">Webhooks</p>
                    <p className="text-xs text-slate-400">Harici entegrasyonlar</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
            <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-lg">🤝</span> Partner API Entegrasyonu
            </h4>
            <p className="text-slate-400 text-sm mb-4">Müşteri verilerini otomatik olarak anlaşmalı partnerlerinize gönderin ve tüm gönderileri takip edin.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button onClick={() => onNavigate('partners')} className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 hover:border-emerald-500/40 transition-all text-left group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">🔌</div>
                  <div>
                    <p className="font-medium text-white">Partner API'ler</p>
                    <p className="text-xs text-slate-400">API yapılandırması ve yönetimi</p>
                  </div>
                </div>
              </button>
              <button onClick={() => onNavigate('distribution-logs')} className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 hover:border-cyan-500/40 transition-all text-left group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">📊</div>
                  <div>
                    <p className="font-medium text-white">Dağıtım Logları</p>
                    <p className="text-xs text-slate-400">Gönderim takibi ve izleme</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
            <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-lg">ℹ️</span> Sistem Bilgisi
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-700/30 rounded-xl p-4 border border-white/5">
                <p className="text-xs text-slate-500">Versiyon</p>
                <p className="text-white font-medium mt-1">v1.0.0</p>
              </div>
              <div className="bg-slate-700/30 rounded-xl p-4 border border-white/5">
                <p className="text-xs text-slate-500">Platform</p>
                <p className="text-white font-medium mt-1">MIYOMINT Admin</p>
              </div>
              <div className="bg-slate-700/30 rounded-xl p-4 border border-white/5">
                <p className="text-xs text-slate-500">Kullanıcı</p>
                <p className="text-white font-medium mt-1 truncate text-sm">{user?.username || 'N/A'}</p>
              </div>
              <div className="bg-slate-700/30 rounded-xl p-4 border border-white/5">
                <p className="text-xs text-slate-500">Durum</p>
                <p className="text-emerald-400 font-medium mt-1 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                  Aktif
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
            <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-lg">⌨️</span> Klavye Kısayolları
            </h4>
            <div className="space-y-2">
              {[
                { keys: ['Alt', 'D'], action: 'Dashboard' },
                { keys: ['Alt', 'S'], action: 'Başvurular' },
                { keys: ['Alt', 'R'], action: 'Raporlar' },
                { keys: ['Alt', 'L'], action: 'Loglar' },
                { keys: ['Esc'], action: 'Modal Kapat' },
              ].map(({ keys, action }) => (
                <div key={action} className="flex items-center justify-between py-2">
                  <span className="text-slate-400 text-sm">{action}</span>
                  <div className="flex items-center gap-1">
                    {keys.map((key, i) => (
                      <span key={i}>
                        <kbd className="px-2 py-1 bg-slate-700 border border-slate-600 rounded-lg text-xs text-white font-mono">{key}</kbd>
                        {i < keys.length - 1 && <span className="text-slate-500 mx-1">+</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
            <h4 className="font-semibold text-red-400 mb-4 flex items-center gap-2">
              <span className="text-lg">⚠️</span> Tehlikeli Bölge
            </h4>
            <p className="text-slate-400 text-sm mb-4">Çıkış yaptığınızda oturumunuz sonlandırılacak ve tekrar giriş yapmanız gerekecek.</p>
            <button
              onClick={logout}
              className="px-5 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 font-medium transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Oturumu Sonlandır
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
