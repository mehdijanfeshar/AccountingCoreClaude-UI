/**
 * Runs once, before the app renders (see `src/main.tsx`), to handle the
 * IDP redirecting back into the app.
 *
 * There is intentionally NO dedicated "/auth/callback" route: the IDP
 * validates `redirect_uri` against an exact pre-registered value with no
 * path (`http://localhost:4200` — see authConfig.ts), so the callback
 * always lands on the app's root URL with the result appended as a hash
 * (dev, implicit flow: `#access_token=...&expires_in=...`) or a query
 * string (prod, PKCE: `?code=...&expires_in=...`) — ported from the
 * reference `TaminSecurityService.callbackCheck()`.
 *
 * Doing this synchronously-as-possible at module load (before
 * `createRoot(...).render(...)`) means the token is already in storage by
 * the time `AuthProvider`/`RequireAuth` render for the first time, so the
 * user is never bounced to /login on top of a URL that actually already
 * contains their fresh token.
 */

import { authConfig } from './authConfig';
import { applyToken, consumeCodeVerifier, consumeRedirectPath, exchangeCodeForToken } from './oauth';

function stripAuthParamsFromUrl(): void {
  // Remove both hash and query string, but keep the current pathname —
  // callers that need to land somewhere else do so afterwards via
  // history.replaceState with the stored redirect path.
  window.history.replaceState(null, '', window.location.pathname);
}

function applyStoredRedirect(): void {
  const redirectPath = consumeRedirectPath();
  if (redirectPath && redirectPath !== window.location.pathname) {
    window.history.replaceState(null, '', redirectPath);
  }
}

export async function bootstrapAuth(): Promise<void> {
  const isCodeFlow = authConfig.responseType === 'code';
  const paramsString = isCodeFlow ? window.location.search : window.location.hash;

  if (!paramsString || paramsString.length <= 1) {
    return;
  }

  const params = new URLSearchParams(paramsString.replace(/^[?#]/, ''));
  const accessToken = params.get('access_token');
  const code = params.get('code');
  const expiresIn = params.get('expires_in');

  if (!accessToken && !code) {
    // Hash/search present but not ours (e.g. a client-side router fragment
    // from before this change, or an unrelated query string) — leave as is.
    return;
  }

  try {
    if (accessToken && expiresIn) {
      applyToken(accessToken, expiresIn);
    } else if (code && expiresIn) {
      // ⚠️ UNVERIFIED — see oauth.ts / final report.
      const codeVerifier = consumeCodeVerifier();
      if (codeVerifier) {
        const response = await exchangeCodeForToken(code, codeVerifier);
        applyToken(response.access_token, response.expires_in);
      }
    }
  } finally {
    stripAuthParamsFromUrl();
    applyStoredRedirect();
  }
}
