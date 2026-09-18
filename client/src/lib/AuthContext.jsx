import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

//Knows who is signed in. The tokens live in httpOnly cookies the client can't read,
//so on load we ask the server with GET /api/auth/me.

//One status value instead of separate isLoading / isSignedIn booleans (Workshop 6 state machine).
export const AUTH_STATUS = { LOADING: 'loading', SIGNED_IN: 'signedIn', SIGNED_OUT: 'signedOut' };

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState(AUTH_STATUS.LOADING);
  const [user, setUser] = useState(null);

  const signIn = useCallback((nextUser) => {
    setUser(nextUser);
    setStatus(AUTH_STATUS.SIGNED_IN);
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    setStatus(AUTH_STATUS.SIGNED_OUT);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then(({ user: me }) => !cancelled && signIn(me))
      .catch(() => !cancelled && signOut());
    return () => {
      cancelled = true;
    };
  }, [signIn, signOut]);

  const value = useMemo(
    () => ({
      status,
      user,
      async login(credentials) {
        const { user: me } = await api.login(credentials);
        signIn(me);
        return me;
      },
      async register(details) {
        const { user: me } = await api.register(details);
        signIn(me);
        return me;
      },
      async logout() {
        //Clear local state even if the request fails; the cookies expire on their own.
        await api.logout().catch(() => {});
        signOut();
      },
    }),
    [status, user, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return context;
}
