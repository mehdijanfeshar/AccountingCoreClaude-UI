/**
 * The organizational unit the user has chosen to act as, held outside React so the axios request
 * interceptor can read it. Same shape and reasoning as `lib/auth/tokenStore` — an interceptor
 * runs outside the component tree and cannot use a hook.
 *
 * ⚠️ This value is a *request*, not a permission. It is sent as the `X-Vahed-Code` header and the
 * backend validates it against the caller's own subtree on every request
 * (`IUnitScopeResolver`); a unit the user may not act as comes back 403, it does not silently
 * work. Nothing here grants anything — do not treat a value in this store as proof of access.
 */

const STORAGE_KEY = 'accounting.session.unitCode';

let current: string | null = readInitial();

function readInitial(): string | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw && raw.trim().length > 0 ? raw : null;
  } catch {
    // localStorage can throw in restrictive/private-browsing contexts.
    return null;
  }
}

export function getRequestedUnitCode(): string | null {
  return current;
}

export function setRequestedUnitCode(vahedCode: string | null): void {
  current = vahedCode && vahedCode.trim().length > 0 ? vahedCode.trim() : null;

  try {
    if (current === null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, current);
    }
  } catch {
    // Non-fatal: the in-memory value still drives this session's requests.
  }
}
