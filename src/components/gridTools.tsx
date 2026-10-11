import { isValidElement, useMemo, useState, type ReactNode } from 'react';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import TableSortLabel from '@mui/material/TableSortLabel';
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined';
import { toLatinDigits } from '../lib/format/numbers';

/**
 * ابزار مشترک گریدها (درخواست صاحب پروژه ۲۰۲۶-۱۰-۱۱): مرتب‌سازی با کلیک روی سرستون (صعودی ← نزولی ← بدون
 * ترتیب) و انتخاب ستون‌های قابل نمایش، که برای هر گرید در مرورگر همان کاربر به خاطر سپرده می‌شود.
 * `DataTable` و گریدهای دست‌ساز گزارش‌ها هر دو از همین استفاده می‌کنند.
 */

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: string;
  direction: SortDirection;
}

export type SortValue = string | number | null;

/** مقدار قابل مقایسه از متن: «۱۲,۳۴۵» و «-۵» عدد می‌شوند، بقیه متن می‌مانند. */
export function normalizeSortValue(value: unknown): SortValue {
  if (value === null || value === undefined || value === '' || value === '—') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value !== 'string') return null;
  const latin = toLatinDigits(value).trim();
  const numeric = latin.replace(/[,،\s]/g, '').replace(/^\((.*)\)$/, '-$1');
  if (/^-?\d+(\.\d+)?$/.test(numeric)) return Number(numeric);
  return latin;
}

/**
 * مقدار مرتب‌سازی از خروجی render ستون: متن/عدد مستقیم؛ از عنصر React هم `value`/`label`/فرزند متنی
 * (مثل `MonoCode value`، `Chip label`، `Typography` با متن) — تا بیشتر ستون‌ها بدون تعریف اضافه مرتب شوند.
 */
export function sortValueFromNode(node: ReactNode, depth = 0): SortValue {
  if (node === null || node === undefined || typeof node === 'boolean') return null;
  if (typeof node === 'string' || typeof node === 'number') return normalizeSortValue(node);
  if (depth > 3) return null;
  if (Array.isArray(node)) {
    const parts = node.map((n) => sortValueFromNode(n, depth + 1)).filter((v) => v !== null);
    if (parts.length === 0) return null;
    return parts.length === 1 ? parts[0] : normalizeSortValue(parts.join(' '));
  }
  if (isValidElement(node)) {
    const props = node.props as { value?: unknown; label?: unknown; children?: ReactNode; title?: unknown };
    for (const candidate of [props.value, props.label]) {
      if (typeof candidate === 'string' || typeof candidate === 'number') return normalizeSortValue(candidate);
    }
    return sortValueFromNode(props.children, depth + 1);
  }
  return null;
}

const collator = new Intl.Collator('fa', { numeric: true, sensitivity: 'base' });

/** مقایسه: خالی‌ها همیشه آخر؛ عدد با عدد؛ متن با ترتیب الفبای فارسی. */
export function compareSortValues(a: SortValue, b: SortValue): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a), String(b));
}

/** سطرها به ترتیب `sort`؛ پایدار (ترتیب اصلی در مقدار برابر حفظ می‌شود). خالی‌ها در هر دو جهت آخر. */
export function sortRows<T>(rows: readonly T[], sort: SortState | null, valueOf: (row: T, key: string) => SortValue): T[] {
  if (!sort) return rows as T[];
  const sign = sort.direction === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: valueOf(row, sort.key) }))
    .sort((x, y) => {
      if (x.value === null || y.value === null) return compareSortValues(x.value, y.value) || x.index - y.index;
      return sign * compareSortValues(x.value, y.value) || x.index - y.index;
    })
    .map((x) => x.row);
}

