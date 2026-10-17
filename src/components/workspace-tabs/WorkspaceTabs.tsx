import { memo, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  UNSAFE_NavigationContext,
  parsePath,
  useLocation,
  useNavigate,
  useRoutes,
  type Location,
  type To,
} from 'react-router-dom';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Button from '@mui/material/Button';
import useMediaQuery from '@mui/material/useMediaQuery';
import Divider from '@mui/material/Divider';
import CloseIcon from '@mui/icons-material/Close';
import LibraryAddOutlinedIcon from '@mui/icons-material/LibraryAddOutlined';
import VerticalSplitOutlinedIcon from '@mui/icons-material/VerticalSplitOutlined';
import CloseFullscreenOutlinedIcon from '@mui/icons-material/CloseFullscreenOutlined';
import { alpha, useTheme } from '@mui/material/styles';
import { routes } from '../../app/routes';
import { NAV_GROUPS } from '../../lib/navConfig';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { useSession } from '../../lib/session/SessionContext';
import { ConfirmDialog } from '../ConfirmDialog';
import { toPersianDigits } from '../../lib/format/numbers';
import { TabActivityContext, TabIdContext, notifyTabDuplicated, notifyTabsClosed } from './tabActivity';
import { useResizableColumns } from './useResizableColumns';
import { SPLIT_STORAGE_KEY, SPLIT_WIDTHS_STORAGE_KEY, TABS_STORAGE_KEY as STORAGE_KEY, claimWorkspaceTabs, ownsWorkspaceTabs } from './workspaceTabsStorage';

/**
 * تب‌های داخل برنامه — برای همهٔ صفحه‌های منو (جز صفحهٔ اصلی).
 *
 * هر گزینهٔ منو یک تب است (کلید = آدرس همان گزینه؛ زیرمسیرهایش مثل new/edit داخل همان تب). صفحه‌هایی که
 * گزینهٔ منو ندارند (مثل ویرایش/مشاهدهٔ سند) در تبی باز می‌شوند که از آن آمده‌اند — `resolveTab`. از هر صفحه می‌شود چند نسخه باز کرد (کلیک راست روی تب ← «نسخهٔ دیگر»).
 * تب‌های پشتی mount می‌مانند (فقط مخفی‌اند) تا فرم نیمه‌پر، فیلتر و صفحهٔ
 * گرید از دست نرود. هر تب با `useRoutes(routes, location)` آدرس خودش را دارد، پس `useLocation`/`useParams`/
 * `useSearchParams` داخل تب پشتی با عوض شدن آدرس مرورگر تغییر نمی‌کند.
 *
 * فهرست تب‌ها در localStorage می‌ماند؛ بعد از رفرش تب‌ها برمی‌گردند ولی فقط وقتی کاربر رویشان کلیک کند mount
 * می‌شوند (محتوای فرم‌های نیمه‌پر بعد از رفرش برنمی‌گردد).
 *
 * نمای کنار هم (کلیک راست روی تب ← «نمایش کنار تب فعال»): دو تب هم‌زمان با خط وسط قابل جابه‌جایی؛ در صفحهٔ
 * کوچک غیرفعال است. جزئیات در `SplitState`.
 */

const MAX_TABS = 10;
/**
 * عنوان هر تب از همان منو — یک منبع، تا عنوان تب و منو هیچ‌وقت از هم جدا نشوند. «دریافت و پرداخت» گزینهٔ منو
 * ندارد ولی صفحهٔ فهرست مستقل است.
 */
const TAB_TITLES: Record<string, string> = {
  ...Object.fromEntries(
    NAV_GROUPS.flatMap((g) => g.items)
      .filter((item) => item.to && item.to !== '/')
      .map((item) => [item.to as string, item.label]),
  ),
  '/operation/pay-recive-heads': 'دریافت و پرداخت',
};

/**
 * صفحه‌های بدون گزینهٔ منو، وقتی مستقیم (رفرش/آدرس) باز شوند و تبی برایشان نباشد — تب صاحبشان.
 * در حالت عادی (ناوبری داخل برنامه) همان تبی که از آن آمده‌اند را می‌گیرند.
 */
const ORPHAN_OWNERS: [prefix: string, key: string][] = [
  ['/operation/vouchers', '/operation/voucher-heads'],
  ['/treasury/petty-cash/expense-docs', '/treasury/petty-cash/cartable'],
  ['/treasury/khazaneh/receipts', '/treasury/khazaneh/receipts-transfers'],
  ['/treasury/khazaneh/transfers', '/treasury/khazaneh/receipts-transfers'],
  ['/fs/template-versions', '/fs/templates'],
];

const TAB_KEYS_BY_LENGTH = Object.keys(TAB_TITLES).sort((a, b) => b.length - a.length);

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/');
}

/** تب گزینهٔ منویی که این آدرس زیرمسیر آن است (بلندترین تطابق، مثلاً `month-reopen/issue` پیش از `month-reopen`). */
function navTabKeyOf(pathname: string): string | null {
  return TAB_KEYS_BY_LENGTH.find((key) => isUnder(pathname, key)) ?? null;
}

function orphanOwnerOf(pathname: string): string | null {
  return ORPHAN_OWNERS.find(([prefix]) => isUnder(pathname, prefix))?.[1] ?? null;
}

