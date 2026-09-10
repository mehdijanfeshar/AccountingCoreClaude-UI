import { z } from 'zod';
import type { RefObject } from 'react';
import type { TafsiliLevelDto } from '../../types/tafsili';

/**
 * Dynamic Zod schema for the voucher entry form.
 *
 * ⚠️ This is UX-presentation validation ONLY (CLAUDE.md team rule #1 + explicit task
 * instruction). It is NOT a substitute for backend risk #12 ("الزامی بودن تفصیلی در کد ما
 * پیاده نشده") — `POST /api/voucher-details` still accepts an incomplete/wrong set of
 * `tafsiliLinks` today. This schema exists purely so the UI doesn't let an obviously
 * incomplete row through client-side; the real source of truth remains the backend, which
 * does not enforce this yet.
 *
 * The "which levels are active per row" data is only known asynchronously (after
 * `useTafsiliLevels` resolves for that row's selected معین) and changes over the form's
 * lifetime, so it can't be baked into a static schema shape. Instead, each `VoucherLineRow`
 * reports its currently-active levels into `activeLevelsRef.current[rowKey]`
 * (`VoucherEntryPage` owns and passes down the ref), and the schema's `superRefine` reads
 * that ref at validation time — this keeps the resolver's identity stable (built once via
 * `useMemo`) while still validating against up-to-date, per-row level data.
 */
export type ActiveLevelsByRowKey = Record<string, TafsiliLevelDto[]>;

const lineSchema = z.object({
  key: z.string(),
  accountId: z.string().min(1, 'انتخاب حساب معین الزامی است'),
  accountLabel: z.string(),
  description: z.string().max(200, 'شرح حداکثر ۲۰۰ کاراکتر است').optional().or(z.literal('')),
  debtor: z.string().optional().or(z.literal('')),
  creditor: z.string().optional().or(z.literal('')),
  tafsili: z.record(z.string(), z.string()),
  tafsiliLabels: z.record(z.string(), z.string()),
});

const baseVoucherFormSchema = z.object({
  docNum: z.string().trim().min(1, 'شماره سند الزامی است').max(6, 'شماره سند حداکثر ۶ کاراکتر است'),
  dateDoc: z.string().trim().min(1, 'تاریخ سند الزامی است').max(8, 'تاریخ سند حداکثر ۸ کاراکتر است'),
  year: z.string().trim().min(1, 'سال مالی الزامی است').max(4, 'سال مالی حداکثر ۴ کاراکتر است'),
  headDesc: z.string().max(250, 'شرح سند حداکثر ۲۵۰ کاراکتر است').optional().or(z.literal('')),
  apendix: z.string().max(800, 'پیوست حداکثر ۸۰۰ کاراکتر است').optional().or(z.literal('')),
  lines: z.array(lineSchema).min(1, 'حداقل یک ردیف سند باید ثبت شود'),
});

export type VoucherEntryFormSchema = z.infer<typeof baseVoucherFormSchema>;

export function buildVoucherEntrySchema(activeLevelsRef: RefObject<ActiveLevelsByRowKey>) {
  return baseVoucherFormSchema.superRefine((data, ctx) => {
    const activeLevelsByRowKey = activeLevelsRef.current ?? {};
    data.lines.forEach((line, index) => {
      const activeLevels = activeLevelsByRowKey[line.key] ?? [];
      for (const level of activeLevels) {
        const selected = line.tafsili?.[level.levelId];
        if (!selected) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${level.levelName} (تفصیلی سطح ${level.code}) برای این حساب الزامی است`,
            path: ['lines', index, 'tafsili', level.levelId],
          });
        }
      }
    });
  });
}
