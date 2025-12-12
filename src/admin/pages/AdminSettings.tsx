import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../../lib/api';

interface AdminSettingsProps {
  onNavigate: (page: string) => void;
  withChrome?: boolean;
}

type AdminSession = {
  sessionId: string;
  createdAt: number;
  lastActivity: number;
  ipAddress: string;
  userAgent?: string;
  current: boolean;
  deviceName?: string;
  newDevice?: boolean;
  location?: {
    city?: string;
    country?: string;
    countryCode?: string;
    region?: string;
    timezone?: string;
  } | null;
};

type SignalTone = 'good' | 'warn' | 'neutral';

type SecuritySignal = {
  ip: string | null;
  failedAttempts: number;
  lockoutUntil: number | null;
  lockoutRemaining: number;
  isBanned: boolean;
};

type SecurityEvent = {
  id: number;
  action: string;
  adminId: number | null;
  adminUsername: string | null;
  entityType: string | null;
  entityId: number | null;
  details: Record<string, any> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

const PASSWORD_HELP = '8-100 chars, upper & lower case, number, special character.';

const formatRelativeTime = (timestamp: number) => {
  const diff = Date.now() - timestamp;
  const seconds = Math.max(1, Math.floor(diff / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
};

const detectOs = (ua: string) => {
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  return 'Unknown';
};

const detectBrowser = (ua: string) => {
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/Chrome\//i.test(ua)) return 'Chrome';
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'Safari';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  return 'Browser';
};

const getClientSummary = (ua?: string) => {
  const normalized = ua || '';
  return {
    os: detectOs(normalized),
    browser: detectBrowser(normalized),
  };
};

const formatLocation = (loc?: AdminSession['location']) => {
  if (!loc) return 'Konum bilinmiyor';
  const parts = [loc.city, loc.region, loc.country].filter(Boolean);
  return parts.length ? parts.join(', ') : 'Konum bilinmiyor';
};

const countryCodeToFlag = (code?: string) => {
  if (!code) return '';
  const cleaned = code.toUpperCase();
  if (cleaned.length !== 2) return '';
  const A = 0x1f1e6;
  const flag = String.fromCodePoint(
    A + cleaned.charCodeAt(0) - 65,
    A + cleaned.charCodeAt(1) - 65,
  );
  return flag;
};

const evaluatePassword = (password: string) => {
  const checks = {
    length: password.length >= 8,
    maxLength: password.length <= 100,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[@$!%*?&.]/.test(password),
  };

  const passed = Object.values(checks).filter(Boolean).length;
  const percent = Math.min(100, Math.round((passed / Object.keys(checks).length) * 100));

  const label =
    passed <= 2 ? 'Weak' : passed <= 4 ? 'Okay' : passed === 5 ? 'Strong' : 'Excellent';

  return { checks, percent, label };
};

export default function AdminSettings({ onNavigate, withChrome = true }: AdminSettingsProps) {
  const { logout, user, getAuthHeaders } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPasswords, setShowPasswords] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaSecret, setMfaSecret] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [mfaMessage, setMfaMessage] = useState<{ type: 'info' | 'error' | 'success'; text: string } | null>(null);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [lastSessionRefresh, setLastSessionRefresh] = useState<number | null>(null);
  const [autoRefreshSessions, setAutoRefreshSessions] = useState(true);
  const [bulkRevokeLoading, setBulkRevokeLoading] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);
  const [securitySignals, setSecuritySignals] = useState<SecuritySignal | null>(null);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [policyMaxSessions, setPolicyMaxSessions] = useState<number | null>(null);
  const [policySaving, setPolicySaving] = useState(false);
  const [revokeAllLoading, setRevokeAllLoading] = useState(false);
  const [sessionLabels, setSessionLabels] = useState<Record<string, string>>({});

  const passwordStrength = useMemo(() => evaluatePassword(newPassword), [newPassword]);

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort(
        (a, b) =>
          Number(b.current) - Number(a.current) || b.lastActivity - a.lastActivity || b.createdAt - a.createdAt,
      ),
    [sessions],
  );

  const revokableSessions = useMemo(() => sessions.filter((s) => !s.current), [sessions]);

  const sessionInsights = useMemo(() => {
    const staleThreshold = 1000 * 60 * 60 * 24 * 3; // 3 days without activity is considered stale
    const staleSessions = sessions.filter((s) => Date.now() - s.lastActivity > staleThreshold).length;
    const newestSession = [...sessions].sort((a, b) => b.lastActivity - a.lastActivity)[0] || null;
    const newDeviceSessions = sessions.filter((s) => s.newDevice).length;

    return {
      count: sessions.length,
      stale: staleSessions,
      newest: newestSession,
      newDevices: newDeviceSessions,
    };
  }, [sessions]);

  const securitySignalCards = useMemo<Array<{ title: string; value: string; tone: SignalTone; hint: string }>>(
    () => [
      {
        title: 'Multi-factor auth',
        value: mfaEnabled ? 'Enabled' : 'Off',
        tone: mfaEnabled ? 'good' : 'warn',
        hint: mfaEnabled ? 'TOTP required on every admin login.' : 'Turn on MFA to block account takeover.',
      },
      {
        title: 'Active sessions',
        value: sessionInsights.newDevices ? `${sessionInsights.count} · ${sessionInsights.newDevices} yeni` : `${sessionInsights.count}`,
        tone: sessionInsights.stale || sessionInsights.newDevices ? 'warn' : 'good',
        hint:
          sessionInsights.count === 0
            ? 'No active admin sessions detected.'
            : sessionInsights.stale
              ? `${sessionInsights.stale} session${sessionInsights.stale > 1 ? 's' : ''} idle over 3 days.`
              : sessionInsights.newDevices
                ? `${sessionInsights.newDevices} yeni cihaz oturumu. Doğrula veya iptal et.`
                : 'All sessions recently active.',
      },
      {
        title: 'Login denemeleri',
        value: securitySignals ? `${securitySignals.failedAttempts} hata` : 'Bilinmiyor',
        tone: securitySignals && (securitySignals.failedAttempts >= 3 || securitySignals.isBanned) ? 'warn' : 'neutral',
        hint: securitySignals
          ? securitySignals.isBanned
            ? 'IP banlı. Gerekirse kaldırın.'
            : securitySignals.lockoutRemaining > 0
              ? `Kilitlenme süresi: ~${Math.ceil(securitySignals.lockoutRemaining / 1000)}s`
              : 'Hatalı deneme sayısı sıfırlanıncaya kadar izleyin.'
          : 'Giriş sinyalleri yüklenemedi.',
      },
      {
        title: 'Password policy',
        value: newPassword ? passwordStrength.label : 'Strict',
        tone: newPassword && passwordStrength.label === 'Weak' ? 'warn' : newPassword ? 'good' : 'neutral',
        hint: newPassword ? 'Draft strength preview updates as you type.' : PASSWORD_HELP,
      },
      {
        title: 'Session refresh',
        value: lastSessionRefresh ? formatRelativeTime(lastSessionRefresh) : 'Not synced',
        tone: lastSessionRefresh ? 'good' : 'neutral',
        hint: autoRefreshSessions ? 'Auto-refresh is on (60s).' : 'Auto-refresh paused.',
      },
    ],
    [autoRefreshSessions, lastSessionRefresh, mfaEnabled, newPassword, passwordStrength.label, securitySignals, sessionInsights.count, sessionInsights.newDevices, sessionInsights.stale],
  );

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

    const passwordPolicyRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.])[A-Za-z\d@$!%*?&.]{8,}$/;
    if (!passwordPolicyRegex.test(newPassword)) {
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

  const loadSessions = useCallback(async () => {
    setSessionLoading(true);
    try {
      const res = await fetch(apiUrl('/api/admin/sessions'), {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        if (data.sessions) {
          setSessions(data.sessions);
        }
        setLastSessionRefresh(Date.now());
      }
    } catch {
      // ignore
    } finally {
      setSessionLoading(false);
    }
  }, [getAuthHeaders]);

  const loadMfaStatus = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/admin/mfa/status'), {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setMfaEnabled(Boolean(data.enabled));
      } else {
        setMfaEnabled(false);
      }
    } catch {
      setMfaEnabled(false);
    }
  }, [getAuthHeaders]);

  const loadSecuritySignals = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/admin/security/signals'), {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setSecuritySignals(data);
      }
    } catch {
      // ignore
    }
  }, [getAuthHeaders]);

  const loadSecurityEvents = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/admin/security/events?limit=10'), {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.events)) {
        setSecurityEvents(data.events);
      }
    } catch {
      // ignore
    }
  }, [getAuthHeaders]);

  const loadSessionPolicy = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/admin/session-policy'), {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.maxSessions) {
        setPolicyMaxSessions(data.maxSessions);
      }
    } catch {
      // ignore
    }
  }, [getAuthHeaders]);

  const startMfaEnroll = async () => {
    setMfaLoading(true);
    setMfaMessage(null);
    try {
      const res = await fetch(apiUrl('/api/admin/mfa/enroll'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setMfaSecret(data.secret);
        setSecretCopied(false);
        setMfaEnabled(false);
        setMfaMessage({ type: 'info', text: 'Scan or enter the secret in your authenticator app, then enter a 6-digit code to verify.' });
        if (data.otpAuthUrl) {
          try {
            const url = await QRCode.toDataURL(data.otpAuthUrl, { width: 200, margin: 1 });
            setQrDataUrl(url);
          } catch {
            setQrDataUrl('');
          }
        } else {
          setQrDataUrl('');
        }
      } else {
        setMfaMessage({ type: 'error', text: data.error || 'Could not start MFA enrollment.' });
        setQrDataUrl('');
      }
    } catch {
      setMfaMessage({ type: 'error', text: 'Could not start MFA enrollment.' });
      setQrDataUrl('');
    } finally {
      setMfaLoading(false);
    }
  };

  const verifyMfa = async () => {
    if (otpCode.trim().length !== 6) {
      setMfaMessage({ type: 'error', text: 'Enter a 6-digit code from your authenticator app.' });
      return;
    }
    setMfaLoading(true);
    setMfaMessage(null);
    try {
      const res = await fetch(apiUrl('/api/admin/mfa/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ otp: otpCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setMfaEnabled(true);
        setMfaSecret('');
        setOtpCode('');
        setQrDataUrl('');
        setSecretCopied(false);
        setMfaMessage({ type: 'success', text: 'MFA enabled successfully.' });
      } else {
        setMfaMessage({ type: 'error', text: data.error || 'Verification failed.' });
      }
    } catch {
      setMfaMessage({ type: 'error', text: 'Verification failed.' });
    } finally {
      setMfaLoading(false);
    }
  };

  const disableMfa = async () => {
    setMfaLoading(true);
    setMfaMessage(null);
    try {
      const res = await fetch(apiUrl('/api/admin/mfa/disable'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setMfaEnabled(false);
        setMfaSecret('');
        setOtpCode('');
        setQrDataUrl('');
        setSecretCopied(false);
        setMfaMessage({ type: 'success', text: 'MFA disabled.' });
      } else {
        setMfaMessage({ type: 'error', text: data.error || 'Failed to disable MFA.' });
      }
    } catch {
      setMfaMessage({ type: 'error', text: 'Failed to disable MFA.' });
    } finally {
      setMfaLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
    loadMfaStatus();
    loadSecuritySignals();
    loadSecurityEvents();
    loadSessionPolicy();
  }, [loadMfaStatus, loadSecurityEvents, loadSecuritySignals, loadSessionPolicy, loadSessions]);

  useEffect(() => {
    if (!autoRefreshSessions) return undefined;
    const interval = setInterval(() => {
      loadSessions();
      loadSecuritySignals();
    }, 60000);
    return () => clearInterval(interval);
  }, [autoRefreshSessions, loadSecuritySignals, loadSessions]);

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

  const revokeOtherSessions = async () => {
    if (!sessions.length) return;
    setBulkRevokeLoading(true);
    try {
      const others = sessions.filter((s) => !s.current);
      for (const session of others) {
        await fetch(apiUrl('/api/admin/sessions/revoke'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          credentials: 'include',
          body: JSON.stringify({ sessionId: session.sessionId }),
        });
      }
      if (others.length) {
        await loadSessions();
      }
    } catch {
      // ignore
    } finally {
      setBulkRevokeLoading(false);
    }
  };

  const revokeAllSessions = async () => {
    setRevokeAllLoading(true);
    try {
      const res = await fetch(apiUrl('/api/admin/sessions/revoke-all'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
      });
      const data = await res.json();
      await loadSessions();
      if (data?.currentRevoked) {
        logout();
      }
    } catch {
      // ignore
    } finally {
      setRevokeAllLoading(false);
    }
  };

  const saveSessionPolicy = async (value: number) => {
    setPolicySaving(true);
    try {
      const res = await fetch(apiUrl('/api/admin/session-policy'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ maxSessions: value }),
      });
      const data = await res.json();
      if (res.ok && data.maxSessions) {
        setPolicyMaxSessions(data.maxSessions);
      }
    } catch {
      // ignore
    } finally {
      setPolicySaving(false);
    }
  };

  const renameSession = async (sessionId: string, label: string) => {
    const trimmed = label.trim().slice(0, 120);
    if (!trimmed) return;
    setSessionLabels((prev) => ({ ...prev, [sessionId]: trimmed }));
    try {
      const res = await fetch(apiUrl('/api/admin/sessions/label'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ sessionId, deviceName: trimmed }),
      });
      if (res.ok) {
        await loadSessions();
      }
    } catch {
      // ignore
    }
  };

  const banCurrentIp = async () => {
    if (!securitySignals?.ip) return;
    try {
      await fetch(apiUrl('/api/admin/blacklist'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ ipAddress: securitySignals.ip, reason: 'Manual admin ban' }),
      });
      await loadSecuritySignals();
    } catch {
      // ignore
    }
  };

  const unbanCurrentIp = async () => {
    if (!securitySignals?.ip) return;
    try {
      await fetch(apiUrl(`/api/admin/blacklist/${encodeURIComponent(securitySignals.ip)}`), {
        method: 'DELETE',
        headers: { ...getAuthHeaders() },
        credentials: 'include',
      });
      await loadSecuritySignals();
    } catch {
      // ignore
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };

  const handleCopySecret = async () => {
    if (!mfaSecret) return;
    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard not available');
      }
      await navigator.clipboard.writeText(mfaSecret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    } catch {
      setMfaMessage({ type: 'error', text: 'Could not copy secret automatically. Copy manually instead.' });
    }
  };

