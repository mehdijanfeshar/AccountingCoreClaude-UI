import { newClientId } from '../../lib/ids';
import type { VoucherEntryFormSchema } from './voucherEntrySchema';
import { emptyLineExtras } from './lineExtras';

/**
 * Client-only form shapes for the voucher entry form (`VoucherEntryPage`), derived from the
 * Zod schema (`voucherEntrySchema.ts`) so the RHF form value type and the validated type are
 * always the same shape — never hand-duplicated. NOT wire DTOs — see `api.ts`'s
 * `CreateVoucherHeadPayload`/`CreateVoucherDetailPayload` for the actual request bodies, and
 * `VoucherEntryPage`'s submit handler for the mapping between the two.
 */
export type VoucherLineFormValue = VoucherEntryFormSchema['lines'][number];

/** Factory (not a shared constant) — each call needs its own unique `key`. */
export function createEmptyVoucherLine(): VoucherLineFormValue {
  return {
    // Not crypto.randomUUID: that only exists in a secure context, and this app is opened over
    // plain HTTP on a LAN address during development. See newClientId.
    key: newClientId(),
    accountId: '',
    accountLabel: '',
    description: '',
    debtor: '',
    creditor: '',
    tafsili: {},
    tafsiliLabels: {},
    checkId: '',
    checkLabel: '',
    soriCheckBookId: '',
    chequeSori: false,
    chequeLoaded: true,
    chequePayTo: '',
    chequeDate: '',
    chequeDesc: '',
    ...emptyLineExtras(),
  };
}

/**
 * کادر ورود ردیفِ دست‌نخورده (بدون معین، مبلغ، شرح، تفصیلی و چک). در جدول خلاصه نمی‌آید و پیش از
 * «ذخیره سند» حذف می‌شود تا جلوی ذخیره را نگیرد.
 */
export function isBlankVoucherLine(line: VoucherLineFormValue | undefined): boolean {
  if (!line) return true;
  return (
    !line.accountId &&
    !String(line.debtor ?? '').trim() &&
    !String(line.creditor ?? '').trim() &&
    !String(line.description ?? '').trim() &&
    Object.values(line.tafsili ?? {}).every((v) => !v) &&
    !line.checkId &&
    !line.soriCheckBookId
  );
}
