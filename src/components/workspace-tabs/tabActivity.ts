import { createContext, useContext } from 'react';

/**
 * آیا تبی که این صفحه داخلش است همین الان تب فعال است؟ تب‌های پشتی mount می‌مانند، پس هر listener سراسری
 * (مثلاً `keydown` روی window) باید با این خاموش شود، وگرنه کلید زده‌شده در تب فعال به صفحهٔ پشتی هم می‌رسد.
 * بیرون از تب‌ها (پیش‌فرض) همیشه true.
 */
export const TabActivityContext = createContext(true);

export function useIsActiveTab(): boolean {
  return useContext(TabActivityContext);
}

/**
 * شناسهٔ تبی که این صفحه داخلش است. هر وضعیتی که بیرون از کامپوننت نگه داشته می‌شود (انبار ماژولی) باید با این
 * کلید بخورد، وگرنه چند نسخه از یک صفحه (مثلاً سه دفتر کل) فیلترشان را با هم شریک می‌شوند.
 * بیرون از تب‌ها: `'global'`.
 */
export const TabIdContext = createContext('global');

export function useTabId(): string {
  return useContext(TabIdContext);
}

/** رویدادهای عمر تب برای انبارهای کلیدخورده با شناسهٔ تب: پاک کردن با بستن تب، کپی با «نسخهٔ دیگر». */
type TabLifecycleListener = {
  closed?: (ids: string[]) => void;
  duplicated?: (fromId: string, toId: string) => void;
};

const lifecycleListeners = new Set<TabLifecycleListener>();

export function onTabLifecycle(listener: TabLifecycleListener): () => void {
  lifecycleListeners.add(listener);
  return () => lifecycleListeners.delete(listener);
}

export function notifyTabsClosed(ids: string[]) {
  lifecycleListeners.forEach((l) => l.closed?.(ids));
}

export function notifyTabDuplicated(fromId: string, toId: string) {
  lifecycleListeners.forEach((l) => l.duplicated?.(fromId, toId));
}

/**
 * `document.getElementById` که عنصر داخل تب فعال را ترجیح می‌دهد. یک صفحه ممکن است در چند تب باز باشد (همان
 * سند یا همان صورت مالی) و شناسهٔ عنصرها تکراری شود؛ بدون این، اسکرول/فوکوس به نسخهٔ تب پشتی می‌رود.
 */
export function getElementByIdInActiveTab(id: string): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(`[data-tab-active="true"] [id="${CSS.escape(id)}"]`) ??
    document.getElementById(id)
  );
}
