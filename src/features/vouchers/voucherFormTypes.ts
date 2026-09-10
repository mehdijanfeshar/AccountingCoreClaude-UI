import type { VoucherEntryFormSchema } from './voucherEntrySchema';

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
    key: crypto.randomUUID(),
    accountId: '',
    accountLabel: '',
    description: '',
    debtor: '',
    creditor: '',
    tafsili: {},
    tafsiliLabels: {},
  };
}
