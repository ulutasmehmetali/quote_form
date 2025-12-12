import { useEffect, useState } from 'react';
import { toDataURL } from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../../lib/api';

interface AdminSettingsProps {
  onNavigate: (page: string) => void;
  withChrome?: boolean;
}

const PASSWORD_HELP = '8-100 chars, upper & lower case, number, special character.';

export default function AdminSettings({ onNavigate, withChrome = true }: AdminSettingsProps) {
  const { logout, user, getAuthHeaders } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPasswords, setShowPasswords] = useState(false);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaUri, setMfaUri] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaQr, setMfaQr] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Array<{ sessionId: string; createdAt: number; lastActivity: number; ipAddress: string; userAgent?: string; current: boolean }>>([]);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [mfaStatusLoading, setMfaStatusLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match!' });
      return;
    }

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters!' });
      return;
    }

    if (newPassword.length > 100) {
      setMessage({ type: 'error', text: 'Password must be under 100 characters!' });
      return;
    }

    const passwordStrength = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.])[A-Za-z\d@$!%*?&.]{8,}$/;
    if (!passwordStrength.test(newPassword)) {
      setMessage({
        type: 'error',
        text: 'Include upper/lowercase letters, a number, and a special character.',
      });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const res = await fetch(apiUrl('/api/admin/change-password'), {
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
        setMessage({ type: 'success', text: 'Password changed successfully. Active sessions refreshed.' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to change password' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadSessions = async () => {
    setSessionLoading(true);
    try {
      const res = await fetch(apiUrl('/api/admin/sessions'), {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.sessions) {
        setSessions(data.sessions);
      }
    } catch {
      // ignore
    } finally {
      setSessionLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMfaStatus = async () => {
    setMfaStatusLoading(true);
    try {
      const res = await fetch(apiUrl('/api/admin/mfa/status'), {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setMfaEnabled(Boolean(data.enabled));
      }
    } catch {
      // ignore
    } finally {
      setMfaStatusLoading(false);
    }
  };

  useEffect(() => {
    loadMfaStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const generateQr = async () => {
      if (!mfaUri) {
        setMfaQr(null);
        return;
      }
      try {
        const url = await toDataURL(mfaUri);
        setMfaQr(url);
      } catch {
        setMfaQr(null);
      }
    };
    generateQr();
  }, [mfaUri]);

  const enrollMfa = async () => {
    try {
      const res = await fetch(apiUrl('/api/admin/mfa/enroll'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setMfaSecret(data.secret);
        setMfaUri(data.otpauth);
        setMfaEnabled(false);
        setMfaQr(null);
        setMessage({ type: 'success', text: 'MFA secret generated. Scan QR or copy code, then verify.' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Could not start MFA enrollment' });
      }
    } catch {
      setMessage({ type: 'error', text: 'MFA enrollment failed' });
    }
  };

  const verifyMfa = async () => {
    if (!mfaCode) return;
    try {
      const res = await fetch(apiUrl('/api/admin/mfa/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ code: mfaCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setMfaEnabled(true);
        setMessage({ type: 'success', text: 'MFA enabled for this account.' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Invalid MFA code' });
      }
    } catch {
      setMessage({ type: 'error', text: 'MFA verification failed' });
    }
  };

  const disableMfa = async () => {
    try {
      const res = await fetch(apiUrl('/api/admin/mfa/disable'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setMfaEnabled(false);
        setMfaSecret(null);
        setMfaUri(null);
        setMfaCode('');
        setMessage({ type: 'success', text: 'MFA disabled.' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to disable MFA' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Disable MFA failed' });
    }
  };

  const revokeSession = async (sessionId: string) => {
    try {
      const res = await fetch(apiUrl('/api/admin/sessions/revoke'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ sessionId }),
      });
      if (res.ok) {
        await loadSessions();
      }
    } catch {
      // ignore
    }
  };

  const renderStatusIcon = (type: 'success' | 'error') => (
    <span className="text-xl">
      {type === 'success' ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
    </span>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {withChrome && (
        <header data-admin-page-chrome className="bg-slate-900/50 backdrop-blur-xl border-b border-white/5 px-6 py-4 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-sky-500 to-indigo-500 rounded-xl blur opacity-40 group-hover:opacity-60 transition"></div>
                <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">M</div>
              </div>
              <div className="hidden sm:block">
                <h1 className="font-bold text-white text-lg">MIYOMINT</h1>
                <p className="text-sm text-slate-400 hidden sm:block">Admin Panel</p>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-1 bg-slate-800/50 rounded-2xl p-1">
              <button onClick={() => onNavigate('dashboard')} className="px-5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 font-medium transition-all">
                <span className="flex items-center gap-2">Dashboard</span>
              </button>
              <button onClick={() => onNavigate('submissions')} className="px-5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 font-medium transition-all">
                <span className="flex items-center gap-2">Submissions</span>
              </button>
              <button onClick={() => onNavigate('logs')} className="px-5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 font-medium transition-all">
                <span className="flex items-center gap-2">Logs</span>
              </button>
              <button onClick={() => onNavigate('settings')} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-medium shadow-lg shadow-sky-500/20">
                <span className="flex items-center gap-2">Settings</span>
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
      )}

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            Settings
          </h2>
          <p className="text-slate-400 mt-1">Manage your account and system settings</p>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{user?.username}</h3>
                <p className="text-slate-400">Admin Account</p>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                  Active
                </span>
              </div>
            </div>

            <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
              Change Password
            </h4>
            <p className="text-sm text-slate-400 mb-4">
              {PASSWORD_HELP} CSRF token is applied automatically from your session.
            </p>

            {message && (
              <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
                {renderStatusIcon(message.type)}
                {message.text}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Current Password</label>
                <div className="relative">
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">New Password</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={PASSWORD_HELP}
                  className="w-full px-4 py-3 rounded-xl bg-slate-700/50 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 transition-all"
                  required
                  minLength={8}
                  maxLength={100}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Confirm New Password</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
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
                  Show passwords
                </label>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-medium shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Change Password
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-semibold text-white flex items-center gap-2">Security</h4>
                  <p className="text-xs text-slate-400">Multi-factor auth (TOTP) and active sessions</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${mfaEnabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-700/60 text-slate-200 border border-white/10'}`}>
                  {mfaEnabled ? 'MFA Enabled' : 'MFA Off'}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-slate-300 font-semibold">MFA (TOTP)</p>
                    {mfaEnabled ? (
                      <button onClick={disableMfa} className="text-xs px-3 py-1 rounded-lg bg-red-500/20 text-red-200 border border-red-500/40 hover:bg-red-500/30">
                        Disable
                      </button>
                    ) : (
                      <button onClick={enrollMfa} className="text-xs px-3 py-1 rounded-lg bg-sky-500/20 text-sky-200 border border-sky-500/40 hover:bg-sky-500/30" disabled={mfaStatusLoading}>
                        {mfaStatusLoading ? 'Loading...' : 'Generate Secret'}
                      </button>
                    )}
                  </div>
                {mfaSecret && (
                  <div className="space-y-3 text-sm">
                    {mfaQr && (
                      <div className="flex flex-col items-start gap-2 bg-slate-800/60 rounded-lg p-3 border border-white/5">
                        <p className="text-slate-400 text-xs">Scan with Google Authenticator / Authy</p>
                        <img src={mfaQr} alt="MFA QR" className="w-36 h-36 rounded-md border border-white/10" />
                      </div>
                    )}
                    <div className="bg-slate-800/60 rounded-lg p-3 border border-white/5">
                      <p className="text-slate-400 text-xs mb-1">Secret</p>
                      <p className="text-white font-mono break-all">{mfaSecret}</p>
                    </div>
                    {mfaUri && (
                      <div className="bg-slate-800/60 rounded-lg p-3 border border-white/5">
                        <p className="text-slate-400 text-xs mb-1">URI</p>
                        <p className="text-white font-mono break-all text-xs">{mfaUri}</p>
                      </div>
                    )}
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="text-xs text-slate-400">Verification Code</label>
                        <input
                          type="text"
                          value={mfaCode}
                          onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                          placeholder="123456"
                          className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900/70 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
                          maxLength={6}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={verifyMfa}
                        className="px-4 py-2 rounded-lg bg-emerald-500/80 text-white font-semibold hover:bg-emerald-500 transition"
                      >
                        Verify
                      </button>
                    </div>
                  </div>
                )}
                {!mfaSecret && !mfaEnabled && (
                  <p className="text-xs text-slate-500">Generate a secret, scan it in an authenticator app, then verify with a 6-digit code.</p>
                )}
              </div>

              <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-slate-300 font-semibold">Active Sessions</p>
                  <button onClick={loadSessions} className="text-xs px-3 py-1 rounded-lg bg-slate-700 text-slate-200 border border-white/10 hover:bg-slate-600">
                    Refresh
                  </button>
                </div>
                {sessionLoading ? (
                  <div className="text-slate-500 text-sm">Loading sessions...</div>
                ) : sessions.length === 0 ? (
                  <div className="text-slate-500 text-sm">No sessions found.</div>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((s) => (
                      <div key={s.sessionId} className="rounded-lg border border-white/10 bg-slate-800/70 p-3 text-xs text-slate-200 flex items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full ${s.current ? 'bg-emerald-500/20 text-emerald-200' : 'bg-slate-700 text-slate-200'}`}>
                              {s.current ? 'Current' : 'Active'}
                            </span>
                            <span className="text-slate-400">IP {s.ipAddress || 'unknown'}</span>
                          </div>
                          <div className="text-slate-400 truncate max-w-xs">{s.userAgent || 'n/a'}</div>
                          <div className="text-slate-500">Last activity: {new Date(s.lastActivity).toLocaleString()}</div>
                        </div>
                        {!s.current && (
                          <button
                            onClick={() => revokeSession(s.sessionId)}
                            className="text-red-300 hover:text-red-200 text-xs font-semibold"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
            <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
              Admin Tools
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <button onClick={() => onNavigate('professionals')} className="p-4 rounded-xl bg-gradient-to-br from-sky-500/10 to-indigo-500/10 border border-sky-500/20 hover:border-sky-500/40 transition-all text-left group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">PR</div>
                  <div>
                    <p className="font-medium text-white">Professionals</p>
                    <p className="text-xs text-slate-400">Professionals and company management</p>
                  </div>
                </div>
              </button>
              <button onClick={() => onNavigate('users')} className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 hover:border-purple-500/40 transition-all text-left group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">AU</div>
                  <div>
                    <p className="font-medium text-white">Admin Users</p>
                    <p className="text-xs text-slate-400">Admin accounts</p>
                  </div>
                </div>
              </button>
              <button onClick={() => onNavigate('webhooks')} className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 hover:border-amber-500/40 transition-all text-left group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">WH</div>
                  <div>
                    <p className="font-medium text-white">Webhooks</p>
                    <p className="text-xs text-slate-400">External integrations</p>
                  </div>
                </div>
              </button>
              <button onClick={() => onNavigate('automations')} className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 hover:border-emerald-500/40 transition-all text-left group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">AT</div>
                  <div>
                    <p className="font-medium text-white">Automations</p>
                    <p className="text-xs text-slate-400">Workflow designer</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
            <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
              Partner API Integration
            </h4>
            <p className="text-slate-400 text-sm mb-4">Send customer data to your contracted partners automatically and track all deliveries.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button onClick={() => onNavigate('partners')} className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 hover:border-emerald-500/40 transition-all text-left group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">PA</div>
                  <div>
                    <p className="font-medium text-white">Partner APIs</p>
                    <p className="text-xs text-slate-400">API configuration and management</p>
                  </div>
                </div>
              </button>
              <button onClick={() => onNavigate('distribution-logs')} className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 hover:border-cyan-500/40 transition-all text-left group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">DL</div>
                  <div>
                    <p className="font-medium text-white">Distribution Logs</p>
                    <p className="text-xs text-slate-400">Delivery tracking and monitoring</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
            <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
              System Info
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-700/30 rounded-xl p-4 border border-white/5">
                <p className="text-xs text-slate-500">Version</p>
                <p className="text-white font-medium mt-1">v1.0.0</p>
              </div>
              <div className="bg-slate-700/30 rounded-xl p-4 border border-white/5">
                <p className="text-xs text-slate-500">Platform</p>
                <p className="text-white font-medium mt-1">MIYOMINT Admin</p>
              </div>
              <div className="bg-slate-700/30 rounded-xl p-4 border border-white/5">
                <p className="text-xs text-slate-500">User</p>
                <p className="text-white font-medium mt-1 truncate text-sm">{user?.username || 'N/A'}</p>
              </div>
              <div className="bg-slate-700/30 rounded-xl p-4 border border-white/5">
                <p className="text-xs text-slate-500">Status</p>
                <p className="text-emerald-400 font-medium mt-1 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                  Active
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
            <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
              Keyboard Shortcuts
            </h4>
            <div className="space-y-2">
              {[
                { keys: ['Alt', 'D'], action: 'Dashboard' },
                { keys: ['Alt', 'S'], action: 'Submissions' },
                { keys: ['Alt', 'L'], action: 'Logs' },
                { keys: ['Esc'], action: 'Close modal' },
              ].map(({ keys, action }) => (
                <div key={action} className="flex items-center justify-between py-2">
                  <span className="text-slate-400 text-sm">{action}</span>
                  <div className="flex items-center gap-1">
                    {keys.map((key, i) => (
                      <span key={key}>
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
              Danger Zone
            </h4>
            <p className="text-slate-400 text-sm mb-4">Logging out will end your session and you will need to sign in again.</p>
            <button
              onClick={logout}
              className="px-5 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 font-medium transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              End Session
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
