import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';

interface AdminUser {
  id: number;
  username: string;
  role: string;
}

interface AuthContextType {
  user: AdminUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const csrfTokenRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const validateSession = async () => {
      try {
        const res = await fetch('/api/admin/me', {
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

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const trimmedUsername = username.trim();
      
      if (!trimmedUsername || !password) {
        return { success: false, error: 'Username and password are required' };
      }

      if (trimmedUsername.length > 50 || password.length > 100) {
        return { success: false, error: 'Invalid credentials' };
      }

      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: trimmedUsername, password }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        return { success: false, error: data.error || 'Login failed' };
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
      await fetch('/api/admin/logout', {
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
