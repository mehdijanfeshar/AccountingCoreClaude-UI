/**
 * OAuth2 redirect flow against the organization's IDP (account-pilot).
 *
 * Ported directly from `TaminSecurityService` in
 * `D:\WorkSpace\node_modules\@tamin\angular\fesm2020\tamin-angular.mjs`
 * (`redirectToAccountWithBrowser`, `redirectToLogout`, `parseJwt`,
 * `generateCodeVerifier`, `sha256`, `base64UrlEncode`, `accessToToken`) —
 * not guessed. Line numbers as of the version installed under
 * `D:\WorkSpace\node_modules`: ~1761, ~1787, ~1857, ~1839, ~1844, ~1849,
 * ~1819 respectively.
 */

import { authConfig } from './authConfig';
import {
  clearCodeVerifier,
  clearRedirectPath,
  clearToken,
  getCodeVerifier,
  getRedirectPath,
  setCodeVerifier,
  setRedirectPath,
  setToken,
} from './tokenStore';

/** Starts the login redirect. `returnTo` is where the user should land back
 * in *this* app after a successful login (a same-app path, e.g. the page
 * they were trying to reach) — not to be confused with `redirect_uri`,
 * which is the fixed IDP-registered app origin. */
export async function startLogin(returnTo?: string): Promise<void> {
  clearToken();
  if (returnTo) {
    setRedirectPath(returnTo);
  }

  const params = new URLSearchParams({
    redirect_uri: authConfig.redirectUri,
    response_type: authConfig.responseType,
    client_id: authConfig.clientId,
  });

  if (authConfig.responseType === 'code') {
    // PKCE branch — ported for parity with the reference's production path.
    // ⚠️ UNVERIFIED against the real IDP (see final report).
    const codeVerifier = generateCodeVerifier(64);
    setCodeVerifier(codeVerifier);
    const codeChallenge = await sha256Base64Url(codeVerifier);
    params.set('code_challenge', codeChallenge);
    params.set('code_challenge_method', 'S256');
  }

  window.location.href = `${authConfig.authorizationServer}${authConfig.authorizePath}?${params.toString()}`;
}

/** Signs the user out both locally and at the IDP. */
export function startLogout(): void {
  clearToken();
  const params = new URLSearchParams({ redirect_uri: authConfig.redirectUri });
  window.location.href = `${authConfig.authorizationServer}${authConfig.signoutPath}?${params.toString()}`;
}

/** Exchanges an authorization `code` for an access token (PKCE flow).
 * ⚠️ UNVERIFIED — never exercised against the real IDP; ported from the
 * reference's `accessToToken()` best-effort, ready for `startLogin`'s
 * 'code' branch once someone can test it against production. */
export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
): Promise<{ access_token: string; expires_in: number | string }> {
  const body = new URLSearchParams({
    redirect_uri: authConfig.redirectUri,
    client_id: authConfig.clientId,
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
  });

  const response = await fetch(`${authConfig.authorizationServer}${authConfig.tokenPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed (${response.status})`);
  }

  return (await response.json()) as { access_token: string; expires_in: number | string };
}

/** Applies a freshly-obtained token: stores it with an absolute expiry
 * computed from the relative `expiresInSeconds` the IDP returns. */
export function applyToken(accessToken: string, expiresInSeconds: number | string): void {
  const seconds = Number(expiresInSeconds);
  const expiresAtMs = Date.now() + (Number.isFinite(seconds) ? seconds : 0) * 1000;
  setToken(accessToken, expiresAtMs);
}

export function consumeCodeVerifier(): string | null {
  const verifier = getCodeVerifier();
  clearCodeVerifier();
  return verifier;
}

export function consumeRedirectPath(): string | null {
  const path = getRedirectPath();
  clearRedirectPath();
  return path;
}

function generateCodeVerifier(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const randomChar = () =>
    characters.charAt(
      Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / (0xffffffff + 1)) * characters.length),
    );
  return Array.from({ length }, randomChar).join('');
}

async function sha256Base64Url(plain: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  let str = '';
  bytes.forEach((byte) => {
    str += String.fromCharCode(byte);
  });
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decodes a JWT payload for DISPLAY PURPOSES ONLY (e.g. showing the signed-in
 * user's name in the header). This does NOT verify the signature — it must
 * never be used for any authorization decision; the backend is the only
 * source of truth for that (every request still carries the raw token and
 * the API validates it server-side).
 */
export function decodeJwtPayloadForDisplay(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(jsonPayload) as Record<string, unknown>;
  } catch {
    return null;
  }
}
