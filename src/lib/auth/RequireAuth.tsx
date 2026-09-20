import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { isTokenValid, setRedirectPath } from './tokenStore';

/**
 * Route guard, ported from the reference `TaminAuthGuard.canActivate()`:
 * if there is no valid token, remember where the user was trying to go and
 * send them to our own /login page (which has the "ورود با حساب سازمانی"
 * button that actually starts the IDP redirect — unlike the reference,
 * we don't auto-redirect to the IDP on every guarded route hit).
 *
 * Deliberately re-checks `isTokenValid()` (not just `AuthContext`'s
 * `isAuthenticated`) on every navigation: `AuthContext` only re-evaluates
 * expiry once, when `AuthProvider` mounts. Without this, a token that
 * expires while the tab stays open on a single page would leave
 * `isAuthenticated` stuck at `true` until the next full page reload — the
 * reference guard avoids this because Angular's `canActivate` calls
 * `checkToken()` fresh on every route change, so we do the same here.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [valid, setValid] = useState(isAuthenticated);

  useEffect(() => {
    setValid(isTokenValid());
    // Re-run on every navigation (to catch expiry that happened while the
    // app was open) and whenever AuthContext's own state changes (e.g.
    // right after login/logout).
  }, [isAuthenticated, location.pathname, location.search]);

  useEffect(() => {
    if (!valid) {
      setRedirectPath(`${location.pathname}${location.search}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid, location.pathname, location.search]);

  if (!valid) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
