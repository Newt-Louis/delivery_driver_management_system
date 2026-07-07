import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import type { User } from '../lib/types';
import api from '../lib/api';
import { clearAuthToken, getAuthToken, setAuthToken } from '../lib/authCookies';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (token: string, user: User, maxAgeSeconds?: number) => void;
  logout: () => Promise<void>;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function clearLegacyLocalAuth(): void {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  } catch {
    // Ignore storage access errors in restricted browser contexts.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => getAuthToken());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    clearLegacyLocalAuth();

    async function bootstrap() {
      const currentToken = getAuthToken();
      setToken(currentToken);
      if (!currentToken) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      try {
        const res = await api.get('/api/auth/me');
        if (!cancelled) {
          setUser(res.data.user);
          setToken(getAuthToken());
        }
      } catch {
        if (!cancelled) {
          clearAuthToken();
          setUser(null);
          setToken(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback((newToken: string, newUser: User, maxAgeSeconds = 8 * 60 * 60) => {
    clearLegacyLocalAuth();
    setAuthToken(newToken, maxAgeSeconds);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Local logout must still complete if the token is already expired.
    }
    clearLegacyLocalAuth();
    clearAuthToken();
    setToken(null);
    setUser(null);
  }, []);

  const hasRole = useCallback(
    (...roles: string[]) => !!user && roles.includes(user.role),
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading, isAuthenticated: !!token && !!user, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
