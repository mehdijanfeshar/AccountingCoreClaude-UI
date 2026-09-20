/**
 * Token storage for the JWT Bearer token issued by the organization's IDP
 * (account-pilot.tamin.ir). The real SSO redirect flow lives in
 * `./oauth.ts` and `./authBootstrap.ts`; this module only persists the
 * result: the token, its absolute expiry, and the small bits of state the
 * redirect round-trip needs (where to send the user back to, the PKCE code
 * verifier).
 *
 * ⚠️ Known security trade-off (flag for security-reviewer): the token is
 * persisted in `localStorage`, which is readable by any script running on
 * the page (XSS exposure) and is NOT cleared on tab close. This mirrors the
 * reference Angular app's own `TaminStorageService` (also localStorage), so
 * it is not a regression — but it should be revisited before production
 * (e.g. httpOnly cookie set by a BFF, or in-memory-only storage with silent
 * refresh).
 */

const STORAGE_KEY_TOKEN = 'accounting.auth.token';
const STORAGE_KEY_EXPIRES_AT = 'accounting.auth.tokenExpiresAt';
const STORAGE_KEY_REDIRECT_PATH = 'accounting.auth.redirectPath';
const STORAGE_KEY_CODE_VERIFIER = 'accounting.auth.codeVerifier';

type Listener = (token: string | null) => void;

const listeners = new Set<Listener>();

function readLocalStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // localStorage can throw in restrictive/private-browsing contexts.
    return null;
  }
}

function writeLocalStorage(key: string, value: string | null): void {
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // ignore storage failures; in-memory value (if any) is still updated
  }
}

let currentToken: string | null = readLocalStorage(STORAGE_KEY_TOKEN);

export function getToken(): string | null {
  return currentToken;
}

/** Absolute expiry, in epoch milliseconds (Date.now() scale), or null. */
export function getExpiresAt(): number | null {
  const raw = readLocalStorage(STORAGE_KEY_EXPIRES_AT);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Stores the token together with its absolute expiry timestamp (epoch ms).
 * Callers computing this from an `expires_in` (seconds, relative) value
 * should pass `Date.now() + expiresInSeconds * 1000` — see `./oauth.ts`.
 */
export function setToken(token: string, expiresAtMs: number): void {
  currentToken = token;
  writeLocalStorage(STORAGE_KEY_TOKEN, token);
  writeLocalStorage(STORAGE_KEY_EXPIRES_AT, String(expiresAtMs));
  for (const listener of listeners) listener(currentToken);
}

export function clearToken(): void {
  currentToken = null;
  writeLocalStorage(STORAGE_KEY_TOKEN, null);
  writeLocalStorage(STORAGE_KEY_EXPIRES_AT, null);
  for (const listener of listeners) listener(currentToken);
}

/**
 * True if a token exists AND has not passed its expiry. As a side effect,
 * clears the token once it is found to be expired — ported from the
 * reference `TaminSecurityService.checkToken()`.
 */
export function isTokenValid(): boolean {
  if (!currentToken) return false;
  const expiresAt = getExpiresAt();
  if (expiresAt === null) return false;
  if (Date.now() >= expiresAt) {
    clearToken();
    return false;
  }
  return true;
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

// --- Redirect-back path (where to send the user after a successful login) ---
// Survives the full-page navigation to the IDP and back (React state does
// not), same purpose as the reference's `addRedirectUrl`/`getRedirectUrl`.

export function setRedirectPath(path: string): void {
  writeLocalStorage(STORAGE_KEY_REDIRECT_PATH, path);
}

export function getRedirectPath(): string | null {
  return readLocalStorage(STORAGE_KEY_REDIRECT_PATH);
}

export function clearRedirectPath(): void {
  writeLocalStorage(STORAGE_KEY_REDIRECT_PATH, null);
}

// --- PKCE code_verifier (production 'code' flow only — see authConfig.ts) ---

export function setCodeVerifier(verifier: string): void {
  writeLocalStorage(STORAGE_KEY_CODE_VERIFIER, verifier);
}

export function getCodeVerifier(): string | null {
  return readLocalStorage(STORAGE_KEY_CODE_VERIFIER);
}

export function clearCodeVerifier(): void {
  writeLocalStorage(STORAGE_KEY_CODE_VERIFIER, null);
}
