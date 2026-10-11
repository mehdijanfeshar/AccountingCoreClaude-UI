import { useLayoutEffect, useRef, useState } from 'react';
import { alpha, type Theme } from '@mui/material/styles';
import { toPersianDigits } from '../../../lib/format/numbers';
import { CREDITOR_COLOR, DEBTOR_COLOR } from './chartTokens';

/**
 * طراحی مشترک گرید گزارش‌ها — همان زبان بصری گزارش ماتریسی (درخواست صاحب پروژه ۲۰۲۶-۱۰-۱۱):
 *
 * - سرستون چسبان روی سطح کاغذ، و زیر هر «بدهکار»/«بستانکار» خط ۳px به رنگ همان سری (همان دو رنگ نمودارها).
 * - ستون‌های شناسه (کد/عنوان) ثابت در ابتدای سطر هنگام اسکرول افقی.
 * - راه‌راه کم‌رنگ سطرها و نوار ستون‌های گروه؛ جداکنندهٔ گروه و جداکنندهٔ پررنگ‌تر بخش.
 * - صلیب هاور: سطر با CSS، ستون با کلاس `col-hot` روی سلول‌های هم‌`data-ci` (هوک {@link useColumnHighlight}).
 * - صفرها کم‌رنگ؛ اعداد tabular؛ سطر جمع چسبان پایین با سطح مات.
 *
 * ⚠️ قواعدی که از ماتریس به ارث رسیده و نباید «ساده» شوند:
 * - `insetInlineStart` نه `left` (افزونهٔ RTL، `left` را برعکس می‌کند).
 * - سلول چسبان باید پس‌زمینهٔ مات داشته باشد (وگرنه سطرهای زیرش دیده می‌شوند) — رنگ به‌صورت gradient روی آن.
 * - هایلایت ستون با ‎::after‎ است نه box-shadow (در border-collapse رسم نمی‌شود)، و فقط سلول‌های غیرچسبان
 *   `position: relative` می‌گیرند؛ این قاعده نباید `position` سلول چسبان را بازنویسی کند.
 * - شدت رنگ‌ها در بودجهٔ کنتراست سنجیده‌شدهٔ ماتریس است (`MatrixReportPage.tsx`).
 */

const ZEBRA_ALPHA = 0.035;
const COLUMN_BAND_ALPHA = 0.03;
const ROW_HOT_ALPHA = 0.055;
const COLUMN_HOT_ALPHA = 0.035;

export const DEBIT_SIDE = { key: 'debtor' as const, label: 'بدهکار', color: DEBTOR_COLOR };
export const CREDIT_SIDE = { key: 'creditor' as const, label: 'بستانکار', color: CREDITOR_COLOR };
export const GRID_SIDES = [DEBIT_SIDE, CREDIT_SIDE];

/** لایهٔ رنگ تخت به شکل gradient تا چند لایه در یک backgroundImage جمع شوند. */
export function tintLayer(theme: Theme, opacity: number): string {
  const c = alpha(theme.palette.text.primary, opacity);
  return `linear-gradient(${c}, ${c})`;
}

/** جداکنندهٔ بین دو گروه ستون. */
export const groupSeparator = (theme: Theme) => `1.5px solid ${alpha(theme.palette.text.primary, 0.16)}`;

/** جداکنندهٔ پررنگ‌تر — مرز ستون‌های ثابت و ستون‌های جمع. */
export const sectionSeparator = (theme: Theme) => `2px solid ${alpha(theme.palette.text.primary, 0.28)}`;

const stickyTint = (theme: Theme) => {
  const tint = alpha(theme.palette.primary.main, 0.06);
  return `linear-gradient(${tint}, ${tint})`;
};

/** سطح مات رنگی سلول‌های جمع چسبان. */
export const totalsSurfaceSx = {
  backgroundColor: 'background.paper',
  backgroundImage: (theme: Theme) => stickyTint(theme),
};

/** سلول سطر جمع چسبان پایین گرید. */
export const totalsCellSx = {
  ...totalsSurfaceSx,
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
  borderTop: (theme: Theme) => `2px solid ${alpha(theme.palette.text.primary, 0.35)}`,
  position: 'sticky' as const,
  bottom: 0,
  zIndex: 2,
};

/** ستون جمع داخل بدنه (مثل «جمع سطر» ماتریس). */
export const rowTotalCellSx = {
  backgroundColor: (theme: Theme) => alpha(theme.palette.primary.main, 0.04),
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
};

/** سلول ستون ثابت؛ `offset` = جمع عرض ستون‌های ثابت قبلی (px). */
export function frozenCell(offset: number, zIndex = 2) {
  return {
    position: 'sticky' as const,
    insetInlineStart: offset,
    zIndex,
    backgroundColor: 'background.paper',
  };
}

/** سرستون ثابت (گوشهٔ بالا-راست): هم چسبان بالا هم ابتدای سطر. */
export function frozenHeadCell(offset: number, width: number, extra?: object) {
  return { ...frozenCell(offset, 5), top: 0, width, minWidth: width, ...extra };
}

