import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, tokenStore } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [status, setStatus] = useState(tokenStore.get() ? 'checking' : 'signed-out');

  // Validate a stored token on load.
  useEffect(() => {
    if (status !== 'checking') return;
    authApi
      .me()
      .then((a) => {
        setAdmin(a);
        setStatus('signed-in');
      })
      .catch(() => {
        tokenStore.clear();
        setStatus('signed-out');
      });
  }, [status]);

  useEffect(() => {
    const onExpired = () => {
      setAdmin(null);
      setStatus('signed-out');
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const login = useCallback(async ({ email, password, remember }) => {
    const { token, admin: a } = await authApi.login({ email, password, remember });
    tokenStore.set(token, remember);
    setAdmin(a);
    setStatus('signed-in');
    return a;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setAdmin(null);
    setStatus('signed-out');
  }, []);

  const value = useMemo(
    () => ({ admin, setAdmin, status, login, logout, isAdmin: admin?.role === 'admin' }),
    [admin, status, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
