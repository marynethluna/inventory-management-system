import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { setUnauthorizedHandler } from '../api/client';
import { can } from '../utils/permissions';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    try {
      const data = await api.get('/auth/me');
      setUser(data.user);
      return data.user;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setLoading(false);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (identifier, password) => {
    const data = await api.post('/auth/login', { identifier, password });
    setUser(data.user);
    return data.user;
  }, []);

  const signup = useCallback(async (name, email, password, confirmPassword) => {
    const data = await api.post('/auth/signup', { name, email, password, confirmPassword });
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Clear local auth state even if the network is unavailable. The server
      // also revokes the session version whenever it receives the logout call.
    }
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  const hasPermission = useCallback((permission) => can(user?.role, permission), [user?.role]);

  const value = useMemo(
    () => ({ user, loading, login, signup, logout, refresh, hasPermission, isAdmin: user?.role === 'Administrator' }),
    [user, loading, login, signup, logout, refresh, hasPermission]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
