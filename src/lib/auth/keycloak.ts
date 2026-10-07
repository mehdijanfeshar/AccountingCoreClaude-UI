import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';
import { clearToken, setToken } from './tokenStore';

/**
 * ورود با Keycloak (برنچ keycloak) — `VITE_AUTH_PROVIDER=keycloak`. استاندارد OIDC با Authorization Code + PKCE
 * از کتابخانهٔ `oidc-client-ts` (به Keycloak وابسته نیست). بقیهٔ برنامه همان `tokenStore` را می‌خواند: هر بار که
 * کاربر وارد می‌شود یا توکن تمدید می‌شود، access token در `tokenStore` گذاشته می‌شود.
 *
 * Redirect به ریشهٔ برنامه برمی‌گردد (`?code=…&state=…`)، مثل سامانهٔ ورود قبلی — مسیر callback جدا لازم نیست.
 * مسیری که کاربر می‌خواست برود در `state` درخواست ورود نگه داشته می‌شود.
 */

export const isKeycloak = (import.meta.env.VITE_AUTH_PROVIDER ?? '').trim().toLowerCase() === 'keycloak';

let manager: UserManager | null = null;

function userManager(): UserManager {
  if (manager) return manager;
  const authority = import.meta.env.VITE_KEYCLOAK_AUTHORITY;
  if (!authority) throw new Error('VITE_AUTH_PROVIDER=keycloak ولی VITE_KEYCLOAK_AUTHORITY تنظیم نشده است.');
  manager = new UserManager({
    authority,
    client_id: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'accounting-ui',
    redirect_uri: window.location.origin + '/',
    post_logout_redirect_uri: window.location.origin + '/',
    response_type: 'code',
    // PKCE به crypto.subtle نیاز دارد که مرورگر فقط روی HTTPS یا localhost می‌دهد. برای آزمون توسعه از آدرس شبکه
    // (http://172.16.15.65:4200) بدون PKCE وارد می‌شود؛ Client در Keycloak توسعه PKCE را اجباری نکرده است.
    // ⚠️ محیط واقعی باید HTTPS باشد (و PKCE در Keycloak اجباری شود).
    disablePKCE: !window.crypto?.subtle,
    scope: 'openid profile',
    // تمدید خودکار پیش از انقضا با refresh token (Keycloak برای Client عمومی می‌دهد).
    automaticSilentRenew: true,
    // نشست OIDC در sessionStorage (با بستن تب پاک می‌شود)؛ access token همچنان در tokenStore.
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
    loadUserInfo: false,
  });
  manager.events.addUserLoaded(applyUser);
  manager.events.addUserUnloaded(clearToken);
  manager.events.addSilentRenewError(() => clearToken());
  manager.events.addAccessTokenExpired(() => clearToken());
  return manager;
}

function applyUser(user: User): void {
  if (user.access_token && user.expires_at) {
    setToken(user.access_token, user.expires_at * 1000);
  }
}

/** پیش از رندر برنامه: پاسخ ورود (`?code&state`) را پردازش می‌کند یا نشست ذخیره‌شده را برمی‌گرداند. */
export async function keycloakBootstrap(): Promise<void> {
  const um = userManager();
  const params = new URLSearchParams(window.location.search);
  if (params.has('code') && params.has('state')) {
    try {
      const user = await um.signinRedirectCallback();
      applyUser(user);
      const returnTo = typeof user.state === 'string' && user.state.startsWith('/') ? user.state : '/';
      window.history.replaceState(null, '', returnTo);
    } catch {
      // state کهنه یا تکراری (مثلاً بازگشت با دکمهٔ Back) — URL پاک و کاربر دوباره به ورود هدایت می‌شود.
      window.history.replaceState(null, '', '/');
      clearToken();
    }
    return;
  }
  if (params.has('error') && params.has('state')) {
    window.history.replaceState(null, '', '/');
    return;
  }
  const user = await um.getUser();
  if (user && !user.expired) applyUser(user);
}

export async function keycloakLogin(returnTo?: string): Promise<void> {
  clearToken();
  await userManager().signinRedirect({ state: returnTo && returnTo.startsWith('/') ? returnTo : undefined });
}

export async function keycloakLogout(): Promise<void> {
  clearToken();
  const um = userManager();
  const user = await um.getUser();
  await um.signoutRedirect({ id_token_hint: user?.id_token });
}
