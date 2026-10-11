import { useEffect, useRef, useState } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import { JalaliDateField } from '../../components/JalaliDateField';
import { toPersianDigits } from '../../lib/format/numbers';
import {
  attributeHint,
  canHaveReceipt,
  identityComplete,
  isDateAttribute,
  lineExtrasApi,
  savedToForm,
} from './lineExtras';
import { IdentityFieldsBlock } from './IdentityFieldsBlock';
import { VoucherIdentityDialog } from './VoucherIdentityDialog';
import type { VoucherEntryFormSchema } from './voucherEntrySchema';

interface Props {
  form: UseFormReturn<VoucherEntryFormSchema>;
  index: number;
  /**
   * ویژگی درجا (بدون پنجره) — برای جایی که خودش پنجره است (دیالوگ «تکمیل اطلاعات ردیف‌ها»ی حسابیار).
   * پیش‌فرض: پنجرهٔ «اطلاعات ویژگی» که مثل برنامهٔ مرجع با ورود تفصیلی ویژگی‌دار خودکار باز می‌شود.
   */
  identityInline?: boolean;
}

/**
 * شناسه، ویژگی و فیش یک ردیف سند — فقط وقتی معین/تفصیلی ردیف آن را بخواهد نمایش داده می‌شود:
 * <ul>
 * <li>حساب شناسه‌دار: یک فیلد برای هر شناسه، با نوع و طول همان تعریف («تعریف حساب‌های شناسه‌دار»).</li>
 * <li>ویژگی: انتخاب شناسنامه (فیلدهای ثابتش نشان داده می‌شود) و ورود فیلدهای متغیر.</li>
 * <li>حساب بانکی بدهکار (واریز): فیش/حواله. برای ردیف بستانکار بانک، برگ چک از بخش چک همین ردیف.</li>
 * </ul>
 */