function isTabbable(pathname: string): boolean {
  return pathname !== '/' && pathname !== '/login';
}

interface ResolvedTab {
  id: string;
  key: string;
}

/** شناسهٔ تب تازه: نسخهٔ اول همان کلید منو، نسخه‌های بعدی `کلید#n`. */
function newTabId(key: string, tabs: WorkspaceTab[]): string {
  if (!tabs.some((t) => t.id === key)) return key;
  let n = 2;
  while (tabs.some((t) => t.id === `${key}#${n}`)) n++;
  return `${key}#${n}`;
}

function mostRecentOf(tabs: WorkspaceTab[], key: string): WorkspaceTab | undefined {
  return tabs.filter((t) => t.key === key).sort((a, b) => b.lastActive - a.lastActive)[0];
}

/**
 * تب آدرس فعلی. از یک گزینهٔ منو ممکن است چند نسخه باز باشد (مثلاً دو تراز آزمایشی برای مقایسه)، پس آدرس به‌تنهایی
 * تب را مشخص نمی‌کند. ترتیب: تبی که خود برنامه به آن می‌رود (`hintId`) ← اگر آدرس مال همان گزینهٔ منوی تب فعلی
 * است، همان تب ← آخرین نسخهٔ فعال آن گزینه (یا تب تازه) ← برای صفحهٔ بی‌منو: تبی که همین آدرس را باز دارد ← تب
 * فعلی (از همان‌جا باز شده) ← صاحب پیش‌فرض صفحه.
 */
function resolveTab(
  pathname: string,
  search: string,
  hintId: string | null,
  tabs: WorkspaceTab[],
  previousId: string | null,
): ResolvedTab | null {
  if (!isTabbable(pathname)) return null;
  const byId = (id: string | null) => (id ? tabs.find((t) => t.id === id) : undefined);
  const hinted = byId(hintId);
  if (hinted) return { id: hinted.id, key: hinted.key };
  const previous = byId(previousId);
  const ofKey = (key: string): ResolvedTab => {
    if (previous?.key === key) return { id: previous.id, key };
    // پیوند با پارامتر از تب دیگر (مثلاً «به تفکیک» از تراز به مرور حساب‌ها) پارامترهای نسخهٔ باز را دست نمی‌زند —
    // نسخهٔ تازه باز می‌شود؛ کلیک ساده روی منو (بدون پارامتر) به آخرین نسخه می‌رود.
    const recent = mostRecentOf(tabs, key);
    const sameUrl = recent && recent.location.pathname + recent.location.search === pathname + search;
    if (recent && (!search || sameUrl)) return { id: recent.id, key };
    return { id: newTabId(key, tabs), key };
  };

  const navKey = navTabKeyOf(pathname);
  if (navKey) return ofKey(navKey);
  const holder =
    previous?.location.pathname === pathname ? previous : tabs.find((t) => t.location.pathname === pathname);
  if (holder) return { id: holder.id, key: holder.key };
  if (previous) return { id: previous.id, key: previous.key };
  const owner = orphanOwnerOf(pathname);
  return owner ? ofKey(owner) : null;
}

/** هر آدرسی جز ریشهٔ تب، یا هر فرم «جدید/ویرایش»، یعنی ممکن است تغییر ذخیره‌نشده داشته باشد. */
function isFormLocation(tab: WorkspaceTab): boolean {
  const pathname = tab.location.pathname.replace(/\/+$/, '');
  return pathname !== tab.key || /\/(new|edit)$/.test(pathname);
}

function tabSubtitle(tab: WorkspaceTab): string {
  const pathname = tab.location.pathname.replace(/\/+$/, '');
  if (pathname === tab.key) return '';
  if (pathname.endsWith('/new')) return ' (جدید)';
  if (pathname.endsWith('/edit')) return ' (ویرایش)';
  if (pathname.endsWith('/print')) return ' (چاپ)';
  return ' (جزئیات)';
}

interface WorkspaceTab {
  /** شناسهٔ یکتای تب — چند تب می‌توانند یک `key` (گزینهٔ منو) داشته باشند. */
  id: string;
  key: string;
  location: Location;
  lastActive: number;
}

interface StoredTab {
  id?: string;
  key: string;
  url: string;
  lastActive: number;
}

function toLocation(id: string, url: string): Location {
  const [pathname, search = ''] = url.split('?');
  return {
    pathname,
    search: search ? `?${search}` : '',
    hash: '',
    state: null,
    key: `restored-${id}`,
  };
}

/** عنوان تب؛ اگر از یک گزینهٔ منو چند نسخه باز است، شماره هم می‌گیرد («تراز آزمایشی ۲»). */
function tabTitle(tab: WorkspaceTab, tabs: WorkspaceTab[]): string {
  const base = TAB_TITLES[tab.key];
  const siblings = tabs.filter((t) => t.key === tab.key);
  if (siblings.length < 2) return base;
  return `${base} ${toPersianDigits(siblings.indexOf(tab) + 1)}`;
}

