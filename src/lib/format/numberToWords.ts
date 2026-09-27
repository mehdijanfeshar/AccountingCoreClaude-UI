import { toLatinDigits } from './numbers';

/**
 * Persian number-to-words, for amounts. Nothing in the repo had this yet (checked before writing
 * it — `grep`ped for `toWords`/`numberToWords`/`amountInWords` across `src`, no hits), so this is
 * a fresh, dependency-free implementation rather than a port of an existing helper.
 *
 * Display-only, like the rest of `lib/format` — never feed the output back into a form value or
 * API payload.
 */

const ONES = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
const TEENS = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
const TENS = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
const HUNDREDS = ['', 'یکصد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
/** Up to 10^18 - 1 (بیلیون‌ها هم بعید است لازم شود، ولی سقف را بی‌دلیل تنگ نمی‌گیریم). */
const SCALES = ['', 'هزار', 'میلیون', 'میلیارد', 'بیلیون', 'بیلیارد'];

function threeDigitsToWords(n: number): string {
  const parts: string[] = [];
  const hundred = Math.floor(n / 100);
  const rest = n % 100;

  if (hundred) parts.push(HUNDREDS[hundred]);

  if (rest >= 10 && rest < 20) {
    parts.push(TEENS[rest - 10]);
  } else {
    const tens = Math.floor(rest / 10);
    const ones = rest % 10;
    if (tens) parts.push(TENS[tens]);
    if (ones) parts.push(ONES[ones]);
  }

  return parts.join(' و ');
}

/** `۰` → `"صفر"`; negative values get a `"منفی "` prefix. Non-integer input is truncated. */
export function numberToPersianWords(value: number): string {
  if (!Number.isFinite(value)) return '';

  const n = Math.trunc(Math.abs(value));
  if (n === 0) return 'صفر';

  const groups: number[] = [];
  let remaining = n;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    if (groups[i] === 0) continue;
    const groupWords = threeDigitsToWords(groups[i]);
    words.push(SCALES[i] ? `${groupWords} ${SCALES[i]}` : groupWords);
  }

  return (value < 0 ? 'منفی ' : '') + words.join(' و ');
}

/**
 * Money-specific convenience: parses a display/API numeric string or number and appends « ریال ».
 * Returns `''` for empty/invalid input so callers can render nothing rather than "NaN ریال".
 */
export function amountInWordsRial(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const numeric = typeof value === 'number' ? value : Number(toLatinDigits(String(value)));
  if (!Number.isFinite(numeric)) return '';
  return `${numberToPersianWords(numeric)} ریال`;
}