export function VoucherLineExtras({ form, index, identityInline = false }: Props) {
  const { control, setValue, formState } = form;
  const p = `lines.${index}` as const;
  const accountId = useWatch({ control, name: `${p}.accountId` });
  const tafsili = useWatch({ control, name: `${p}.tafsili` }) ?? {};
  const debtor = useWatch({ control, name: `${p}.debtor` });
  const creditor = useWatch({ control, name: `${p}.creditor` });
  const dateDoc = useWatch({ control, name: 'dateDoc' });
  const formYear = useWatch({ control, name: 'year' });
  const loaded = useWatch({ control, name: `${p}.extrasLoaded` });
  const detailId = useWatch({ control, name: `${p}.extrasDetailId` });
  const req = useWatch({ control, name: `${p}.extrasReq` });
  const attributes = useWatch({ control, name: `${p}.attributes` }) ?? {};
  const identities = useWatch({ control, name: `${p}.identities` }) ?? {};
  const receiptKind = useWatch({ control, name: `${p}.receiptKind` });
  const receiptNo = useWatch({ control, name: `${p}.receiptNo` });
  const receiptDate = useWatch({ control, name: `${p}.receiptDate` });
  const checkId = useWatch({ control, name: `${p}.checkId` });
  const soriCheckBookId = useWatch({ control, name: `${p}.soriCheckBookId` });

  const year = dateDoc && dateDoc.length >= 4 ? dateDoc.slice(0, 4) : formYear;
  const tafsiliIds = Object.values(tafsili).filter(Boolean).sort();

  const requirements = useQuery({
    queryKey: ['voucher-line-req', accountId, tafsiliIds.join(','), year],
    queryFn: () => lineExtrasApi.requirements(accountId, tafsiliIds, year),
    enabled: !!accountId && !!year,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!accountId) {
      if (req) setValue(`${p}.extrasReq`, null);
      return;
    }
    if (requirements.data && requirements.data !== req) setValue(`${p}.extrasReq`, requirements.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requirements.data, accountId]);

  const saved = useQuery({
    queryKey: ['voucher-line-extras', detailId],
    queryFn: () => lineExtrasApi.saved(detailId),
    enabled: !loaded && !!detailId,
  });

  useEffect(() => {
    if (!saved.data || loaded) return;
    const values = savedToForm(saved.data);
    setValue(`${p}.attributes`, values.attributes);
    setValue(`${p}.identities`, values.identities);
    setValue(`${p}.receiptKind`, values.receiptKind);
    setValue(`${p}.receiptNo`, values.receiptNo);
    setValue(`${p}.receiptDate`, values.receiptDate);
    setValue(`${p}.extrasLoaded`, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved.data, loaded]);

  const lineErrors = formState.errors.lines?.[index];
  const summaryError = (lineErrors?.attributes as { message?: string } | undefined)?.message;

  // برنامهٔ مرجع: با ورود تفصیلی ویژگی‌دار، پنجرهٔ «اطلاعات ویژگی» خودکار باز می‌شود. فقط یک بار به‌ازای
  // هر مجموعهٔ ویژگیِ ناقص — بستن پنجره آن را دوباره باز نمی‌کند؛ دکمهٔ «اطلاعات ویژگی» ردیف بازش می‌کند.
  const [identityOpen, setIdentityOpen] = useState(false);
  const autoOpenedFor = useRef('');
  const incompleteKey = (req?.identities ?? [])
    .filter((g) => !identities[g.groupId]?.headId)
    .map((g) => g.groupId)
    .join(',');
  useEffect(() => {
    if (identityInline || !loaded || !accountId) return;
    if (incompleteKey && incompleteKey !== autoOpenedFor.current) {
      autoOpenedFor.current = incompleteKey;
      setIdentityOpen(true);
    }
  }, [identityInline, loaded, accountId, incompleteKey]);

  if (!accountId || !req) return null;
  const showReceipt = canHaveReceipt({ debtor, extrasLoaded: loaded, extrasReq: req, attributes, identities, receiptKind, receiptNo, receiptDate });
  const bankCredit = req.isBankAccount && Number(creditor || 0) > 0;
  if (req.attributes.length === 0 && req.identities.length === 0 && !showReceipt && !bankCredit) return null;

  const dirty = { shouldDirty: true, shouldValidate: formState.isSubmitted };

  function setAttribute(id: string, value: string) {
    setValue(`${p}.attributes`, { ...attributes, [id]: value }, dirty);
  }

  function setIdentity(groupId: string, patch: Partial<{ headId: string; values: Record<string, string> }>) {
    const current = identities[groupId] ?? { headId: '', values: {} };
    setValue(`${p}.identities`, { ...identities, [groupId]: { ...current, ...patch } }, dirty);
  }

  return (
    <Grid size={12}>
      <Stack spacing={1.5} sx={{ p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}>
        {!loaded && <Typography variant="caption" color="text.secondary">در حال خواندن شناسه/ویژگی/فیش ذخیره‌شدهٔ این ردیف...</Typography>}

        {req.attributes.length > 0 && (
          <Grid container spacing={1.5}>
            {req.attributes.map((a) => {
              const label = `شناسهٔ حساب ${toPersianDigits(a.accountCode)}${req.attributes.length > 1 ? ` (${toPersianDigits(String(a.boxNo))})` : ''}`;
              return (
                <Grid key={a.definitionId} size={{ xs: 12, sm: 4 }}>
                  {isDateAttribute(a) ? (
                    <JalaliDateField label={label} required size="small" fullWidth disabled={!loaded}
                      value={attributes[a.definitionId] ?? ''} onChange={(v) => setAttribute(a.definitionId, v)}
                      helperText="حساب شناسه‌دار — تاریخ" />
                  ) : (
                    <TextField label={label} required size="small" fullWidth disabled={!loaded}
                      value={attributes[a.definitionId] ?? ''}
                      onChange={(e) => setAttribute(a.definitionId, e.target.value)}
                      slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: a.length > 0 ? a.length : undefined, dir: 'ltr' } }}
                      helperText={`حساب شناسه‌دار — ${attributeHint(a)}`} />
                  )}
                </Grid>
              );
            })}
          </Grid>
        )}

        {identityInline &&
          req.identities.map((g) => (
            <IdentityFieldsBlock
              key={g.groupId}
              group={g}
              year={year}
              disabled={!loaded}
              value={identities[g.groupId] ?? { headId: '', values: {} }}
              onChange={(patch) => setIdentity(g.groupId, patch)}
            />
          ))}

        {!identityInline && req.identities.length > 0 && (
          <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            {req.identities.map((g) => {
              const complete = identityComplete(g, identities[g.groupId]);
              return (
                <Chip
                  key={g.groupId}
                  size="small"
                  color={complete ? 'success' : 'warning'}
                  variant="outlined"
                  label={`ویژگی «${g.title}»: ${complete ? 'تکمیل شده' : 'ناقص'}`}
                />
              );
            })}
            <Button size="small" startIcon={<TuneOutlinedIcon />} disabled={!loaded} onClick={() => setIdentityOpen(true)}>
              اطلاعات ویژگی
            </Button>
            <VoucherIdentityDialog
              open={identityOpen}
              groups={req.identities}
              year={year}
              value={identities}
              onClose={() => setIdentityOpen(false)}
              onSave={(next) => {
                setValue(`${p}.identities`, { ...identities, ...next }, dirty);
                setIdentityOpen(false);
              }}
            />
          </Stack>
        )}

        {showReceipt && (
          <Grid container spacing={1.5}>
            <Grid size={12}>
              <Typography variant="caption" color="text.secondary">
                واریز به حساب بانکی: شماره و تاریخ الزامی است و شماره نباید تکراری باشد.
              </Typography>
            </Grid>
            {/* فیش یا حواله با دکمه‌های رادیویی «مدرک بانکی» همین ردیف انتخاب می‌شود (VoucherLineCheque). */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label={receiptKind === '2' ? 'شمارهٔ حواله' : 'شمارهٔ فیش'} required size="small" fullWidth disabled={!loaded} value={receiptNo}
                onChange={(e) => setValue(`${p}.receiptNo`, e.target.value, dirty)}
                error={!!lineErrors?.receiptNo} helperText={lineErrors?.receiptNo?.message}
                slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 8, dir: 'ltr' } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <JalaliDateField label={receiptKind === '2' ? 'تاریخ حواله' : 'تاریخ فیش'} size="small" fullWidth disabled={!loaded}
                required value={receiptDate}
                onChange={(v) => setValue(`${p}.receiptDate`, v, dirty)} />
            </Grid>
          </Grid>
        )}

        {bankCredit && !checkId && !soriCheckBookId && (
          <Typography variant="caption" color="text.secondary">
            برداشت از حساب بانکی: «چک» یا «اعلامیه صوری» را انتخاب کنید (الزامی).
          </Typography>
        )}

        {summaryError && <Alert severity="error" sx={{ py: 0 }}>{summaryError}</Alert>}
      </Stack>
    </Grid>
  );
}
