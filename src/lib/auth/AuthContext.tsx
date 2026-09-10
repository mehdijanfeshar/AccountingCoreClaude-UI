import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { clearToken, getToken, setToken, subscribeToken, subscribeUnauthorized } from './tokenStore';

/**
 * Skeleton auth layer only.
 *
 * This backend has no login endpoint of its own — the JWT Bearer token is
 * always issued by the organization's external IDP. A full login UI is
 * explicitly OUT of scope for this scaffold (see task spec). What this
 * provides:
 *   - in-memory + localStorage-persisted token (see ./tokenStore)
 *   - automatic `Authorization: Bearer <token>` header (see ../api/client)
 *   - a `hasUnauthorizedError` flag flipped on any 401, so the UI can show
 *     a "session expired / not signed in" banner instead of silently
 *     failing.
 *
 * How to get a real token in local development is an open question for the
 * project owner (see Follow-up items) — until then, `setToken()` can be
 * called manually (e.g. from the browser console) with a token obtained
 * out-of-band from the IDP.
 */

interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  hasUnauthorizedError: boolean;
  setToken: (token: string) => void;
  signOut: () => void;
  dismissUnauthorizedError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(getToken);
  const [hasUnauthorizedError, setHasUnauthorizedError] = useState(false);

  useEffect(() => subscribeToken(setTokenState), []);
  useEffect(() => subscribeUnauthorized(() => setHasUnauthorizedError(true)), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      isAuthenticated: token !== null,
      hasUnauthorizedError,
      setToken: (next: string) => {
        setToken(next);
        setHasUnauthorizedError(false);
      },
      signOut: () => clearToken(),
      dismissUnauthorizedError: () => setHasUnauthorizedError(false),
    }),
    [token, hasUnauthorizedError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
