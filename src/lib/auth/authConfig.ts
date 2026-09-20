/**
 * SSO configuration, ported from the reference Angular app's
 * `application-config.ts` + `TaminSecurityService` (package `@tamin/angular`,
 * read directly from `D:\WorkSpace\node_modules\@tamin\angular` — not
 * guessed). See `docs` link in the task/report for the exact source lines.
 *
 * All values come from `.env*` (see `.env.example`) — nothing here is
 * hard-coded, even though the client_id/authorizationServer are not secrets
 * (this is a public SPA client with no client_secret).
 */

function readEnv(name: keyof ImportMetaEnv, fallback: string): string {
  const value = import.meta.env[name];
  return value && value.trim().length > 0 ? value : fallback;
}

export const authConfig = {
  /** Trailing slash on purpose — the reference app always does
   *  `${authorizationServer}auth/server/authorize?...` etc. without adding one. */
  authorizationServer: readEnv('VITE_AUTH_SERVER', 'https://account-pilot.tamin.ir/'),
  clientId: readEnv('VITE_AUTH_CLIENT_ID', ''),
  /**
   * Empty env value => use window.location.origin. The IDP validates
   * redirect_uri against an exact pre-registered value with NO path
   * component (reference configs always use a bare origin, e.g.
   * "http://localhost:4200"), so the callback always lands back on "/"
   * with the token in the hash — there is no dedicated "/auth/callback"
   * route in this app (see src/lib/auth/authBootstrap.ts).
   */
  get redirectUri(): string {
    const configured = import.meta.env.VITE_AUTH_REDIRECT_URI;
    return configured && configured.trim().length > 0 ? configured : window.location.origin;
  },
  /**
   * Reference app: `applicationConfig.production ? 'code' : 'token'`.
   * We only run as a real SPA in dev today (port fixed at 4200, see
   * vite.config.ts) — the 'code'+PKCE branch below is ported for parity
   * with the reference but has NEVER been exercised against the real IDP.
   * See final report: flagged as UNVERIFIED.
   */
  get responseType(): 'token' | 'code' {
    return import.meta.env.PROD ? 'code' : 'token';
  },
  /** Reference: `auth/server/authorize`, `auth/server/token`, `auth/signout`. */
  authorizePath: 'auth/server/authorize',
  tokenPath: 'auth/server/token',
  signoutPath: 'auth/signout',
} as const;
