import { useEffect, type RefObject } from 'react';

/**
 * تغییر عرض ستون‌های هر جدول داخل یک تب با کشیدن لبهٔ سرستون — یک‌جا برای همهٔ گریدها و گزارش‌ها، بدون تغییر
 * در صفحه‌ها (جدول‌ها دستی و با سرستون‌های چندردیفه/ستون‌های ثابت ساخته شده‌اند، پس کار روی DOM انجام می‌شود).
 *
 * - اولین کشیدن، عرض فعلی همهٔ ستون‌ها را اندازه می‌گیرد و جدول را به `table-layout: fixed` با یک `<colgroup>`
 *   می‌برد؛ از آن به بعد هر ستون دقیقاً همان عرضی است که کاربر داده (متن بلند با «…» بریده می‌شود).
 * - ستون‌های ثابت (sticky مثل کد و نام حساب) فاصلهٔ افقی‌شان از عرض‌های جدید دوباره حساب می‌شود.
 * - دوبار کلیک روی لبه = برگشت همان جدول به حالت پیش‌فرض.
 * - عرض‌ها فقط در حافظهٔ همین تب‌اند: با بستن تب (unmount) یا رفرش به حالت پیش‌فرض برمی‌گردند. اگر جدول
 *   دوباره ساخته شود (جست‌وجوی تازه) و تعداد ستون‌ها همان باشد، عرض‌ها دوباره اعمال می‌شوند؛ اگر تعداد ستون
 *   عوض شود (انتخاب ستون) جدول به پیش‌فرض برمی‌گردد.
 * - جدولی که `data-no-col-resize` دارد کنار گذاشته می‌شود.
 */

const HANDLE_ATTR = 'data-col-resize-handle';
const COLGROUP_ATTR = 'data-col-resize';
const RESIZED_ATTR = 'data-cols-resized';
const FROZEN_ATTR = 'data-col-resize-frozen';
const MIN_WIDTH = 40;

const STYLE_ID = 'col-resize-styles';
const STYLES = `
[${HANDLE_ATTR}] {
  position: absolute; top: 0; bottom: 0; inset-inline-end: 0; width: 6px;
  cursor: col-resize; z-index: 3; touch-action: none; user-select: none;
}
[${HANDLE_ATTR}]:hover, [${HANDLE_ATTR}][data-active] { background: rgba(30, 64, 175, 0.35); }
table[${RESIZED_ATTR}] > thead > tr > th, table[${RESIZED_ATTR}] > tbody > tr > td,
table[${RESIZED_ATTR}] > tfoot > tr > td { overflow: hidden; text-overflow: ellipsis; }
@media print { [${HANDLE_ATTR}] { display: none; } }
`;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

interface HeaderCell {
  cell: HTMLTableCellElement;
  start: number;
  span: number;
}

/** جای هر سرستون در شبکهٔ ستون‌ها، با در نظر گرفتن rowSpan/colSpan سرستون‌های چندردیفه. */
function headerLayout(table: HTMLTableElement): { cells: HeaderCell[]; count: number } | null {
  const thead = table.tHead;
  if (!thead || thead.rows.length === 0) return null;
  const occupied: boolean[][] = [];
  const cells: HeaderCell[] = [];
  let count = 0;
  Array.from(thead.rows).forEach((row, r) => {
    occupied[r] ??= [];
    let c = 0;
    Array.from(row.cells).forEach((cell) => {
      while (occupied[r][c]) c++;
      const span = Math.max(1, cell.colSpan);
      const rowSpan = Math.max(1, cell.rowSpan);
      for (let i = 0; i < rowSpan; i++) {
        occupied[r + i] ??= [];
        for (let j = 0; j < span; j++) occupied[r + i][c + j] = true;
      }
      cells.push({ cell, start: c, span });
      c += span;
      count = Math.max(count, c);
    });
  });
  return { cells, count };
}

function measure(layout: { cells: HeaderCell[]; count: number }): number[] {
  const widths: (number | undefined)[] = new Array(layout.count).fill(undefined);
  for (const { cell, start, span } of layout.cells) {
    if (span === 1) widths[start] = cell.getBoundingClientRect().width;
  }
  // ستونی که سرستون تک‌ستونه ندارد: سهم مساوی از سرستون گروهی‌اش.
  for (const { cell, start, span } of layout.cells) {
    if (span === 1) continue;
    const missing = [];
    let known = 0;
    for (let i = start; i < start + span; i++) {
      if (widths[i] === undefined) missing.push(i);
      else known += widths[i]!;
    }
    const share = Math.max(MIN_WIDTH, (cell.getBoundingClientRect().width - known) / Math.max(1, missing.length));
    missing.forEach((i) => (widths[i] = share));
  }
  return widths.map((w) => Math.max(MIN_WIDTH, Math.round(w ?? 100)));
}

function inlineSide(table: HTMLTableElement): 'left' | 'right' {
  return getComputedStyle(table).direction === 'rtl' ? 'right' : 'left';
}