/** سرستون «بدهکار»/«بستانکار» با خط رنگی سری خودش. `top` برای ردیف دوم سرستون. */
export function sideHeadSx(color: string, options?: { top?: number; first?: boolean; strong?: boolean }) {
  return {
    ...(options?.top !== undefined ? { top: options.top } : {}),
    borderBottom: `3px solid ${color}`,
    borderInlineStart: options?.first ? groupSeparator : undefined,
    fontWeight: options?.strong ? 700 : 500,
    color: options?.strong ? 'text.primary' : 'text.secondary',
  };
}

/** سرستون گروه (ردیف اول سرستون دوطبقه). `band` = نوار ستون فرد. */
export function groupHeadSx(index: number, options?: { strong?: boolean }) {
  return {
    backgroundImage: (theme: Theme) =>
      options?.strong ? stickyTint(theme) : index % 2 === 1 ? tintLayer(theme, COLUMN_BAND_ALPHA) : 'none',
    borderInlineStart: options?.strong ? sectionSeparator : groupSeparator,
    fontWeight: 700,
  };
}

/** سلول مبلغ در بدنه: اعداد tabular، صفر کم‌رنگ، نوار ستون گروه فرد. */
export function amountCellSx(value: number | null | undefined, options?: { band?: boolean; first?: boolean; strong?: boolean }) {
  return {
    fontVariantNumeric: 'tabular-nums',
    color: value ? 'text.primary' : 'text.disabled',
    fontWeight: options?.strong ? 700 : undefined,
    backgroundColor: options?.band ? (theme: Theme) => alpha(theme.palette.text.primary, COLUMN_BAND_ALPHA) : undefined,
    borderInlineStart: options?.first ? groupSeparator : undefined,
  };
}

/** مبلغ با جداکنندهٔ هزارگان و ارقام فارسی؛ منفی با علامت. */
export function gridAmount(value: number | null | undefined): string {
  return toPersianDigits((value ?? 0).toLocaleString('en-US'));
}

/** سطر جمع: `className={GRID_TOTAL_ROW}` تا راه‌راه و هاور رنگش را عوض نکنند. */
export const GRID_TOTAL_ROW = 'rg-total';

/**
 * sx جدول گرید: سرستون روی کاغذ، راه‌راه سطرها، هاور سطر، لایهٔ هایلایت ستون، بدون شکستن خط.
 * `zebra: false` برای جدول‌هایی که سطرهایشان خودشان رنگ دارند (سرفصل گروه و…).
 */
export function reportGridTableSx(options?: { zebra?: boolean; wrap?: boolean }) {
  return {
    '& td, & th': { whiteSpace: options?.wrap ? undefined : 'nowrap' },
    '& thead th': {
      backgroundColor: 'background.paper',
      fontWeight: 600,
    },
    ...(options?.zebra === false
      ? {}
      : {
          '& tbody tr:not(.rg-total):nth-of-type(even) > td': {
            backgroundImage: (theme: Theme) => tintLayer(theme, ZEBRA_ALPHA),
          },
        }),
    '& tbody tr:not(.rg-total):hover > td': {
      backgroundImage: (theme: Theme) => tintLayer(theme, ROW_HOT_ALPHA),
    },
    // سلول‌های غیرچسبان ستون‌دار ظرف لایهٔ هایلایت‌اند؛ چسبان‌ها خودشان ظرف‌اند و position آن‌ها دست نمی‌خورد.
    '& tbody td[data-ci]': { position: 'relative' },
    '& .col-hot::after': {
      content: '""',
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      backgroundColor: (theme: Theme) => alpha(theme.palette.text.primary, COLUMN_HOT_ALPHA),
    },
  };
}

/** نیمهٔ ستونیِ صلیب هاور با نوشتن مستقیم کلاس روی DOM (بدون رندر دوباره) — روی TableContainer بگذارید. */
export function useColumnHighlight() {
  const ref = useRef<HTMLDivElement>(null);
  const hot = useRef<string | null>(null);

  function paint(next: string | null) {
    const root = ref.current;
    if (!root || next === hot.current) return;
    root.querySelectorAll('.col-hot').forEach((el) => el.classList.remove('col-hot'));
    if (next !== null) root.querySelectorAll(`[data-ci="${next}"]`).forEach((el) => el.classList.add('col-hot'));
    hot.current = next;
  }

  return {
    ref,
    onMouseOver: (event: React.MouseEvent<HTMLDivElement>) => {
      const cell = (event.target as HTMLElement).closest('[data-ci]');
      paint(cell instanceof HTMLElement ? (cell.dataset.ci ?? null) : null);
    },
    onMouseLeave: () => paint(null),
  };
}

/** ارتفاع واقعی ردیف اول سرستون دوطبقه، تا ردیف دوم دقیقاً زیرش بچسبد (اندازه‌گیری، نه حدس). */
export function useHeaderRowHeight(fallback = 40) {
  const [height, setHeight] = useState(fallback);
  const [element, setElement] = useState<HTMLTableRowElement | null>(null);
  // callback ref: جدولی که بعد از رسیدن داده mount می‌شود هم اندازه‌گیری شود.
  useLayoutEffect(() => {
    if (!element) return;
    const measure = () => setHeight(element.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return { ref: setElement, height };
}
