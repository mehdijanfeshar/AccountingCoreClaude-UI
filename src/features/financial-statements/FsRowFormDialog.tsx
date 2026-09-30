import { useMutation } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch, type Control } from 'react-hook-form';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import PlaylistAddOutlinedIcon from '@mui/icons-material/PlaylistAddOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { FormDialog } from '../../components/FormDialog';
import { FormSectionLabel } from '../../components/FormSectionLabel';
import { ErrorBanner } from '../../components/ErrorBanner';
import {
  FS_BORDER_OPTIONS,
  FS_NORMAL_BALANCE_OPTIONS,
  FS_ROW_TYPE,
  FS_ROW_TYPE_OPTIONS,
  FS_VALUE_TYPE_OPTIONS,
  type FsTemplateRowDto,
} from '../../types/fsTemplate';
import { fsTemplateVersionsApi } from './api';
import { buildRowFormValues, rowFormSchema, toRowInput, type RowFormValues } from './schema';

interface Props {
  versionId: string;
  row: FsTemplateRowDto | null;
  headerRows: FsTemplateRowDto[];
  suggestedCode: string;
  onClose: () => void;
  onSaved: () => void;
}

const SELECTOR_HELP = 'مثال: 3040* 3060* — یا 1301..1309 !1305 — [D]/[C] پس از هر جزء: فقط مانده بدهکار/بستانکار';
const FORMULA_HELP = 'مثال: SUM(A01:A07) — A99 + L99 — -STMT(PENSION.CHANGES_IN_NET_ASSETS, X99) — ABS، ROUND، IF، PRIOR';

function SelectField({
  control,
  name,
  label,
  options,
  nullable,
  error,
}: {
  control: Control<RowFormValues>;
  name: 'rowType' | 'normalBalance' | 'valueType' | 'indent' | 'topBorder' | 'bottomBorder';
  label: string;
  options: readonly { value: number; label: string }[];
  nullable?: boolean;
  error?: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <TextField
          select
          fullWidth
          label={label}
          value={field.value ?? ''}
          onChange={(e) => field.onChange(e.target.value === '' && nullable ? null : Number(e.target.value))}
          error={!!error}
          helperText={error}
        >
          {options.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
      )}
    />
  );
}

function CheckField({ control, name, label }: { control: Control<RowFormValues>; name: 'bold' | 'hideIfZero' | 'innerColumn' | 'isDrillable' | 'allowManualAdjust'; label: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <FormControlLabel control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />} label={label} />
      )}
    />
  );
}