function readStoredTabs(): WorkspaceTab[] {
  // تب‌های نشست ورود دیگر (مثلاً دیروز) برنمی‌گردند — پیش از تقسیم صفحه و عرض‌ها هم اجرا می‌شود
  claimWorkspaceTabs();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as StoredTab[])
      .filter((t) => t && typeof t.url === 'string' && t.key in TAB_TITLES && isTabbable(t.url.split('?')[0]))
      .slice(0, MAX_TABS)
      .map((t) => ({
        id: t.id ?? t.key,
        key: t.key,
        location: toLocation(t.id ?? t.key, t.url),
        lastActive: t.lastActive ?? 0,
      }))
      .filter((t, i, all) => all.findIndex((x) => x.id === t.id) === i);
  } catch {
    return [];
  }
}

function writeStoredTabs(tabs: WorkspaceTab[]) {
  // پس از ورود تازه در تب دیگری از مرورگر، این تب قدیمی تب‌های ورود قبلی را برنمی‌گرداند
  if (!ownsWorkspaceTabs()) return;
  try {
    const stored: StoredTab[] = tabs.map((t) => ({
      id: t.id,
      key: t.key,
      url: t.location.pathname + t.location.search,
      lastActive: t.lastActive,
    }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // ignore storage failures
  }
}

/**
 * نمای کنار هم: ۲ تا ۳ تب هم‌زمان، به ترتیب از سمت شروع. آدرس مرورگر همیشه مال قسمت «فعال» است؛ منو و نوار تب
 * روی قسمت فعال اثر می‌گذارند، و کلیک داخل قسمت دیگر اول آن را فعال می‌کند.
 */
type SplitState = string[];

const MAX_SPLIT = 3;
/** کمترین سهم هر قسمت از عرض. */
const MIN_WIDTH = 0.15;

function equalWidths(count: number): number[] {
  return Array.from({ length: count }, () => 1 / count);
}

function readStoredSplit(tabs: WorkspaceTab[]): SplitState | null {
  try {
    const raw = window.localStorage.getItem(SPLIT_STORAGE_KEY);
    if (!raw) return null;
    const split = JSON.parse(raw) as SplitState;
    const keys = new Set(tabs.map((t) => t.id));
    return Array.isArray(split) &&
      split.length >= 2 &&
      split.length <= MAX_SPLIT &&
      new Set(split).size === split.length &&
      split.every((k) => keys.has(k))
      ? split
      : null;
  } catch {
    return null;
  }
}

function readStoredWidths(): number[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(SPLIT_WIDTHS_STORAGE_KEY) ?? 'null') as number[] | null;
    return Array.isArray(value) && value.every((w) => typeof w === 'number' && w >= MIN_WIDTH) ? value : [];
  } catch {
    return [];
  }
}

function writeStorage(key: string, value: unknown) {
  if (!ownsWorkspaceTabs()) return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage failures
  }
}

interface TabPaneProps {
  tabKey: string;
  location: Location;
  /** `-1` = مخفی، `0` = تک‌صفحه‌ای، `n > 0` = قسمت nام نمای کنار هم. */
  slot: number;
  width: number;
  height: number;
  focused: boolean;
  onFocusRequest: (key: string) => void;
  /** ناوبری از داخل تب؛ `true` = تب پشتی بود و فقط آدرس همان تب عوض شد (آدرس مرورگر دست نخورد). */
  onNavigate: (tabId: string, to: To, state: unknown) => boolean;
}

/** یک تب. `memo` تا تب‌های پشتی با هر تغییر آدرس دوباره render نشوند (location آن‌ها ثابت است). */
const TabPane = memo(function TabPane({
  tabKey,
  location,
  slot,
  width,
  height,
  focused,
  onFocusRequest,
  onNavigate,
}: TabPaneProps) {
  const element = useRoutes(routes, location);
  // ناوبری صفحه‌ای که در تب پشتی است (مثلاً `navigate` بعد از تمام شدن ذخیره‌ای که کاربر وسطش تب را عوض کرده)
  // نباید کاربر را به این تب برگرداند — فقط آدرس همین تب عوض می‌شود. `useNavigate` و `Link` هر دو از همین
  // navigator می‌روند.
  const navigation = useContext(UNSAFE_NavigationContext);
  const tabNavigation = useMemo(() => {
    const base = navigation.navigator;
    return {
      ...navigation,
      navigator: {
        createHref: (to: To) => base.createHref(to),
        encodeLocation: base.encodeLocation ? (to: To) => base.encodeLocation!(to) : undefined,
        go: (delta: number) => base.go(delta),
        push: (to: To, state?: unknown, opts?: Parameters<typeof base.push>[2]) => {
          if (!onNavigate(tabKey, to, state)) base.push(to, state, opts);
        },
        replace: (to: To, state?: unknown, opts?: Parameters<typeof base.replace>[2]) => {
          if (!onNavigate(tabKey, to, state)) base.replace(to, state, opts);
        },
      },
    };
  }, [navigation, tabKey, onNavigate]);
  const split = slot > 0;
  // عرض ستون‌های گریدها با کشیدن — عمر آن همان عمر تب است (بستن تب = پیش‌فرض).
  const paneRef = useRef<HTMLDivElement>(null);
  useResizableColumns(paneRef);
  return (
    <Box
      ref={paneRef}
      role="tabpanel"
      data-tab-active={focused ? 'true' : undefined}
      hidden={slot < 0}
      onPointerDownCapture={split && !focused ? () => onFocusRequest(tabKey) : undefined}
      sx={{
        display: slot < 0 ? 'none' : 'block',
        ...(split && {
          // قسمت‌ها با order زوج، جداکننده‌ها با order فرد بینشان.
          order: (slot - 1) * 2,
          flex: `${width} 1 0`,
          minWidth: 0,
          height,
          overflow: 'auto',
          p: 2,
          borderRadius: 2,
          border: 1,
          borderColor: focused ? 'primary.main' : 'divider',
          boxShadow: (theme) => (focused ? `0 0 0 1px ${theme.palette.primary.main}` : 'none'),
          transition: 'border-color 120ms, box-shadow 120ms',
          // چاپ در نمای کنار هم: فقط قسمت فعال، تمام‌قد و بدون قاب.
          '@media print': focused
            ? { height: 'auto', overflow: 'visible', border: 0, boxShadow: 'none', p: 0, flex: 'none', width: '100%' }
            : { display: 'none' },
        }),
      }}
    >
      <UNSAFE_NavigationContext.Provider value={tabNavigation}>
        <TabIdContext.Provider value={tabKey}>
          <TabActivityContext.Provider value={focused}>{element}</TabActivityContext.Provider>
        </TabIdContext.Provider>
      </UNSAFE_NavigationContext.Provider>
    </Box>
  );
});

