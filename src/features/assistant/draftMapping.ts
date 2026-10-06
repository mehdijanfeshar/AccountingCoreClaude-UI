import DateObject from 'react-date-object';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import gregorian from 'react-date-object/calendars/gregorian';
import gregorian_en from 'react-date-object/locales/gregorian_en';
import type { FieldPath, UseFormReturn } from 'react-hook-form';
import { parseLegacyJalali } from '../../components/JalaliDateField';
import { toLatinDigits } from '../../lib/format/numbers';
import { createEmptyVoucherLine } from '../vouchers/voucherFormTypes';
import { lineExtrasPayload } from '../vouchers/lineExtras';
import type { VoucherEntryFormSchema } from '../vouchers/voucherEntrySchema';
import type { ComposedVoucherInput, EngineError, VoucherDraft } from './types';

/**
 * The full editor reuses the voucher-entry form shape (`VoucherEntryFormSchema`) so the existing
 * `VoucherLineRow` — معین picker, dynamic تفصیلی levels, amounts, شرح and چک — works unchanged.
 * `docNum` is never shown: the server assigns the next number when the voucher is saved.
 */
const AUTO_DOC_NUM = 'AUTO';

export function todayJalali(): string {
  return toLatinDigits(new DateObject({ calendar: persian, locale: persian_fa }).format('YYYYMMDD'));
}

/**
 * Default voucher date for the user's financial year (session): today when today is in it, otherwise
 * the last day of that year — so a user working in ۱۴۰۴ never gets a «today» voucher in ۱۴۰۵.
 */
export function defaultVoucherDate(financialYear: string | null | undefined): { value: string; isToday: boolean } {
  const today = todayJalali();
  const year = toLatinDigits(financialYear ?? '').trim();
  if (!/^\d{4}$/.test(year) || today.startsWith(year)) return { value: today, isToday: true };
  const lastDay = new DateObject({ calendar: persian, locale: persian_fa, year: Number(year), month: 12, day: 1 }).toLastOfMonth();
  return { value: toLatinDigits(lastDay.format('YYYYMMDD')), isToday: false };
}

/** Legacy `YYYYMMDD` Jalali ⇒ Gregorian `YYYY-MM-DD` (the operations API takes Gregorian). */
export function jalaliToGregorian(value: string | null | undefined): string | null {
  const parsed = parseLegacyJalali(value);
  if (!parsed) return null;
  return toLatinDigits(new DateObject(parsed).convert(gregorian, gregorian_en).format('YYYY-MM-DD'));
}

export function gregorianToJalali(value: string | null | undefined): string {
  if (!value) return '';
  const d = new DateObject({ date: value, format: 'YYYY-MM-DD', calendar: gregorian, locale: gregorian_en });
  return d.isValid ? toLatinDigits(d.convert(persian, persian_fa).format('YYYYMMDD')) : '';
}

export function draftToFormValues(draft: VoucherDraft | null, fallbackYear: string): VoucherEntryFormSchema {
  const dateDoc = draft ? gregorianToJalali(draft.voucherDate) : defaultVoucherDate(fallbackYear).value;
  const lines = draft
    ? draft.lines.map((line) => {
        const empty = createEmptyVoucherLine();
        return {
          ...empty,
          accountId: line.subsidiaryAccountId,
          accountLabel: `${line.subsidiaryAccountCode ?? ''} - ${line.subsidiaryAccountTitle}`,
          description: line.description,
          debtor: line.debit ? String(line.debit) : '',
          creditor: line.credit ? String(line.credit) : '',
          tafsili: Object.fromEntries(line.details.map((d) => [d.levelId, d.detailId])),
          tafsiliLabels: Object.fromEntries(line.details.map((d) => [d.levelId, d.detailTitle])),
        };
      })
    : [createEmptyVoucherLine(), createEmptyVoucherLine()];

  return {
    docNum: AUTO_DOC_NUM,
    dateDoc,
    year: dateDoc.slice(0, 4) || fallbackYear,
    headDesc: draft?.description ?? '',
    apendix: draft?.apendix ?? '',
    lines,
  };
}

export function formToComposeInput(values: VoucherEntryFormSchema, systemTypeId: string | null): ComposedVoucherInput {
  return {
    voucherDate: jalaliToGregorian(values.dateDoc),
    description: values.headDesc?.trim() || null,
    apendix: values.apendix?.trim() || null,
    systemTypeId,
    lines: values.lines.map((line) => ({
      accountId: line.accountId || null,
      debit: Number(line.debtor || 0),
      credit: Number(line.creditor || 0),
      description: line.description?.trim() || null,
      tafsili: Object.entries(line.tafsili ?? {})
        .filter(([, tafsiliId]) => !!tafsiliId)
        .map(([levelId, tafsiliId]) => ({ levelId, tafsiliId })),
      checkId: line.checkId || null,
      cheque:
        line.checkId || line.soriCheckBookId
          ? {
              payTo: line.chequePayTo.trim() || null,
              chequeDate: line.chequeDate || null,
              description: line.chequeDesc.trim() || null,
              soriCheckBookId: line.checkId ? null : line.soriCheckBookId || null,
            }
          : null,
      extras: lineExtrasPayload(line),
    })),
  };
}

const LINE_FIELD: Record<string, string> = {
  accountId: 'accountId',
  description: 'description',
  cheque: 'chequePayTo',
  extras: 'attributes',
};

/**
 * Puts each server error on the field it names (`lines[2].tafsili.{levelId}` ⇒ that row's تفصیلی
 * select). Returns the errors with no field to sit on — the page lists those above the rows.
 */
export function applyServerErrors(form: UseFormReturn<VoucherEntryFormSchema>, errors: EngineError[]): EngineError[] {
  const unplaced: EngineError[] = [];
  for (const error of errors) {
    const key = error.parameterKey ?? '';
    let path: string | null = null;
    if (key === 'voucherDate') path = 'dateDoc';
    else if (key === 'description') path = 'headDesc';
    else if (key === 'apendix') path = 'apendix';
    else {
      const match = /^lines\[(\d+)\]\.(\w+)(?:\.(.+))?$/.exec(key);
      if (match) {
        const [, index, field, sub] = match;
        if (field === 'tafsili' && sub) path = `lines.${index}.tafsili.${sub}`;
        else if (LINE_FIELD[field]) path = `lines.${index}.${LINE_FIELD[field]}`;
      }
    }
    if (path) form.setError(path as FieldPath<VoucherEntryFormSchema>, { type: 'server', message: error.message });
    // Amount and whole-row problems have no field of their own in VoucherLineRow, so they stay listed.
    if (!path || path.endsWith('chequePayTo')) unplaced.push(error);
  }
  return unplaced;
}

/** `lines[3]…` ⇒ 3, for scrolling to the row an unplaced error is about. */
export function lineIndexOf(error: EngineError): number | null {
  const match = /^lines\[(\d+)\]/.exec(error.parameterKey ?? '');
  return match ? Number(match[1]) : null;
}