/** افزودن/ویرایش یک ردیف نسخهٔ پیش‌نویس. فیلدهای انتخاب‌گر/فرمول فقط برای نوع مربوطشان نمایش داده می‌شوند. */
export function FsRowFormDialog({ versionId, row, headerRows, suggestedCode, onClose, onSaved }: Props) {
  const isEdit = row !== null;

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RowFormValues>({
    resolver: zodResolver(rowFormSchema),
    defaultValues: buildRowFormValues(row, suggestedCode),
  });

  const rowType = useWatch({ control, name: 'rowType' });
  const hasValue = rowType === FS_ROW_TYPE.Account || rowType === FS_ROW_TYPE.Formula || rowType === FS_ROW_TYPE.External;

  const mutation = useMutation({
    mutationFn: async (v: RowFormValues): Promise<void> => {
      const input = toRowInput(v, null);
      if (isEdit) {
        await fsTemplateVersionsApi.updateRow(versionId, row.id, input);
      } else {
        await fsTemplateVersionsApi.addRow(versionId, input);
      }
    },
    onSuccess: () => onSaved(),
  });

  const parentOptions = headerRows.filter((h) => h.id !== row?.id);

  return (
    <FormDialog
      open
      onClose={onClose}
      icon={<PlaylistAddOutlinedIcon />}
      title={isEdit ? `ویرایش ردیف ${row.code}` : 'ردیف جدید'}
      subtitle="نحو انتخاب‌گر و فرمول هنگام ذخیره بررسی می‌شود؛ ارجاع به ردیف‌های دیگر در «بررسی قالب»."
      maxWidth="md"
      onSubmit={handleSubmit((v) => mutation.mutate(v))}
      actions={
        <>
          <Button variant="text" onClick={onClose} disabled={mutation.isPending}>
            انصراف
          </Button>
          <Button type="submit" variant="contained" startIcon={<SaveOutlinedIcon />} disabled={mutation.isPending}>
            {mutation.isPending ? 'در حال ذخیره...' : 'ذخیره'}
          </Button>
        </>
      }
    >
      {mutation.isError && <ErrorBanner error={mutation.error} />}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField
            {...register('code')}
            label="کد ردیف"
            fullWidth
            required
            slotProps={{ htmlInput: { dir: 'ltr', maxLength: 20 } }}
            error={!!errors.code}
            helperText={errors.code?.message}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <SelectField control={control} name="rowType" label="نوع ردیف" options={FS_ROW_TYPE_OPTIONS} error={errors.rowType?.message} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Controller
            control={control}
            name="parentCode"
            render={({ field }) => (
              <TextField select fullWidth label="زیرمجموعهٔ عنوان" value={field.value} onChange={field.onChange} error={!!errors.parentCode} helperText={errors.parentCode?.message}>
                <MenuItem value="">— بدون والد —</MenuItem>
                {parentOptions.map((h) => (
                  <MenuItem key={h.id} value={h.code}>
                    {h.code} — {h.titleFa}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 2 }}>
          <TextField {...register('noteRef')} label="یادداشت" fullWidth error={!!errors.noteRef} helperText={errors.noteRef?.message} />
        </Grid>
        <Grid size={{ xs: 12, sm: 7 }}>
          <TextField {...register('titleFa')} label="عنوان فارسی" fullWidth error={!!errors.titleFa} helperText={errors.titleFa?.message} />
        </Grid>
        <Grid size={{ xs: 12, sm: 5 }}>
          <TextField {...register('titleEn')} label="عنوان انگلیسی" fullWidth slotProps={{ htmlInput: { dir: 'ltr' } }} />
        </Grid>

        {hasValue && (
          <>
            <Grid size={12}>
              <FormSectionLabel label="مقدار" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <SelectField control={control} name="normalBalance" label="ماهیت" options={FS_NORMAL_BALANCE_OPTIONS} nullable error={errors.normalBalance?.message} />
            </Grid>
            {rowType === FS_ROW_TYPE.Account && (
              <>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <SelectField control={control} name="valueType" label="نوع مقدار" options={FS_VALUE_TYPE_OPTIONS} nullable error={errors.valueType?.message} />
                </Grid>
                <Grid size={12}>
                  <TextField
                    {...register('selector')}
                    label="انتخاب‌گر حساب (کد معین)"
                    fullWidth
                    slotProps={{ htmlInput: { dir: 'ltr', style: { fontFamily: 'monospace' } } }}
                    error={!!errors.selector}
                    helperText={errors.selector?.message ?? SELECTOR_HELP}
                  />
                </Grid>
              </>
            )}
            {rowType === FS_ROW_TYPE.Formula && (
              <Grid size={12}>
                <TextField
                  {...register('formula')}
                  label="فرمول"
                  fullWidth
                  slotProps={{ htmlInput: { dir: 'ltr', style: { fontFamily: 'monospace' } } }}
                  error={!!errors.formula}
                  helperText={errors.formula?.message ?? FORMULA_HELP}
                />
              </Grid>
            )}
          </>
        )}

        <Grid size={12}>
          <FormSectionLabel label="نمایش" />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <SelectField control={control} name="indent" label="تورفتگی" options={[0, 1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <SelectField control={control} name="topBorder" label="خط بالای مقدار" options={FS_BORDER_OPTIONS} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <SelectField control={control} name="bottomBorder" label="خط زیر مقدار" options={FS_BORDER_OPTIONS} />
        </Grid>
        <Grid size={12}>
          <CheckField control={control} name="bold" label="پررنگ" />
          <CheckField control={control} name="innerColumn" label="در ستون داخلی (اقلام)" />
          <CheckField control={control} name="hideIfZero" label="اگر صفر بود پنهان شود" />
          <CheckField control={control} name="isDrillable" label="قابل ریزشدن تا سند" />
          <CheckField control={control} name="allowManualAdjust" label="تعدیل دستی مجاز" />
        </Grid>
      </Grid>
    </FormDialog>
  );
}
