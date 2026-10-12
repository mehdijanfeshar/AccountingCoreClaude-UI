/** کلیدهای localStorage تب‌های باز — یک‌جا، تا ورود/خروج بتواند همه را پاک کند. */
export const TABS_STORAGE_KEY = 'accounting.workspaceTabs';
export const SPLIT_STORAGE_KEY = 'accounting.workspaceTabs.split';
export const SPLIT_WIDTHS_STORAGE_KEY = 'accounting.workspaceTabs.splitWidths';

/**
 * بستن همهٔ تب‌های ذخیره‌شده. با هر ورود تازه و هر خروج صدا زده می‌شود (`startLogin` / `startLogout`) تا کاربر
 * بعد از ورود مجدد با تب‌های بسته شروع کند. رفرش صفحه از این مسیر نمی‌گذرد، پس تب‌ها با رفرش می‌مانند.
 */
export function clearWorkspaceTabs() {
  for (const key of [TABS_STORAGE_KEY, SPLIT_STORAGE_KEY, SPLIT_WIDTHS_STORAGE_KEY]) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore storage failures
    }
  }
}
