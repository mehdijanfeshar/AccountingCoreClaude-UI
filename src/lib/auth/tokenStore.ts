/**
 * Minimal token storage for the JWT Bearer token issued by the
 * organization's IDP. This backend has NO login endpoint of its own — the
 * token always comes from outside (a real IDP flow later). For now this is
 * intentionally just a skeleton: persist whatever token the developer/host
 * app provides, attach it to every request, and surface 401s.
 *
 * Do NOT build a full login UI against this store — that is explicitly out
 * of scope for this scaffold.
 *
 * ⚠️ Known security trade-off (flag for security-reviewer): the token is
 * persisted in `localStorage`, which is readable by any script running on
 * the page (XSS exposure) and is NOT cleared on tab close. This is
 * acceptable for a dev-only manual-token skeleton but should be revisited
 * before production (e.g. httpOnly cookie set by a real IDP/BFF flow,
 * or at minimum in-memory-only storage with a silent-refresh flow).
 */

const STORAGE_KEY = 'accounting.auth.token';

type Listener = (token: string | null) => void;

const listeners = new Set<Listener>();

function readInitialToken(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage can throw in restrictive/private-browsing contexts.
    return null;
  }
}

let currentToken: string | null = readInitialToken();

export function getToken(): string | null {
  return currentToken;
}

export function setToken(token: string | null): void {
  currentToken = token;
  try {
    if (token) {
      window.localStorage.setItem(STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore storage failures; in-memory value is still updated
  }
  for (const listener of listeners) listener(currentToken);
}

export function clearToken(): void {
  setToken(null);
}

export function subscribeToken(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

/** Called by the api client whenever a request comes back 401. */
export function notifyUnauthorized(): void {
  for (const listener of unauthorizedListeners) listener();
}

export function subscribeUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}
