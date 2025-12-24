import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { apiUrl } from '../../lib/api';

interface AdminUser {
  id: number;
  username: string;
  role: string;
  mfaEnabled?: boolean;
}

interface AuthContextType {
  user: AdminUser | null;
  isLoading: boolean;
  login: (username: string, password: string, otp?: string) => Promise<{ success: boolean; error?: string; requiresMfa?: boolean }>;
  logout: () => void;
  getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function buildDeviceName() {
  if (typeof navigator === 'undefined') return 'Unknown device';
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';

  let os = 'Device';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (platform) os = platform;

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';

  return `${os} · ${browser}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const csrfTokenRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const validateSession = async () => {
      try {
        const res = await fetch(apiUrl('/api/admin/me'), {
          credentials: 'include',
          headers: sessionIdRef.current ? { 'x-session-id': sessionIdRef.current } : {},
        });

        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
            if (data.csrfToken) {
              csrfTokenRef.current = data.csrfToken;
            }
          } else {
            clearSession();
          }
        } else {
          clearSession();
        }
      } catch {
        clearSession();
      } finally {
        setIsLoading(false);
      }
    };

    validateSession();
  }, []);

  const clearSession = () => {
    csrfTokenRef.current = null;
    sessionIdRef.current = null;
    setUser(null);
  };

  const login = async (username: string, password: string, otp?: string): Promise<{ success: boolean; error?: string; requiresMfa?: boolean }> => {
    try {
      const trimmedUsername = username.trim();
      
      if (!trimmedUsername || !password) {
        return { success: false, error: 'Username and password are required' };
      }

      if (trimmedUsername.length > 50 || password.length > 100) {
        return { success: false, error: 'Invalid credentials' };
      }

      const res = await fetch(apiUrl('/api/admin/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: trimmedUsername, password, otp, deviceName: buildDeviceName() }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        return { success: false, error: data.error || 'Login failed', requiresMfa: data.requiresMfa };
      }
      
      if (data.success) {
        if (data.sessionId) {
          sessionIdRef.current = data.sessionId;
        }
        if (data.csrfToken) {
          csrfTokenRef.current = data.csrfToken;
        }
        setUser(data.user);
        return { success: true };
      }
      
      return { success: false, error: 'Login failed' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const logout = async () => {
    try {
      await fetch(apiUrl('/api/admin/logout'), {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
    } catch {
      // Ignore logout errors
    }
    clearSession();
  };

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (sessionIdRef.current) {
      headers['x-session-id'] = sessionIdRef.current;
    }
    if (csrfTokenRef.current) {
      headers['x-csrf-token'] = csrfTokenRef.current;
    }
    return headers;
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, getAuthHeaders }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