/** وضعیت مرتب‌سازی: هر کلیک روی یک ستون، صعودی ← نزولی ← بدون ترتیب. */
export function useGridSort(initial: SortState | null = null) {
  const [sort, setSort] = useState<SortState | null>(initial);
  function toggle(key: string) {
    setSort((current) => {
      if (!current || current.key !== key) return { key, direction: 'asc' };
      if (current.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  }
  return { sort, toggle, setSort };
}

function readHidden(storageKey: string): string[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * ستون‌های پنهان یک گرید، به خاطر سپرده در مرورگر همین کاربر (`localStorage`؛ اگر در دسترس نبود فقط در
 * همین صفحه). کلید پیش‌فرض = مسیر صفحه + کلید ستون‌ها، تا دو گرید یک صفحه با هم قاطی نشوند.
 */
export function useColumnVisibility(columnKeys: readonly string[], storageKey?: string) {
  const key = storageKey ?? `grid-cols:${typeof window === 'undefined' ? '' : window.location.pathname}:${columnKeys.join(',')}`;
  const [hidden, setHidden] = useState<string[]>(() => readHidden(key));

  function save(next: string[]) {
    setHidden(next);
    try {
      if (next.length === 0) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // ذخیره در مرورگر ممکن نیست (حالت خصوصی و…) — فقط برای همین صفحه می‌ماند.
    }
  }

  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);
  return {
    isVisible: (columnKey: string) => !hiddenSet.has(columnKey),
    toggle: (columnKey: string) =>
      save(hiddenSet.has(columnKey) ? hidden.filter((k) => k !== columnKey) : [...hidden, columnKey]),
    reset: () => save([]),
    hiddenCount: hidden.filter((k) => columnKeys.includes(k)).length,
  };
}

/** برچسب سرستون قابل مرتب‌سازی برای گریدهای دست‌ساز (همان رفتار `DataTable`). */
export function SortLabel({
  sortKey,
  sort,
  onSort,
  children,
}: {
  sortKey: string;
  sort: SortState | null;
  onSort: (key: string) => void;
  children: ReactNode;
}) {
  const active = sort?.key === sortKey;
  return (
    <TableSortLabel
      active={active}
      direction={active ? sort!.direction : 'asc'}
      onClick={(e) => {
        e.stopPropagation();
        onSort(sortKey);
      }}
      title="مرتب‌سازی: صعودی، نزولی، بدون ترتیب"
    >
      {children}
    </TableSortLabel>
  );
}

export interface ChoosableColumn {
  key: string;
  label: string;
}

/**
 * دکمهٔ «ستون‌ها» با فهرست تیک‌دار. حداقل یک ستون همیشه می‌ماند. ستون‌های بی‌عنوان (عملیات) در فهرست نمی‌آیند و
 * همیشه نمایش داده می‌شوند.
 */
export function ColumnChooser({
  columns,
  visibility,
}: {
  columns: ChoosableColumn[];
  visibility: ReturnType<typeof useColumnVisibility>;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const visibleCount = columns.filter((c) => visibility.isVisible(c.key)).length;

  return (
    <>
      <Button
        size="small"
        variant="text"
        color="inherit"
        startIcon={<ViewColumnOutlinedIcon fontSize="small" />}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ color: 'text.secondary', fontWeight: 500 }}
        aria-haspopup="menu"
      >
        ستون‌ها{visibility.hiddenCount > 0 ? ` (${(columns.length - visibility.hiddenCount).toLocaleString('fa-IR')} از ${columns.length.toLocaleString('fa-IR')})` : ''}
      </Button>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)} slotProps={{ paper: { sx: { minWidth: 220, maxHeight: 420 } } }}>
        <ListSubheader sx={{ lineHeight: '36px' }}>ستون‌های قابل نمایش</ListSubheader>
        {columns.map((c) => {
          const visible = visibility.isVisible(c.key);
          const locked = visible && visibleCount <= 1;
          return (
            <MenuItem key={c.key} dense disabled={locked} onClick={() => visibility.toggle(c.key)}>
              <ListItemIcon>
                <Checkbox size="small" edge="start" checked={visible} tabIndex={-1} disableRipple sx={{ p: 0.25 }} />
              </ListItemIcon>
              <ListItemText primary={c.label} />
            </MenuItem>
          );
        })}
        {visibility.hiddenCount > 0 && <Divider />}
        {visibility.hiddenCount > 0 && (
          <MenuItem dense onClick={() => visibility.reset()}>
            <ListItemText primary="نمایش همهٔ ستون‌ها" slotProps={{ primary: { color: 'primary', sx: { fontWeight: 600 } } }} />
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
