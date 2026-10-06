import { useState } from 'react';
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { formatThousands, toPersianDigits } from '../../lib/format/numbers';
import { VoucherLineCheque } from '../vouchers/VoucherLineCheque';
import { VoucherLineExtras } from '../vouchers/VoucherLineExtras';
import { lineExtrasPayload, missingExtras, type VoucherLineRequirements } from '../vouchers/lineExtras';
import type { VoucherEntryFormSchema } from '../vouchers/voucherEntrySchema';
import { draftToFormValues } from './draftMapping';
import type { DraftLineExtrasInput, VoucherDraft } from './types';

interface Props {
  open: boolean;
  draft: VoucherDraft;
  /** نیازمندی هر ردیف پیش‌نویس، به همان ترتیب — از قبل خوانده شده تا فقط ردیف‌های لازم نشان داده شوند. */
  requirements: VoucherLineRequirements[];
  financialYear: string;
  executing: boolean;
  onCancel: () => void;
  onConfirm: (lineExtras: DraftLineExtrasInput[]) => void;
}

/** ردیف پیش‌نویس به چیزی بیش از الگو نیاز دارد؟ (شناسه، ویژگی، یا حساب بانکی ⇒ چک/فیش) */
export function lineNeedsExtras(req: VoucherLineRequirements | undefined): boolean {
  return !!req && (req.attributes.length > 0 || req.identities.length > 0 || req.isBankAccount);
}

/**
 * هنگام «ثبت» سند الگو: برای ردیف‌هایی که حساب شناسه‌دار، ویژگی یا حساب بانکی دارند، همان اجزای فرم ثبت سند
 * (چک/چک صوری، فیش، شناسه، ویژگی) باز می‌شود. چیزی ذخیره نمی‌شود تا «ثبت نهایی»؛ سرور هم همین قواعد را
 * دوباره کنترل می‌کند.
 */
export function LineExtrasDialog({ open, draft, requirements, financialYear, executing, onCancel, onConfirm }: Props) {
  const form = useForm<VoucherEntryFormSchema>({ defaultValues: draftToFormValues(draft, financialYear) });
  const [problems, setProblems] = useState<string[]>([]);

  function confirm() {
    const lines = form.getValues('lines');
    const issues: string[] = [];
    const out: DraftLineExtrasInput[] = [];
    lines.forEach((line, i) => {
      if (!lineNeedsExtras(requirements[i])) return;
      const missing = missingExtras(line);
      if (missing.length) issues.push(`ردیف ${i + 1}: ${missing.join('، ')}`);
      if (line.checkId && !line.chequeSori && (!line.chequePayTo.trim() || !line.chequeDate)) {
        issues.push(`ردیف ${i + 1}: «در وجه» و تاریخ چک`);
      }
      out.push({
        lineIndex: i,
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
      });
    });
    setProblems(issues);
    if (issues.length === 0) onConfirm(out);
  }

  return (
    <Dialog open={open} onClose={executing ? undefined : onCancel} maxWidth="md" fullWidth>
      <DialogTitle>تکمیل اطلاعات ردیف‌ها پیش از ثبت</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          بعضی ردیف‌ها حساب بانکی، حساب شناسه‌دار یا تفصیلی دارای ویژگی دارند. اطلاعاتشان را وارد کنید.
        </Typography>
        <Stack spacing={2}>
          {draft.lines.map((line, i) =>
            lineNeedsExtras(requirements[i]) ? (
              <Paper key={i} variant="outlined" sx={{ p: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 1.5 }}>
                  ردیف {toPersianDigits(String(i + 1))}: {toPersianDigits(line.subsidiaryAccountCode ?? '')} {line.subsidiaryAccountTitle}
                  {line.details.length > 0 && ` — ${line.details.map((d) => d.detailTitle).join('، ')}`}
                  {' — '}
                  {line.debit > 0 ? `بدهکار ${formatThousands(line.debit)}` : `بستانکار ${formatThousands(line.credit)}`}
                </Typography>
                <Grid container spacing={2}>
                  <LineBlock form={form} index={i} isBankCredit={!!requirements[i]?.isBankAccount && line.credit > 0} />
                </Grid>
              </Paper>
            ) : null,
          )}
        </Stack>
        {problems.length > 0 && (
          <Alert severity="error" sx={{ mt: 2 }}>
            این موارد کامل نیست: {problems.join(' · ')}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={executing}>انصراف</Button>
        <Button variant="contained" onClick={confirm} disabled={executing}>ثبت نهایی</Button>
      </DialogActions>
    </Dialog>
  );
}

function LineBlock({ form, index, isBankCredit }: { form: UseFormReturn<VoucherEntryFormSchema>; index: number; isBankCredit: boolean }) {
  // VoucherLineExtras نیازمندی را خودش می‌خواند و روی فرم می‌گذارد؛ اینجا فقط چک ردیف بستانکار بانک.
  useWatch({ control: form.control, name: `lines.${index}.extrasReq` });
  return (
    <>
      {isBankCredit && <VoucherLineCheque form={form} index={index} />}
      <VoucherLineExtras form={form} index={index} />
    </>
  );
}
