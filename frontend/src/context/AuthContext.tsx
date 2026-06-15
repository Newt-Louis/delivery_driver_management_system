import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { User } from '../lib/types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadFromStorage(): { user: User | null; token: string | null } {
  try {
    const token = localStorage.getItem('token');
    const raw = localStorage.getItem('user');
    const user = raw ? (JSON.parse(raw) as User) : null;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = loadFromStorage();
  const [user, setUser] = useState<User | null>(stored.user);
  const [token, setToken] = useState<string | null>(stored.token);

  const login = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  const hasRole = useCallback(
    (...roles: string[]) => !!user && roles.includes(user.role),
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