const badgeToneClass = (tone: SignalTone) => {
  if (tone === 'good') return 'bg-emerald-500/10 border-emerald-500/25 text-emerald-100';
  if (tone === 'warn') return 'bg-amber-500/10 border-amber-500/25 text-amber-100';
  return 'bg-white/5 border-white/10 text-slate-200';
};

const describeSecurityEvent = (event: SecurityEvent) => {
  const map: Record<string, string> = {
    login_success: 'Giriş başarılı',
    logout: 'Çıkış yapıldı',
    ip_banned: 'IP banlandı',
    ip_unbanned: 'IP banı kaldırıldı',
    new_device_login: 'Yeni cihaz girişi',
    session_ip_mismatch: 'Oturum IP değişti',
    ip_banned_manual: 'IP ban (manuel)',
  };
  return map[event.action] || event.action;
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
            <div className="hidden sm:block">
              <h1 className="font-bold text-white text-lg">Admin Panel</h1>
              <p className="text-sm text-slate-400 hidden sm:block">Settings</p>
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

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            Settings
          </h2>
          <p className="text-slate-400 mt-1">Manage your account and system settings</p>
        </div>

        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {securitySignalCards.map((signal) => (
              <div key={signal.title} className="rounded-2xl border border-white/5 bg-slate-800/60 p-4 shadow-lg shadow-slate-900/20">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">{signal.title}</p>
                  <span className={`px-2 py-1 text-[11px] font-semibold rounded-lg border ${badgeToneClass(signal.tone)}`}>
                    {signal.tone === 'good' ? 'Healthy' : signal.tone === 'warn' ? 'Action' : 'Watch'}
                  </span>
                </div>
                <p className="text-2xl font-bold text-white mt-2">{signal.value}</p>
                <p className="text-sm text-slate-400 mt-1 leading-relaxed">{signal.hint}</p>
                {signal.title === 'Active sessions' && sessionInsights.newest && (
                  <p className="text-[11px] text-slate-500 mt-2">
                    Latest: {getClientSummary(sessionInsights.newest.userAgent).os} · {formatRelativeTime(sessionInsights.newest.lastActivity)}
                  </p>
                )}
              </div>
            ))}
          </div>

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

              <div className="grid sm:grid-cols-2 gap-3 text-sm text-slate-400">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase tracking-wide">Password strength</span>
                    <span className={`px-2 py-1 rounded-lg border text-[11px] font-semibold ${badgeToneClass(passwordStrength.label === 'Weak' ? 'warn' : passwordStrength.label === 'Excellent' ? 'good' : 'neutral')}`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-700/70 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 via-sky-500 to-emerald-400 transition-all"
                      style={{ width: `${Math.max(8, passwordStrength.percent)}%` }}
                    ></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: '8+ chars', ok: passwordStrength.checks.length },
                    { label: '<= 100 chars', ok: passwordStrength.checks.maxLength },
                    { label: 'Uppercase', ok: passwordStrength.checks.upper },
                    { label: 'Lowercase', ok: passwordStrength.checks.lower },
                    { label: 'Number', ok: passwordStrength.checks.number },
                    { label: 'Special char', ok: passwordStrength.checks.special },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`flex items-center gap-2 px-2 py-1 rounded-lg border text-[11px] ${
                        item.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-white/10 bg-white/5 text-slate-400'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          item.ok ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-500'
                        }`}
                      >
                        {item.ok ? '✓' : ''}
                      </span>
                      {item.label}
                    </div>
                  ))}
                </div>
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
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-semibold text-white flex items-center gap-2">Security</h4>
                <p className="text-xs text-slate-400">Multi-factor auth (TOTP) and active sessions</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${mfaEnabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-700/60 text-slate-200 border border-white/10'}`}>
                {mfaEnabled ? 'MFA Enabled' : 'MFA Off'}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-300 font-semibold">MFA (TOTP)</p>
                    <p className="text-xs text-slate-500">{mfaEnabled ? 'MFA is active for this account.' : 'Generate a secret, scan it, then verify with a 6-digit code.'}</p>
                  </div>
                  <button
                    onClick={disableMfa}
                    disabled={!mfaEnabled || mfaLoading}
                    className="text-xs px-3 py-1 rounded-lg bg-red-500/15 text-red-200 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-50"
                  >
                    Disable
                  </button>
                </div>

                {mfaMessage && (
                  <div className={`p-3 rounded-lg text-xs ${mfaMessage.type === 'error' ? 'bg-red-500/10 text-red-300 border border-red-500/30' : mfaMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/30' : 'bg-sky-500/10 text-sky-100 border border-sky-500/30'}`}>
                    {mfaMessage.text}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                  {['Generate secret', 'Scan or paste secret', 'Enter 6-digit code'].map((step, idx) => (
                    <span key={step} className="px-2 py-1 rounded-lg bg-white/5 border border-white/10">
                      {idx + 1}. {step}
                    </span>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={startMfaEnroll}
                    disabled={mfaLoading}
                    className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 border border-white/10 hover:bg-slate-600 disabled:opacity-50 text-sm"
                  >
                    {mfaLoading ? 'Working...' : 'Generate Secret'}
                  </button>
                  {!mfaEnabled && (
                    <button
                      onClick={verifyMfa}
                      disabled={mfaLoading || otpCode.length !== 6}
                      className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-100 border border-emerald-500/40 hover:bg-emerald-500/30 disabled:opacity-50 text-sm"
                    >
                      Verify
                    </button>
                  )}
                </div>

                {qrDataUrl ? (
                  <div className="bg-slate-800/80 border border-white/10 rounded-lg p-3 text-xs text-slate-200 space-y-2">
                    <p className="text-slate-400">Scan this QR in your authenticator app, then enter the 6-digit code.</p>
                    <div className="flex justify-center">
                      <img src={qrDataUrl} alt="MFA QR Code" className="w-40 h-40 bg-white p-2 rounded-lg" />
                    </div>
                    {mfaSecret && (
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <p className="flex-1 break-all">Secret: {mfaSecret}</p>
                        <button
                          type="button"
                          onClick={handleCopySecret}
                          className="px-2 py-1 rounded-md bg-slate-700 text-slate-200 border border-white/10 hover:bg-slate-600"
                        >
                          {secretCopied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  mfaSecret && (
                    <div className="bg-slate-800/80 border border-white/10 rounded-lg p-3 text-xs text-slate-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Secret</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="block text-sm break-all flex-1">{mfaSecret}</code>
                        <button
                          type="button"
                          onClick={handleCopySecret}
                          className="px-2 py-1 rounded-md bg-slate-700 text-slate-200 border border-white/10 hover:bg-slate-600 whitespace-nowrap"
                        >
                          {secretCopied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500">Scan or type this in Authy / Google Authenticator, then enter the 6-digit code below.</p>
                    </div>
                  )
                )}

                {!mfaEnabled && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-300">Authentication Code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit code"
                      className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 transition-all"
                    />
                  </div>
                )}
              </div>

              <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4">
                {sessionInsights.newDevices > 0 && (
                  <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-100 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse"></span>
                    {sessionInsights.newDevices} yeni cihaz oturumu var. Kontrol edip gerekirse iptal edin.
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm text-slate-300 font-semibold">Active Sessions</p>
                    <p className="text-xs text-slate-500">Auto-refresh keeps idle sessions visible so you can revoke quickly.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-800/60 border border-white/10 rounded-lg px-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={autoRefreshSessions}
                        onChange={(e) => setAutoRefreshSessions(e.target.checked)}
                        className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-sky-500 focus:ring-sky-500/20"
                      />
                      Auto-refresh
                    </label>
                    {lastSessionRefresh && (
                      <span className="text-[11px] text-slate-500 px-2 py-1 rounded-lg bg-white/5 border border-white/10">
                        Synced {formatRelativeTime(lastSessionRefresh)}
                      </span>
                    )}
                    <button onClick={loadSessions} className="text-xs px-3 py-1 rounded-lg bg-slate-700 text-slate-200 border border-white/10 hover:bg-slate-600 disabled:opacity-50" disabled={sessionLoading}>
                      {sessionLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                    <button
                      onClick={revokeOtherSessions}
                      disabled={bulkRevokeLoading || revokableSessions.length === 0}
                      className="text-xs px-3 py-1 rounded-lg bg-red-500/15 text-red-200 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-50"
                    >
                      {bulkRevokeLoading ? 'Revoking...' : 'Revoke others'}
                    </button>
                    <button
                      onClick={revokeAllSessions}
                      disabled={revokeAllLoading || sessions.length === 0}
                      className="text-xs px-3 py-1 rounded-lg bg-red-600/20 text-red-100 border border-red-500/40 hover:bg-red-600/30 disabled:opacity-50"
                    >
                      {revokeAllLoading ? 'Closing...' : 'Hepsini kapat'}
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 mb-4 text-xs text-slate-300">
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                    <span className="text-[11px] text-slate-400">Oturum limiti</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={policyMaxSessions ?? ''}
                      onChange={(e) => setPolicyMaxSessions(Number(e.target.value))}
                      className="w-16 rounded-lg bg-slate-800 border border-white/10 px-2 py-1 text-white text-sm"
                    />
                    <button
                      onClick={() => policyMaxSessions && saveSessionPolicy(policyMaxSessions)}
                      disabled={policySaving || !policyMaxSessions}
                      className="px-3 py-1 rounded-lg bg-slate-700 text-slate-200 border border-white/10 hover:bg-slate-600 disabled:opacity-50"
                    >
                      {policySaving ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                    <span className="text-slate-500 text-[11px]">Kullanıcı bazlı maksimum oturum</span>
                  </div>
                  {securitySignals?.ip && (
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                      <span className="text-[11px] text-slate-400">IP</span>
                      <span className="text-slate-200">{securitySignals.ip}</span>
                      <button
                        onClick={() => copyToClipboard(securitySignals.ip || '')}
                        className="px-2 py-1 rounded-lg bg-slate-700 text-slate-200 border border-white/10 hover:bg-slate-600"
                      >
                        Kopyala
                      </button>
                      {securitySignals.isBanned ? (
                        <button
                          onClick={unbanCurrentIp}
                          className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-100 border border-emerald-500/40 hover:bg-emerald-500/30"
                        >
                          Ban kaldır
                        </button>
                      ) : (
                        <button
                          onClick={banCurrentIp}
                          className="px-2 py-1 rounded-lg bg-red-500/20 text-red-100 border border-red-500/40 hover:bg-red-500/30"
                        >
                          IP banla
                        </button>
                      )}
                      {securitySignals.lockoutRemaining > 0 && (
                        <span className="text-amber-200 text-[11px] px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40">
                          Kilit: ~{Math.ceil(securitySignals.lockoutRemaining / 1000)}s
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {sessionLoading ? (
                  <div className="text-slate-500 text-sm">Loading sessions...</div>
                ) : sessions.length === 0 ? (
                  <div className="text-slate-500 text-sm">No sessions found.</div>
                ) : (
                  <div className="space-y-2">
                    {sortedSessions.map((s) => {
                      const client = getClientSummary(s.userAgent);
                      const isIdle = Date.now() - s.lastActivity > 1000 * 60 * 60 * 24 * 3;
                      const locationLabel = formatLocation(s.location);
                      return (
                        <div key={s.sessionId} className="rounded-lg border border-white/10 bg-slate-800/70 p-3 text-xs text-slate-200 flex items-center justify-between gap-3">
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center flex-wrap gap-2">
                              <span className={`px-2 py-0.5 rounded-full ${s.current ? 'bg-emerald-500/20 text-emerald-200' : 'bg-slate-700 text-slate-200'}`}>
                                {s.current ? 'Current' : 'Active'}
                              </span>
                              {s.newDevice && <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-100 border border-amber-500/30">Yeni cihaz</span>}
                              <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300 flex items-center gap-1">
                                <span>IP {s.ipAddress || 'unknown'}</span>
                                {s.ipAddress && (
                                  <button
                                    onClick={() => copyToClipboard(s.ipAddress || '')}
                                    className="px-1 py-0.5 rounded bg-slate-700 text-[10px] text-slate-200 border border-white/10 hover:bg-slate-600"
                                  >
                                    Kopyala
                                  </button>
                                )}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300">{client.os}</span>
                              <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300">{client.browser}</span>
                              {isIdle && <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-100 border border-amber-500/30">Idle</span>}
                            </div>
                            <div className="text-slate-400 truncate max-w-xs">{s.userAgent || 'n/a'}</div>
                            <div className="flex items-center gap-3 text-slate-500">
                              <span>Started {formatRelativeTime(s.createdAt)}</span>
                              <span className="text-slate-700">•</span>
                              <span>Last active {formatRelativeTime(s.lastActivity)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-400">
                              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[11px]">Konum</span>
                              <span className="truncate flex items-center gap-1">
                                {countryCodeToFlag(s.location?.countryCode)} {locationLabel}
                              </span>
                              {s.location?.timezone && (
                                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] text-slate-300">
                                  {s.location.timezone}
                                </span>
                              )}
                            </div>
                            {s.deviceName && (
                              <div className="flex items-center gap-2 text-slate-400 flex-wrap">
                                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[11px]">Cihaz</span>
                                <span className="truncate max-w-[240px]">{s.deviceName}</span>
                                <button
                                  onClick={() => {
                                    const next = window.prompt('Cihazı adlandır', s.deviceName || sessionLabels[s.sessionId] || '');
                                    if (next) renameSession(s.sessionId, next);
                                  }}
                                  className="px-2 py-1 rounded bg-slate-700 text-slate-200 border border-white/10 hover:bg-slate-600 text-[11px]"
                                >
                                  Düzenle
                                </button>
                              </div>
                            )}
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
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-semibold text-white flex items-center gap-2">Güvenlik Olayları</h4>
                <p className="text-xs text-slate-400">Son giriş ve güvenlik aksiyonları (son 10)</p>
              </div>
              <button
                onClick={() => { loadSecurityEvents(); loadSecuritySignals(); }}
                className="text-xs px-3 py-1 rounded-lg bg-slate-700 text-slate-200 border border-white/10 hover:bg-slate-600"
              >
                Yenile
              </button>
            </div>
            {securityEvents.length === 0 ? (
              <p className="text-slate-500 text-sm">Kayıt bulunamadı.</p>
            ) : (
              <div className="space-y-2">
                {securityEvents.map((evt) => (
                  <div key={evt.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-200 gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">{describeSecurityEvent(evt)}</p>
                      <p className="text-slate-400 truncate">
                        {evt.details?.deviceName ? `Cihaz: ${String(evt.details.deviceName)}` : ''}
                        {evt.ipAddress ? ` IP: ${evt.ipAddress}` : ''}
                      </p>
                    </div>
                    <div className="text-slate-500 whitespace-nowrap">
                      {new Date(evt.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-6">
            <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
              Admin Tools
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
