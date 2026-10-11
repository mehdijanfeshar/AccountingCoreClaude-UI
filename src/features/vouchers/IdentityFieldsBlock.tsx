import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { JalaliDateField } from '../../components/JalaliDateField';
import { toPersianDigits } from '../../lib/format/numbers';
import { IDENTITY_TYPE_LABEL, identityFieldError, lineExtrasApi, type IdentityRequirement } from './lineExtras';

export interface IdentityValue {
  headId: string;
  values: Record<string, string>;
}

interface Props {
  group: IdentityRequirement;
  year: string;
  value: IdentityValue;
  disabled?: boolean;
  /** خطای «الزامی» را هم نشان بده (پس از تلاش برای ثبت). خطای قالب همیشه نشان داده می‌شود. */
  showRequired?: boolean;
  onChange: (patch: Partial<IdentityValue>) => void;
}

/**
 * فیلدهای یک ویژگی روی ردیف سند — مثل پنجرهٔ «اطلاعات ویژگی» برنامهٔ مرجع: انتخاب «ویژگی ثابت»
 * (شناسنامه؛ اگر فقط یکی باشد خودکار) و ورود فیلدهای متغیر با کنترل نوع (عدد/فارسی/لاتین/تاریخ) و طول.
 */
export function IdentityFieldsBlock({ group, year, value, disabled, showRequired, onChange }: Props) {
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
  const noHeads = !!heads.data && heads.data.length === 0;

  // سرور همهٔ اجزای ثابت گروه را می‌فرستد (مقدار ثبت‌نشده = null)، مثل «شماره اشتراک: ۱۲ / شماره بدنه: ۳۴».
  function headLabel(h: { serial: number; fixedValues: { title: string; value: string | null }[] }) {
    const fixed = h.fixedValues.map((f) => `${f.title}: ${f.value?.trim() || '—'}`).join(' / ');
    return toPersianDigits(fixed || `شناسنامه ${h.serial}`);
  }
  const chosenIncomplete = !!chosen && chosen.fixedValues.some((f) => !f.value?.trim());

  return (
    <Grid container spacing={1.5}>
      <Grid size={12}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>ویژگی «{group.title}»</Typography>
      </Grid>
      <Grid size={12}>
        <TextField select label="ویژگی ثابت" required size="small" fullWidth disabled={disabled || heads.isLoading}
          value={heads.data?.some((h) => h.headId === value.headId) ? value.headId : ''}
          onChange={(e) => onChange({ headId: e.target.value })}
          error={noHeads || (!!showRequired && !value.headId)}
          helperText={
            noHeads
              ? 'برای این ویژگی در سال جاری مقداردهی اولیه انجام نشده است.'
              : showRequired && !value.headId
                ? 'انتخاب ویژگی ثابت الزامی است.'
                : undefined
          }>
          {(heads.data ?? []).map((h) => (
            <MenuItem key={h.headId} value={h.headId}>{headLabel(h)}</MenuItem>
          ))}
        </TextField>
      </Grid>
      {chosenIncomplete && (
        <Grid size={12}>
          <Typography variant="caption" color="warning.main">
            مقادیر ثابت این مورد کامل نیست؛ از «اطلاعات پایه › ویژگی › ویژگی‌های ثبت‌شده» آن را ویرایش و تکمیل کنید.
          </Typography>
        </Grid>
      )}
      {variable.map((f) => {
        const v = value.values[f.subGroupId] ?? '';
        const set = (next: string) => onChange({ values: { ...value.values, [f.subGroupId]: next } });
        const formatError = identityFieldError(f, v);
        const requiredError = showRequired && !v.trim() ? 'این مقدار الزامی است.' : null;
        const error = formatError ?? requiredError;
        const hint = [f.type ? IDENTITY_TYPE_LABEL[f.type] : null, f.length > 0 ? `حداکثر ${f.length} کاراکتر` : null]
          .filter(Boolean).join('، ');
        return (
          <Grid key={f.subGroupId} size={{ xs: 12, sm: 6 }}>
            {f.type === 1 ? (
              <JalaliDateField label={f.title} required size="small" fullWidth disabled={disabled} value={v} onChange={set}
                error={!!error} helperText={error ?? undefined} />
            ) : (
              <TextField label={f.title} required size="small" fullWidth disabled={disabled} value={v}
                onChange={(e) => set(e.target.value)} error={!!error} helperText={error ?? (hint || undefined)}
                slotProps={{ htmlInput: { maxLength: f.length > 0 ? f.length : undefined, dir: f.type === 4 || f.type === 3 ? 'ltr' : undefined } }} />
            )}
          </Grid>
        );
      })}
    </Grid>
  );
}