/** فاصلهٔ ستون‌های ثابت از لبهٔ جدول، از روی عرض‌های جدید. */
function fixFrozenOffsets(table: HTMLTableElement, widths: number[], layout: { cells: HeaderCell[] }) {
  const side = inlineSide(table);
  const prefix = [0];
  widths.forEach((w, i) => prefix.push(prefix[i] + w));

  const place = (cell: HTMLTableCellElement, start: number): boolean => {
    if (!cell.hasAttribute(FROZEN_ATTR)) {
      const cs = getComputedStyle(cell);
      if (cs.position !== 'sticky' || cs[side] === 'auto') return false;
      cell.setAttribute(FROZEN_ATTR, '');
    }
    cell.style[side] = `${prefix[start] ?? 0}px`;
    return true;
  };

  layout.cells.forEach(({ cell, start }) => place(cell, start));
  const bodyRows = [...Array.from(table.tBodies).flatMap((b) => Array.from(b.rows)), ...Array.from(table.tFoot?.rows ?? [])];
  for (const row of bodyRows) {
    let col = 0;
    for (const cell of Array.from(row.cells)) {
      // ستون‌های ثابت همیشه اول ردیف‌اند؛ اولین ستون غیرثابت یعنی بقیه هم غیرثابت‌اند.
      if (!place(cell, col)) break;
      col += Math.max(1, cell.colSpan);
    }
  }
}

function applyWidths(table: HTMLTableElement, widths: number[], layout: { cells: HeaderCell[] }) {
  let colgroup = table.querySelector<HTMLTableColElement>(`:scope > colgroup[${COLGROUP_ATTR}]`);
  if (!colgroup) {
    colgroup = document.createElement('colgroup');
    colgroup.setAttribute(COLGROUP_ATTR, '');
    table.insertBefore(colgroup, table.firstChild);
  }
  while (colgroup.children.length > widths.length) colgroup.lastChild!.remove();
  while (colgroup.children.length < widths.length) colgroup.appendChild(document.createElement('col'));
  widths.forEach((w, i) => ((colgroup!.children[i] as HTMLElement).style.width = `${w}px`));
  table.style.tableLayout = 'fixed';
  table.style.width = `${widths.reduce((s, w) => s + w, 0)}px`;
  table.style.minWidth = '0';
  table.setAttribute(RESIZED_ATTR, '');
  fixFrozenOffsets(table, widths, layout);
}

function resetTable(table: HTMLTableElement) {
  table.querySelector(`:scope > colgroup[${COLGROUP_ATTR}]`)?.remove();
  table.style.tableLayout = '';
  table.style.width = '';
  table.style.minWidth = '';
  table.removeAttribute(RESIZED_ATTR);
  const side = inlineSide(table);
  table.querySelectorAll<HTMLTableCellElement>(`[${FROZEN_ATTR}]`).forEach((cell) => (cell.style[side] = ''));
}

export function useResizableColumns(containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    ensureStyles();

    /** عرض‌های کاربر به ترتیب جدول‌های داخل تب (ایندکس)، تا جدولِ دوباره‌ساخته‌شده هم همان عرض‌ها را بگیرد. */
    const stored = new Map<number, number[]>();
    let frame = 0;

    const tablesOf = () =>
      Array.from(container.querySelectorAll<HTMLTableElement>('table')).filter((t) => !t.hasAttribute('data-no-col-resize'));

    function startDrag(e: PointerEvent, table: HTMLTableElement, column: number, handle: HTMLElement) {
      e.preventDefault();
      e.stopPropagation();
      const layout = headerLayout(table);
      if (!layout) return;
      const index = tablesOf().indexOf(table);
      const current = stored.get(index);
      const widths = current && current.length === layout.count ? [...current] : measure(layout);
      const isRtl = getComputedStyle(table).direction === 'rtl';
      const startX = e.clientX;
      const startWidth = widths[column];
      handle.setPointerCapture(e.pointerId);
      handle.setAttribute('data-active', '');
      document.body.style.userSelect = 'none';
      applyWidths(table, widths, layout);

      const onMove = (ev: PointerEvent) => {
        const delta = isRtl ? startX - ev.clientX : ev.clientX - startX;
        widths[column] = Math.max(MIN_WIDTH, Math.round(startWidth + delta));
        applyWidths(table, widths, layout);
      };
      const onUp = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onUp);
        handle.removeAttribute('data-active');
        document.body.style.userSelect = '';
        stored.set(index, [...widths]);
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    }

    function scan() {
      frame = 0;
      tablesOf().forEach((table, index) => {
        const layout = headerLayout(table);
        if (!layout) return;

        // دستگیرهٔ کشیدن روی لبهٔ هر سرستون (ستون آخرِ زیر آن سرستون را تغییر می‌دهد).
        for (const { cell, start, span } of layout.cells) {
          if (cell.querySelector(`:scope > [${HANDLE_ATTR}]`)) continue;
          if (getComputedStyle(cell).position === 'static') cell.style.position = 'relative';
          const handle = document.createElement('div');
          handle.setAttribute(HANDLE_ATTR, '');
          handle.setAttribute('aria-hidden', 'true');
          handle.title = 'کشیدن: تغییر عرض ستون — دوبار کلیک: عرض پیش‌فرض';
          const column = start + span - 1;
          handle.addEventListener('pointerdown', (e) => startDrag(e, table, column, handle));
          // کلیک روی دستگیره نباید مرتب‌سازی سرستون را فعال کند.
          handle.addEventListener('click', (e) => e.stopPropagation());
          handle.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            stored.delete(tablesOf().indexOf(table));
            resetTable(table);
          });
          cell.appendChild(handle);
        }

        const widths = stored.get(index);
        if (!widths) return;
        if (widths.length !== layout.count) {
          stored.delete(index);
          resetTable(table);
          return;
        }
        // جدول تازه ساخته شده، یا ردیف‌های تازه با فاصلهٔ پیش‌فرض ستون‌های ثابت آمده‌اند.
        applyWidths(table, widths, layout);
      });
    }

    const observer = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(scan);
    });
    observer.observe(container, { childList: true, subtree: true });
    scan();

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [containerRef]);
}
