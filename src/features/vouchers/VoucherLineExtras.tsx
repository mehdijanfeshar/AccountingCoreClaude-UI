import { useEffect } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { JalaliDateField } from '../../components/JalaliDateField';
import { toPersianDigits } from '../../lib/format/numbers';
import {
  IDENTITY_TYPE_LABEL,
  attributeHint,
  canHaveReceipt,
  isDateAttribute,
  lineExtrasApi,
  savedToForm,
  type IdentityRequirement,
} from './lineExtras';
import type { VoucherEntryFormSchema } from './voucherEntrySchema';

interface Props {
  form: UseFormReturn<VoucherEntryFormSchema>;
  index: number;
}

/**
 * شناسه، ویژگی و فیش یک ردیف سند — فقط وقتی معین/تفصیلی ردیف آن را بخواهد نمایش داده می‌شود:
 * <ul>
 * <li>حساب شناسه‌دار: یک فیلد برای هر شناسه، با نوع و طول همان تعریف («تعریف حساب‌های شناسه‌دار»).</li>
 * <li>ویژگی: انتخاب شناسنامه (فیلدهای ثابتش نشان داده می‌شود) و ورود فیلدهای متغیر.</li>
 * <li>حساب بانکی بدهکار (واریز): فیش/حواله. برای ردیف بستانکار بانک، برگ چک از بخش چک همین ردیف.</li>
 * </ul>
 */
export function VoucherLineExtras({ form, index }: Props) {
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

        {req.identities.map((g) => (
          <IdentityBlock
            key={g.groupId}
            group={g}
            year={year}
            disabled={!loaded}
            value={identities[g.groupId] ?? { headId: '', values: {} }}
            onChange={(patch) => setIdentity(g.groupId, patch)}
          />
        ))}

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

function IdentityBlock({
  group, year, value, disabled, onChange,
}: {
  group: IdentityRequirement;
  year: string;
  value: { headId: string; values: Record<string, string> };
  disabled: boolean;
  onChange: (patch: Partial<{ headId: string; values: Record<string, string> }>) => void;
}) {
  const heads = useQuery({
    queryKey: ['identity-heads', group.groupId, year],
    queryFn: () => lineExtrasApi.heads(group.groupId, year),
    staleTime: 60_000,
  });

  // تنها شناسنامهٔ این ویژگی ⇒ خودکار انتخاب.
  useEffect(() => {
    if (!value.headId && heads.data?.length === 1) onChange({ headId: heads.data[0].headId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heads.data, value.headId]);

  const variable = group.fields.filter((f) => f.kind === 2);
  const chosen = heads.data?.find((h) => h.headId === value.headId);

  function headLabel(h: { serial: number; fixedValues: { title: string; value: string | null }[] }) {
    const fixed = h.fixedValues.filter((f) => f.value).map((f) => `${f.title}: ${f.value}`).join(' — ');
    return toPersianDigits(`شناسنامه ${h.serial}${fixed ? ` — ${fixed}` : ''}`);
  }

  return (
    <Grid container spacing={1.5}>
      <Grid size={12}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>ویژگی «{group.title}»</Typography>
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField select label="شناسنامه" required size="small" fullWidth disabled={disabled || heads.isLoading}
          value={heads.data?.some((h) => h.headId === value.headId) ? value.headId : ''}
          onChange={(e) => onChange({ headId: e.target.value })}
          helperText={heads.data && heads.data.length === 0 ? 'برای این ویژگی در سال جاری شناسنامه‌ای تعریف نشده است.' : undefined}
          error={!!heads.data && heads.data.length === 0}>
          {(heads.data ?? []).map((h) => (
            <MenuItem key={h.headId} value={h.headId}>{headLabel(h)}</MenuItem>
          ))}
        </TextField>
      </Grid>
      {chosen && chosen.fixedValues.length > 0 && (
        <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            مقادیر ثابت: {toPersianDigits(chosen.fixedValues.map((f) => `${f.title}: ${f.value ?? '—'}`).join('، '))}
          </Typography>
        </Grid>
      )}
      {variable.map((f) => {
        const v = value.values[f.subGroupId] ?? '';
        const set = (next: string) => onChange({ values: { ...value.values, [f.subGroupId]: next } });
        const hint = [f.type ? IDENTITY_TYPE_LABEL[f.type] : null, f.length > 0 ? `حداکثر ${f.length} کاراکتر` : null]
          .filter(Boolean).join('، ');
        return (
          <Grid key={f.subGroupId} size={{ xs: 12, sm: 4 }}>
            {f.type === 1 ? (
              <JalaliDateField label={f.title} required size="small" fullWidth disabled={disabled} value={v} onChange={set} />
            ) : (
              <TextField label={f.title} required size="small" fullWidth disabled={disabled} value={v}
                onChange={(e) => set(e.target.value)} helperText={hint || undefined}
                slotProps={{ htmlInput: { maxLength: f.length > 0 ? f.length : undefined, dir: f.type === 4 || f.type === 3 ? 'ltr' : undefined } }} />
            )}
          </Grid>
        );
      })}
    </Grid>
  );
}
