import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi, type AuthUser } from '../api/auth';
import { ApiError } from '../api/http';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  selectRole: (role: AuthUser['role']) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refetch: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser(me);
      return me;
    } catch (error) {
      if (!(error instanceof ApiError) || (error.status !== 401 && error.status !== 403)) {
        console.error('Failed to fetch /api/auth/me', error);
      }
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const selectRole = useCallback(async (role: AuthUser['role']) => {
    const nextUser = await authApi.selectRole(role);
    setUser(nextUser);
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    try {
      await authApi.logout();
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        console.error('Failed to POST /api/auth/logout', error);
      }
    } finally {
      window.location.assign('/');
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      selectRole,
      logout,
      refetch,
    }),
    [logout, loading, refetch, selectRole, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
