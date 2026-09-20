import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getToken, isTokenValid, subscribeToken, subscribeUnauthorized } from './tokenStore';
import { startLogin, startLogout, decodeJwtPayloadForDisplay } from './oauth';

/**
 * Real SSO auth layer. This backend has no login endpoint of its own — the
 * JWT Bearer token is always issued by the organization's IDP
 * (account-pilot.tamin.ir). The actual redirect flow lives in
 * `./oauth.ts` + `./authBootstrap.ts`; this context just exposes the
 * resulting state to the component tree:
 *   - `isAuthenticated` (token present AND not expired — see tokenStore)
 *   - `login()` — starts the redirect to the IDP (called from LoginPage)
 *   - `signOut()` — clears local state and redirects to the IDP's signout
 *   - `user` — display-only info decoded from the token (NOT verified;
 *     never use this for authorization decisions, only for showing e.g. a
 *     name in the header)
 *   - `hasUnauthorizedError` flipped on any 401 from the API, so the UI can
 *     show a "session expired" banner instead of silently failing.
 */

interface DisplayUser {
  name: string;
}

interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  hasUnauthorizedError: boolean;
  user: DisplayUser | null;
  login: (returnTo?: string) => void;
  signOut: () => void;
  dismissUnauthorizedError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readDisplayUser(token: string | null): DisplayUser | null {
  if (!token) return null;
  const payload = decodeJwtPayloadForDisplay(token);
  if (!payload) return null;
  // Claim name is unconfirmed against a real IDP token (see final report) —
  // try the common OIDC/legacy claims and fall back to a generic label
  // rather than guessing wrong and showing garbage.
  const candidate =
    (payload['name'] as string | undefined) ??
    (payload['unique_name'] as string | undefined) ??
    (payload['given_name'] as string | undefined) ??
    (payload['sub'] as string | undefined);
  return { name: candidate && candidate.trim().length > 0 ? candidate : 'کاربر سازمانی' };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => (isTokenValid() ? getToken() : null));
  const [hasUnauthorizedError, setHasUnauthorizedError] = useState(false);

  useEffect(() => subscribeToken(setTokenState), []);
  useEffect(() => subscribeUnauthorized(() => setHasUnauthorizedError(true)), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      isAuthenticated: token !== null,
      hasUnauthorizedError,
      user: readDisplayUser(token),
      login: (returnTo?: string) => {
        void startLogin(returnTo);
      },
      signOut: () => startLogout(),
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
