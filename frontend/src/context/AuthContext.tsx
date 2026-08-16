'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, ApiError, AuthUser, EarCalibration } from '@/lib/api';

interface AuthContextValue {
  user: AuthUser | null;

  loading: boolean;
  register: (input: { name: string; email: string; password: string }) => Promise<void>;
  login: (input: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  saveCalibration: (calibration: Omit<EarCalibration, 'calibratedAt'>) => Promise<void>;
  clearCalibration: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ user: AuthUser }>('/api/auth/me')
      .then((res) => { if (!cancelled) setUser(res.user); })
      .catch(() => { if (!cancelled) setUser(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const register = useCallback(async (input: { name: string; email: string; password: string }) => {
    const res = await api.post<{ user: AuthUser }>('/api/auth/register', input);
    setUser(res.user);
  }, []);

  const login = useCallback(async (input: { email: string; password: string }) => {
    const res = await api.post<{ user: AuthUser }>('/api/auth/login', input);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
    }
    setUser(null);
  }, []);

  const saveCalibration = useCallback(
    async (calibration: Omit<EarCalibration, 'calibratedAt'>) => {
      const res = await api.put<{ user: AuthUser }>('/api/me/calibration', calibration);
      setUser(res.user);
    },
    []
  );

  const clearCalibration = useCallback(async () => {
    const res = await api.del<{ user: AuthUser }>('/api/me/calibration');
    setUser(res.user);
  }, []);

  const value = useMemo(
    () => ({ user, loading, register, login, logout, saveCalibration, clearCalibration }),
    [user, loading, register, login, logout, saveCalibration, clearCalibration]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export { ApiError };