type PendingClose = { keys: string[]; title: string } | null;

/**
 * نوار تب + محتوای تب‌ها. `fallback` برای مسیرهای بیرون از تب‌ها (صفحهٔ اصلی، عملیات، گزارش‌ها…) نمایش داده
 * می‌شود؛ در آن حالت همهٔ تب‌ها مخفی‌اند ولی زنده می‌مانند.
 */
export function WorkspaceTabs({ fallback }: { fallback: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const notify = useNotify();

  const [tabs, setTabs] = useState<WorkspaceTab[]>(readStoredTabs);
  /** تبی که خود این کامپوننت به آن می‌رود (کلیک تب، بستن تب، نسخهٔ تازه) — تا آدرس به تب دیگری نسبت داده نشود. */
  const tabHint = useRef<string | null>(null);
  const lastIdRef = useRef<string | null>(null);
  // فقط یک بار برای هر آدرس — تغییر بعدی `tabs` نباید تب آدرس فعلی را عوض کند.
  const resolved = useMemo(
    () => resolveTab(location.pathname, location.search, tabHint.current, tabs, lastIdRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location],
  );
  const activeId = resolved?.id ?? null;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  const goToTab = useCallback(
    (tab: WorkspaceTab) => {
      tabHint.current = tab.id;
      navigate(tab.location.pathname + tab.location.search, { state: tab.location.state });
    },
    [navigate],
  );
  /** تب‌هایی که در همین نشست باز/دیده شده‌اند — تب‌های برگشته از رفرش تا کلیک نشوند mount نمی‌شوند. */
  const [mounted, setMounted] = useState<Set<string>>(() => new Set());
  const [pendingClose, setPendingClose] = useState<PendingClose>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const previousUrl = useRef<string>('/');
  const scrollByTab = useRef<Record<string, number>>({});

  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
  /** قسمت سوم فقط روی صفحهٔ پهن — زیر آن، فرم‌ها در یک‌سوم عرض قابل استفاده نیستند. */
  const isWideScreen = useMediaQuery(theme.breakpoints.up('lg'));
  const maxSplit = isWideScreen ? MAX_SPLIT : 2;
  const [splitRaw, setSplit] = useState<SplitState | null>(() => readStoredSplit(tabs));
  const split = splitRaw ? splitRaw.slice(0, maxSplit) : null;
  const [storedWidths, setWidths] = useState<number[]>(readStoredWidths);
  const widths = split && storedWidths.length === split.length ? storedWidths : equalWidths(split?.length ?? 2);
  const [paneHeight, setPaneHeight] = useState(600);
  /** قسمتی از نمای کنار هم که آخرین بار فعال بوده — تب تازه از منو جای همین قسمت می‌نشیند. */
  const focusedSlot = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const showSplit =
    !isSmallScreen && split !== null && split.length >= 2 && activeId !== null && split.includes(activeId);

  useEffect(() => writeStoredTabs(tabs), [tabs]);
  useEffect(() => writeStorage(SPLIT_STORAGE_KEY, splitRaw), [splitRaw]);

  function updateSplit(next: SplitState | null) {
    const value = next && next.length >= 2 ? next : null;
    setSplit(value);
    if (value?.length !== split?.length) {
      // تعداد قسمت‌ها عوض شد — عرض‌ها از نو مساوی.
      setWidths([]);
      writeStorage(SPLIT_WIDTHS_STORAGE_KEY, null);
    }
  }

  // در نمای کنار هم هر قسمت اسکرول خودش را دارد؛ ارتفاع تا پایین پنجره.
  useLayoutEffect(() => {
    if (!showSplit) return;
    window.scrollTo(0, 0);
    const measure = () => {
      const top = containerRef.current?.getBoundingClientRect().top ?? 0;
      setPaneHeight(Math.max(360, window.innerHeight - top - 24));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [showSplit]);

  /**
   * ناوبری از داخل یک تب: تب فعال (یا تبی که همین الان داریم به آن می‌رویم) = ناوبری عادی مرورگر. تب پشتی = فقط
   * آدرس همان تب در حافظه عوض می‌شود و صفحه‌اش در پس‌زمینه به مقصد می‌رود.
   */
  const navigateInTab = useCallback((tabId: string, to: To, state: unknown): boolean => {
    if (tabId === activeIdRef.current || tabId === tabHint.current) return false;
    const path = typeof to === 'string' ? parsePath(to) : to;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId
          ? {
              ...t,
              location: {
                pathname: path.pathname ?? t.location.pathname,
                search: path.search ?? '',
                hash: path.hash ?? '',
                state: state ?? null,
                key: `bg-${Date.now()}`,
              },
            }
          : t,
      ),
    );
    return true;
  }, []);

  // تابع پایدار تا memo قسمت‌ها نشکند.
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const focusPane = useCallback(
    (id: string) => {
      const tab = tabsRef.current.find((t) => t.id === id);
      if (tab) goToTab(tab);
    },
    [goToTab],
  );

  /** کشیدن جداکنندهٔ بین قسمت `index` و `index + 1`؛ فقط سهم همین دو قسمت جابه‌جا می‌شود. */
  function startResize(index: number, e: React.PointerEvent<HTMLDivElement>) {
    const container = containerRef.current;
    if (!container) return;
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const isRtl = theme.direction === 'rtl';
    const start = [...widths];
    const before = start.slice(0, index).reduce((s, w) => s + w, 0);
    const pair = start[index] + start[index + 1];
    let latest = start;
    const onMove = (ev: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const pos = isRtl ? (rect.right - ev.clientX) / rect.width : (ev.clientX - rect.left) / rect.width;
      const first = Math.min(pair - MIN_WIDTH, Math.max(MIN_WIDTH, pos - before));
      latest = start.map((w, i) => (i === index ? first : i === index + 1 ? pair - first : w));
      setWidths(latest);
    };
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = '';
      writeStorage(SPLIT_WIDTHS_STORAGE_KEY, latest);
    };
    document.body.style.userSelect = 'none';
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  }

  function resetWidths() {
    setWidths([]);
    writeStorage(SPLIT_WIDTHS_STORAGE_KEY, null);
  }

  /**
   * جا برای یک تب تازه: زیر سقف، همان فهرست؛ وگرنه قدیمی‌ترین تبی که فرم باز ندارد و در نمای کنار هم نیست
   * کنار می‌رود. اگر چنین تبی نباشد `null` (تب تازه باز نمی‌شود).
   */
  function makeRoom(list: WorkspaceTab[]): WorkspaceTab[] | null {
    if (list.length < MAX_TABS) return list;
    const evictable = list
      .filter((t) => !isFormLocation(t) && !split?.includes(t.id))
      .sort((a, b) => a.lastActive - b.lastActive)[0];
    if (!evictable) return null;
    setMounted((prev) => new Set([...prev].filter((id) => id !== evictable.id)));
    notifyTabsClosed([evictable.id]);
    return list.filter((t) => t.id !== evictable.id);
  }

  function notifyTabLimit() {
    notify({ message: `حداکثر ${MAX_TABS} تب می‌توان باز کرد. ابتدا یکی از تب‌ها را ببندید.`, severity: 'warning' });
  }

  /** افزودن تب به نمای کنار هم (اگر نمای کنار هم نیست، با تب فعال ساخته می‌شود). */
  function addToSplit(id: string) {
    if (!activeId || id === activeId) return;
    if (showSplit && split) {
      if (split.includes(id) || split.length >= maxSplit) return;
      updateSplit([...split, id]);
    } else {
      updateSplit([activeId, id]);
      focusedSlot.current = 0;
    }
    setMounted((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }

  function removeFromSplit(id: string) {
    if (!split) return;
    const next = split.filter((k) => k !== id);
    updateSplit(next);
    if (id === activeId && next.length > 0) focusPane(next[Math.min(focusedSlot.current, next.length - 1)]);
  }

  /**
   * نسخهٔ دیگری از همان صفحه در تب تازه (مثلاً دو تراز آزمایشی با پارامترهای متفاوت). با `beside` کنار همان تب
   * در نمای کنار هم می‌نشیند.
   */
  function duplicateTab(source: WorkspaceTab, beside: boolean) {
    const room = makeRoom(tabs);
    if (!room) {
      notifyTabLimit();
      return;
    }
    const id = newTabId(source.key, tabs);
    const copy: WorkspaceTab = {
      id,
      key: source.key,
      location: { ...source.location, state: null, key: `copy-${id}` },
      lastActive: Date.now(),
    };
    // وضعیت بیرونی صفحه (مثلاً دامنهٔ واحد گزارش) هم با نسخه کپی می‌شود.
    notifyTabDuplicated(source.id, id);
    setTabs([...room, copy]);
    if (beside && !isSmallScreen) {
      if (showSplit && split?.includes(source.id)) {
        if (split.length < maxSplit) updateSplit([...split, id]);
      } else {
        updateSplit([source.id, id]);
      }
      setMounted((prev) => new Set(prev).add(source.id));
    }
    goToTab(copy);
  }

  // باز کردن/به‌روز کردن تب با هر تغییر آدرس.
  useEffect(() => {
    const url = location.pathname + location.search;
    tabHint.current = null;
    const refusedFrom = lastIdRef.current;
    lastIdRef.current = activeId;
    if (!resolved) {
      previousUrl.current = url;
      return;
    }
    const { id, key } = resolved;

    const now = Date.now();
    if (tabs.some((t) => t.id === id)) {
      setTabs(tabs.map((t) => (t.id === id ? { ...t, location, lastActive: now } : t)));
    } else {
      const room = makeRoom(tabs);
      if (!room) {
        notifyTabLimit();
        lastIdRef.current = refusedFrom;
        tabHint.current = refusedFrom;
        navigate(previousUrl.current, { replace: true });
        return;
      }
      setTabs([...room, { id, key, location, lastActive: now }]);
    }
    setMounted((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));

    // نمای کنار هم: تبی که از منو/نوار تب باز شده و در قسمت‌ها نیست، جای قسمت فعال می‌نشیند.
    if (split) {
      const index = split.indexOf(id);
      if (index >= 0) focusedSlot.current = index;
      else if (!isSmallScreen) {
        const slot = Math.min(focusedSlot.current, split.length - 1);
        setSplit(split.map((k, i) => (i === slot ? id : k)));
      }
    }
    previousUrl.current = url;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // جای اسکرول هر تب (فقط نمای تک‌صفحه‌ای — در نمای کنار هم هر قسمت اسکرول خودش را دارد).
  useEffect(() => {
    if (showSplit) return;
    const onScroll = () => {
      if (activeId) scrollByTab.current[activeId] = window.scrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [activeId, showSplit]);

  useLayoutEffect(() => {
    if (activeId && !showSplit) window.scrollTo(0, scrollByTab.current[activeId] ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // تب تازه پیش از اجرای effect بالا هنوز در `tabs` نیست — همین‌جا اضافه می‌شود تا یک فریم صفحهٔ خالی دیده نشود.
  const visibleSplit = showSplit && split ? split : [];
  const visibleSplitId = visibleSplit.join('|');
  const mountedTabs = useMemo(() => {
    const list = tabs.filter((t) => mounted.has(t.id) || t.id === activeId || visibleSplit.includes(t.id));
    if (resolved && !list.some((t) => t.id === resolved.id)) list.push({ ...resolved, location, lastActive: 0 });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs, mounted, resolved, location, visibleSplitId]);

  function paneSlot(id: string): number {
    if (showSplit) return visibleSplit.indexOf(id) + 1 || -1;
    return id === activeId ? 0 : -1;
  }

  const doClose = useCallback(
    (ids: string[]) => {
      const closing = new Set(ids);
      const remaining = tabs.filter((t) => !closing.has(t.id));
      setTabs(remaining);
      setMounted((prev) => new Set([...prev].filter((id) => !closing.has(id))));
      ids.forEach((id) => delete scrollByTab.current[id]);
      notifyTabsClosed(ids);
      // بستن تبی از نمای کنار هم = برداشتنش از قسمت‌ها (با یک قسمت باقی‌مانده، نمای تک‌صفحه‌ای).
      const splitLeft = split ? split.filter((id) => !closing.has(id)) : [];
      if (split && splitLeft.length !== split.length) updateSplit(splitLeft);
      if (activeId && closing.has(activeId)) {
        const next =
          remaining.find((t) => t.id === splitLeft[Math.min(focusedSlot.current, splitLeft.length - 1)]) ??
          [...remaining].sort((a, b) => b.lastActive - a.lastActive)[0];
        if (next) goToTab(next);
        else navigate('/');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tabs, activeId, navigate, split],
  );

  const requestClose = useCallback(
    (ids: string[]) => {
      const withForm = tabs.filter((t) => ids.includes(t.id) && isFormLocation(t));
      if (withForm.length === 0) {
        doClose(ids);
        return;
      }
      const names = withForm.map((t) => tabTitle(t, tabs)).join('، ');
      setPendingClose({ keys: ids, title: names });
    },
    [tabs, doClose],
  );

  // تغییر سال مالی یا واحد وسط کار: همهٔ تب‌ها بسته می‌شوند تا هیچ صفحه‌ای با داده یا فرمِ سال/واحد قبلی باز نماند
  // و چیزی به اشتباه در سال/واحد تازه ثبت نشود. اگر فرمی باز است، اول پرسیده می‌شود: «بستن» یا «انصراف» که
  // سال/واحد را به مقدار قبلی برمی‌گرداند تا کاربر فرمش را ذخیره کند. مقدار اولیهٔ خالی تغییر حساب نمی‌شود.
  const session = useSession();
  const { financialYear, unitCode, unitName } = session;
  const scope = useRef({ financialYear, unitCode, unitName });
  const reverting = useRef(false);
  const [pendingScope, setPendingScope] = useState<{ prev: typeof scope.current; what: string; forms: string } | null>(null);

  const closeAllForScope = useCallback((what: string) => {
    doClose(tabs.map((t) => t.id));
    navigate('/');
    notify({ message: `با تغییر ${what}، همهٔ تب‌ها بسته شد.`, severity: 'info' });
  }, [tabs, doClose, navigate, notify]);

  useEffect(() => {
    const prev = scope.current;
    scope.current = { financialYear, unitCode, unitName };
    if (reverting.current) {
      // برگشت به سال/واحد قبلی پس از «انصراف» — خودش تغییر تازه نیست.
      reverting.current = false;
      return;
    }
    const yearChanged = !!prev.financialYear && prev.financialYear !== financialYear;
    const unitChanged = !!prev.unitCode && prev.unitCode !== unitCode;
    if ((!yearChanged && !unitChanged) || tabs.length === 0) return;
    const what = yearChanged && unitChanged ? 'سال مالی و واحد' : yearChanged ? 'سال مالی' : 'واحد';
    const forms = tabs.filter(isFormLocation).map((t) => tabTitle(t, tabs));
    if (forms.length === 0) closeAllForScope(what);
    else setPendingScope({ prev, what, forms: forms.join('، ') });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [financialYear, unitCode]);

  function cancelScopeChange() {
    if (!pendingScope) return;
    const { prev } = pendingScope;
    reverting.current = true;
    if (prev.financialYear !== financialYear) session.setFinancialYear(prev.financialYear);
    if (prev.unitCode !== unitCode) session.setUnit({ unitCode: prev.unitCode, unitName: prev.unitName });
    setPendingScope(null);
    notify({ message: `${pendingScope.what} به مقدار قبلی برگشت؛ فرم‌ها را ذخیره کنید و دوباره تغییر دهید.`, severity: 'info' });
  }

  function switchTo(id: string) {
    const tab = tabs.find((t) => t.id === id);
    if (tab && id !== activeId) goToTab(tab);
  }

  const isTabRoute = resolved !== null;
  const menuTab = menu ? tabs.find((t) => t.id === menu.id) : undefined;
  const canAddBeside = !!menuTab && (!showSplit || !split?.includes(menuTab.id) || (split?.length ?? 0) < maxSplit);

  return (
    <>
      {tabs.length > 0 && (
        <Box
          sx={{
            displayPrint: 'none',
            mb: 2,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            borderRadius: '8px 8px 0 0',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Tabs
            value={isTabRoute && tabs.some((t) => t.id === activeId) ? activeId : false}
            onChange={(_, id: string) => switchTo(id)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="فرم‌های باز"
            sx={{ minHeight: 40, flex: 1, minWidth: 0 }}
          >
            {tabs.map((tab) => {
              const title = tabTitle(tab, tabs);
              return (
                <Tab
                  key={tab.id}
                  value={tab.id}
                  component="div"
                  onAuxClick={(e: React.MouseEvent) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      requestClose([tab.id]);
                    }
                  }}
                  onContextMenu={(e: React.MouseEvent) => {
                    e.preventDefault();
                    setMenu({ x: e.clientX, y: e.clientY, id: tab.id });
                  }}
                  sx={{
                    minHeight: 40,
                    py: 0.5,
                    pe: 1,
                    textTransform: 'none',
                    '&:hover': {
                      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                    },
                    // تب دیگرِ نمای کنار هم — دیده می‌شود ولی فعال نیست.
                    ...(tab.id !== activeId &&
                      visibleSplit.includes(tab.id) && {
                        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.07),
                        borderBottom: '2px dashed',
                        borderColor: 'primary.light',
                      }),
                  }}
                  label={
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                      <span>
                        {title}
                        {tabSubtitle(tab)}
                      </span>
                      <Box
                        component="span"
                        role="button"
                        tabIndex={0}
                        aria-label={`بستن ${title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          requestClose([tab.id]);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            requestClose([tab.id]);
                          }
                        }}
                        sx={{
                          display: 'inline-flex',
                          borderRadius: '50%',
                          p: 0.25,
                          color: 'text.secondary',
                          '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
                        }}
                      >
                        <CloseIcon sx={{ fontSize: 16 }} />
                      </Box>
                    </Box>
                  }
                />
              );
            })}
          </Tabs>
          {showSplit && (
            <Button
              size="small"
              startIcon={<CloseFullscreenOutlinedIcon fontSize="small" />}
              onClick={() => updateSplit(null)}
              sx={{ flexShrink: 0, mx: 1, whiteSpace: 'nowrap' }}
            >
              نمای تک‌صفحه‌ای
            </Button>
          )}
        </Box>
      )}

      <Menu
        open={menu !== null}
        onClose={() => setMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={menu ? { top: menu.y, left: menu.x } : undefined}
      >
        {menuTab && (
          <MenuItem
            onClick={() => {
              duplicateTab(menuTab, false);
              setMenu(null);
            }}
          >
            <ListItemIcon>
              <LibraryAddOutlinedIcon fontSize="small" />
            </ListItemIcon>
            باز کردن نسخهٔ دیگر در تب جدید
          </MenuItem>
        )}
        {!isSmallScreen && menuTab && (
          <MenuItem
            disabled={!canAddBeside}
            onClick={() => {
              duplicateTab(menuTab, true);
              setMenu(null);
            }}
          >
            <ListItemIcon>
              <VerticalSplitOutlinedIcon fontSize="small" />
            </ListItemIcon>
            {canAddBeside
              ? 'نسخهٔ دیگر، کنار همین تب'
              : `نسخهٔ دیگر کنار هم (حداکثر ${toPersianDigits(maxSplit)} قسمت)`}
          </MenuItem>
        )}
        {menuTab && <Divider />}
        {!isSmallScreen && menu && !visibleSplit.includes(menu.id) && (
          <MenuItem
            disabled={!activeId || menu.id === activeId || visibleSplit.length >= maxSplit}
            onClick={() => {
              addToSplit(menu.id);
              setMenu(null);
            }}
          >
            <ListItemIcon>
              <VerticalSplitOutlinedIcon fontSize="small" />
            </ListItemIcon>
            {visibleSplit.length >= maxSplit
              ? `نمایش کنار هم (حداکثر ${toPersianDigits(maxSplit)} قسمت)`
              : 'نمایش کنار تب فعال'}
          </MenuItem>
        )}
        {menu && visibleSplit.length > 2 && visibleSplit.includes(menu.id) && (
          <MenuItem
            onClick={() => {
              removeFromSplit(menu.id);
              setMenu(null);
            }}
          >
            <ListItemIcon>
              <CloseIcon fontSize="small" />
            </ListItemIcon>
            برداشتن از نمای کنار هم
          </MenuItem>
        )}
        {showSplit && (
          <MenuItem
            onClick={() => {
              updateSplit(null);
              setMenu(null);
            }}
          >
            <ListItemIcon>
              <CloseFullscreenOutlinedIcon fontSize="small" />
            </ListItemIcon>
            نمای تک‌صفحه‌ای
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            if (menu) requestClose([menu.id]);
            setMenu(null);
          }}
        >
          بستن
        </MenuItem>
        <MenuItem
          disabled={tabs.length < 2}
          onClick={() => {
            if (menu) requestClose(tabs.filter((t) => t.id !== menu.id).map((t) => t.id));
            setMenu(null);
          }}
        >
          بستن بقیهٔ تب‌ها
        </MenuItem>
        <MenuItem
          onClick={() => {
            requestClose(tabs.map((t) => t.id));
            setMenu(null);
          }}
        >
          بستن همهٔ تب‌ها
        </MenuItem>
      </Menu>

      <ConfirmDialog
        open={pendingClose !== null}
        title="بستن تب"
        description={`فرم «${pendingClose?.title ?? ''}» باز است و تغییرات ذخیره‌نشدهٔ آن از بین می‌رود. بسته شود؟`}
        confirmLabel="بستن"
        onConfirm={() => {
          if (pendingClose) doClose(pendingClose.keys);
          setPendingClose(null);
        }}
        onCancel={() => setPendingClose(null)}
      />
      <ConfirmDialog
        open={pendingScope !== null}
        title={`تغییر ${pendingScope?.what ?? ''}`}
        description={`فرم «${pendingScope?.forms ?? ''}» باز است. با تغییر ${pendingScope?.what ?? ''} همهٔ تب‌ها بسته می‌شوند و اطلاعات ذخیره‌نشدهٔ فرم‌ها از بین می‌رود. اگر نیازی به ذخیرهٔ آن‌ها ندارید «بستن» را بزنید؛ وگرنه «انصراف» تا ${pendingScope?.what ?? ''} به مقدار قبلی برگردد و فرم‌ها را ذخیره کنید.`}
        confirmLabel="بستن تب‌ها"
        cancelLabel="انصراف"
        onConfirm={() => {
          const what = pendingScope?.what ?? '';
          setPendingScope(null);
          closeAllForScope(what);
        }}
        onCancel={cancelScopeChange}
      />

      {/* ساختار درخت در هر دو نما یکی است تا رفتن به/از نمای کنار هم هیچ تبی را دوباره mount نکند. */}
      <Box
        ref={containerRef}
        sx={
          showSplit
            ? { display: 'flex', alignItems: 'stretch', gap: 0, '@media print': { display: 'block' } }
            : undefined
        }
      >
        {mountedTabs.map((tab) => (
          <TabPane
            key={tab.id}
            tabKey={tab.id}
            location={tab.id === activeId ? location : tab.location}
            slot={paneSlot(tab.id)}
            width={widths[visibleSplit.indexOf(tab.id)] ?? 1}
            height={paneHeight}
            focused={tab.id === activeId}
            onFocusRequest={focusPane}
            onNavigate={navigateInTab}
          />
        ))}
        {Array.from({ length: MAX_SPLIT - 1 }, (_, index) => (
          <Box
            key={`separator-${index}`}
            role="separator"
            aria-orientation="vertical"
            aria-label="تغییر عرض قسمت‌ها"
            onPointerDown={(e) => startResize(index, e)}
            onDoubleClick={resetWidths}
            sx={{
              display: index < visibleSplit.length - 1 ? 'flex' : 'none',
              displayPrint: 'none',
              order: index * 2 + 1,
              flex: '0 0 12px',
              cursor: 'col-resize',
              alignItems: 'center',
              justifyContent: 'center',
              touchAction: 'none',
              '&::after': {
                content: '""',
                width: 4,
                height: 40,
                borderRadius: 2,
                bgcolor: 'divider',
                transition: 'background-color 120ms',
              },
              '&:hover::after': { bgcolor: 'primary.main' },
            }}
          />
        ))}
      </Box>

      {!isTabRoute && fallback}
    </>
  );
}
