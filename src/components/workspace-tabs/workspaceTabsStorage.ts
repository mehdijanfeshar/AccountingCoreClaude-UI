import { getToken } from '../../lib/auth/tokenStore';

/** کلیدهای localStorage تب‌های باز — یک‌جا، تا ورود/خروج بتواند همه را پاک کند. */
export const TABS_STORAGE_KEY = 'accounting.workspaceTabs';
export const SPLIT_STORAGE_KEY = 'accounting.workspaceTabs.split';
export const SPLIT_WIDTHS_STORAGE_KEY = 'accounting.workspaceTabs.splitWidths';
/** نشست ورودی که تب‌های ذخیره‌شده مال آن‌اند. */
const TABS_SESSION_KEY = 'accounting.workspaceTabs.session';

/**
 * بستن همهٔ تب‌های ذخیره‌شده. با هر ورود تازه و هر خروج صدا زده می‌شود (`startLogin` / `startLogout`) تا کاربر
 * بعد از ورود مجدد با تب‌های بسته شروع کند. رفرش صفحه از این مسیر نمی‌گذرد، پس تب‌ها با رفرش می‌مانند.
 */
export function clearWorkspaceTabs() {
  for (const key of [TABS_STORAGE_KEY, SPLIT_STORAGE_KEY, SPLIT_WIDTHS_STORAGE_KEY, TABS_SESSION_KEY]) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore storage failures
    }
  }
}

/**
 * نشانهٔ ورود از توکن: `auth_time` = زمان آخرین ورود نام کاربری/رمز (با هر ورود رمز عوض می‌شود، با رفرش و تمدید
 * خودکار نه)؛ اگر نبود `sid`/`session_state` (نشست Keycloak) یا `iat`.
 */
function sessionMarker(): string | null {
  const token = getToken();
  const part = token?.split('.')[1];
  if (!part) return null;
  try {
    const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
    const marker = payload['auth_time'] ?? payload['sid'] ?? payload['session_state'] ?? payload['iat'];
    return marker == null ? null : String(marker);
  } catch {
    return null;
  }
}

/** ورودی که این تب مرورگر تب‌هایش را با آن خوانده است. */
let claimed: string | null = null;

/**
 * آیا این تب مرورگر هنوز صاحب تب‌های ذخیره‌شده است؟ اگر در تب دیگری از مرورگر دوباره وارد شده باشند، تب قدیمی
 * نباید تب‌های ورود قبلی را دوباره در حافظه بنویسد.
 */
export function ownsWorkspaceTabs(): boolean {
  return claimed == null || sessionMarker() === claimed;
}

/**
 * پیش از خواندن تب‌های ذخیره‌شده: اگر مال ورود دیگری‌اند پاک می‌شوند — هر بار که نام کاربری و رمز وارد شود، از هر
 * مسیری (دکمهٔ «ورود»، تب دیگر مرورگر، صفحهٔ Keycloak)، کاربر با تب‌های بسته شروع می‌کند. رفرش تب‌ها را نگه می‌دارد.
 */
export function claimWorkspaceTabs() {
  const marker = sessionMarker();
  claimed = marker;
  if (marker == null) return;
  try {
    if (window.localStorage.getItem(TABS_SESSION_KEY) === marker) return;
    clearWorkspaceTabs();
    window.localStorage.setItem(TABS_SESSION_KEY, marker);
  } catch {
    // ignore storage failures
  }
}
