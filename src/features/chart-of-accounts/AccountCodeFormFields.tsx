import { Controller, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import { TriStateToggle, type TriStateValue } from '../../components/TriStateToggle';
import { FormSectionLabel } from '../../components/FormSectionLabel';
import { toLatinDigits } from '../../lib/format/numbers';
import type { AccountCodeFormValues } from './schema';

interface AccountCodeFormFieldsProps {
  control: Control<AccountCodeFormValues>;
  register: UseFormRegister<AccountCodeFormValues>;
  errors: FieldErrors<AccountCodeFormValues>;
  parentLabel: string | null;
  onPickParent: () => void;
  onClearParent: () => void;
  /** `false` for گروه-level rows, which never have a parent (level = top of the tree). */
  showParentPicker?: boolean;
  parentFieldLabel?: string;
  codeLengthHint?: string;
}

/**
 * The `TB_ACCOUNTCODE` field set shared by the standalone `/base/account-codes/new`/`:id/edit`
 * route (`AccountCodeFormPage.tsx`) and the گروه/کل/معین tab dialogs (`AccountCodeLevelTab.tsx`)
 * — extracted so a level tab's "افزودن" dialog doesn't duplicate this Grid three times over.
 * Deliberately does NOT own the submit/cancel row or the picker Dialog itself — callers wire
 * those (the picker dialog differs per caller: full-page form excludes nothing, level tabs pass
 * `filterRows` to scope it to one code length).
 */
export function AccountCodeFormFields({
  control,
  register,
  errors,
  parentLabel,
  onPickParent,
  onClearParent,
  showParentPicker = true,
  parentFieldLabel = 'حساب والد (کد - عنوان)',
  codeLengthHint,
}: AccountCodeFormFieldsProps) {
  return (
    <Grid container spacing={3}>
      <Grid size={12}>
        <FormSectionLabel label="اطلاعات اصلی" />
      </Grid>

      {/*
        `accCode`/`moInforClose` are legacy coding-tree codes, not narrative text — a
        Persian-keyboard user typing them will produce Persian digit glyphs (۰-۹) in the
        raw DOM value. `setValueAs: toLatinDigits` converts them at the point RHF reads
        the field (submit time), per the hard rule in `src/lib/format/numbers.ts` (only
        Latin digits may reach the API). `accCodeName` is intentionally left untouched
        (free-text title, not a code).
      */}
      <Grid size={{ xs: 12, sm: 4 }}>
        <TextField
          {...register('accCode', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
          label="کد حساب"
          fullWidth
          required
          slotProps={{ htmlInput: { maxLength: 6 } }}
          error={!!errors.accCode}
          helperText={errors.accCode?.message ?? codeLengthHint}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 8 }}>
        <TextField
          {...register('accCodeName')}
          label="عنوان حساب"
          fullWidth
          required
          slotProps={{ htmlInput: { maxLength: 200 } }}
          error={!!errors.accCodeName}
          helperText={errors.accCodeName?.message}
        />
      </Grid>

      {showParentPicker && (
        <>
          <Grid size={{ xs: 12, sm: 8 }}>
            <TextField
              label={parentFieldLabel}
              fullWidth
              value={parentLabel ?? ''}
              placeholder="بدون حساب والد"
              slotProps={{ input: { readOnly: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button variant="outlined" onClick={onPickParent}>
              انتخاب
            </Button>
            <Button color="inherit" onClick={onClearParent}>
              پاک کردن
            </Button>
          </Grid>
        </>
      )}

      <Grid size={12}>
        <FormSectionLabel
          label="ویژگی‌های تکمیلی"
          caption="معنای دقیق این ستون‌های قدیمی هنوز در بک‌اند تأیید نشده — فعلاً به‌صورت سه‌حالته (بله/خیر/تعیین‌نشده) نمایش داده می‌شوند."
        />
      </Grid>

      <Grid size={12}>
        <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: 'action.hover' }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                {...register('moInforClose', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
                label="moInforClose"
                fullWidth
                size="small"
                slotProps={{ htmlInput: { maxLength: 6 } }}
                error={!!errors.moInforClose}
                helperText={errors.moInforClose?.message}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <Controller
                control={control}
                name="typeCode"
                render={({ field }) => (
                  <TriStateToggle
                    label="typeCode (نوع کد)"
                    value={field.value as TriStateValue}
                    onChange={field.onChange}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <Controller
                control={control}
                name="typeActivity"
                render={({ field }) => (
                  <TriStateToggle
                    label="typeActivity (نوع فعالیت)"
                    value={field.value as TriStateValue}
                    onChange={field.onChange}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <Controller
                control={control}
                name="typeAccCode"
                render={({ field }) => (
                  <TriStateToggle
                    label="typeAccCode (نوع کد حساب)"
                    value={field.value as TriStateValue}
                    onChange={field.onChange}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <Controller
                control={control}
                name="typeAction"
                render={({ field }) => (
                  <TriStateToggle
                    label="typeAction (نوع عملیات)"
                    value={field.value as TriStateValue}
                    onChange={field.onChange}
                  />
                )}
              />
            </Grid>
          </Grid>
        </Box>
      </Grid>
    </Grid>
  );
}
