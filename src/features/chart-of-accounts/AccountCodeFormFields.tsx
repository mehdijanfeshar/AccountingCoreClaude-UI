import { Controller, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import InputAdornment from '@mui/material/InputAdornment';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import DriveFileRenameOutlineOutlinedIcon from '@mui/icons-material/DriveFileRenameOutlineOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import { FormSectionLabel } from '../../components/FormSectionLabel';
import { FormAdvancedSection } from '../../components/FormAdvancedSection';
import { LinkedEntityPickerField } from '../../components/LinkedEntityPickerField';
import { toLatinDigits } from '../../lib/format/numbers';
import {
  TYPE_ACC_CODE_OPTIONS,
  TYPE_ACTION_OPTIONS,
  TYPE_ACTIVITY_OPTIONS,
  TYPE_CODE_OPTIONS,
} from './accountCodeEnums';
import type { AccountCodeFormValues } from './schema';

/** `''` is the Select's own "not selected" sentinel for a `number | null` RHF field. */
const UNSET = '';

function toEnumFieldValue(raw: string): number | null {
  return raw === UNSET ? null : Number(raw);
}

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
          slotProps={{
            htmlInput: { maxLength: 6 },
            input: { startAdornment: <InputAdornment position="start"><TagOutlinedIcon fontSize="small" color="action" /></InputAdornment> },
          }}
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
          slotProps={{
            htmlInput: { maxLength: 200 },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <DriveFileRenameOutlineOutlinedIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            },
          }}
          error={!!errors.accCodeName}
          helperText={errors.accCodeName?.message}
        />
      </Grid>

      {showParentPicker && (
        <LinkedEntityPickerField
          icon={<AccountTreeOutlinedIcon fontSize="small" color="action" />}
          label={parentFieldLabel}
          value={parentLabel}
          placeholder="بدون حساب والد"
          onPick={onPickParent}
          onClear={onClearParent}
        />
      )}

      <Grid size={12}>
        <FormAdvancedSection
          label="ویژگی‌های تکمیلی (اختیاری)"
          caption="این چهار فیلد اختیاری‌اند — گزینهٔ «انتخاب نشده» مقدار را روی نامشخص (null) نگه می‌دارد."
        >
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
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="سطح کد حساب"
                    helperText={errors.typeCode?.message ?? 'typeCode'}
                    error={!!errors.typeCode}
                    value={field.value ?? UNSET}
                    onChange={(e) => field.onChange(toEnumFieldValue(e.target.value))}
                  >
                    <MenuItem value={UNSET}>انتخاب نشده</MenuItem>
                    {TYPE_CODE_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <Controller
                control={control}
                name="typeActivity"
                render={({ field }) => (
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="ماهیت حساب"
                    helperText={errors.typeActivity?.message ?? 'typeActivity'}
                    error={!!errors.typeActivity}
                    value={field.value ?? UNSET}
                    onChange={(e) => field.onChange(toEnumFieldValue(e.target.value))}
                  >
                    <MenuItem value={UNSET}>انتخاب نشده</MenuItem>
                    {TYPE_ACTIVITY_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <Controller
                control={control}
                name="typeAccCode"
                render={({ field }) => (
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="نوع حساب (موقت/دائم)"
                    helperText={errors.typeAccCode?.message ?? 'typeAccCode'}
                    error={!!errors.typeAccCode}
                    value={field.value ?? UNSET}
                    onChange={(e) => field.onChange(toEnumFieldValue(e.target.value))}
                  >
                    <MenuItem value={UNSET}>انتخاب نشده</MenuItem>
                    {TYPE_ACC_CODE_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <Controller
                control={control}
                name="typeAction"
                render={({ field }) => (
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="کنترل خلاف ماهیت"
                    helperText={errors.typeAction?.message ?? 'typeAction'}
                    error={!!errors.typeAction}
                    value={field.value ?? UNSET}
                    onChange={(e) => field.onChange(toEnumFieldValue(e.target.value))}
                  >
                    <MenuItem value={UNSET}>انتخاب نشده</MenuItem>
                    {TYPE_ACTION_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>
          </Grid>
        </FormAdvancedSection>
      </Grid>
    </Grid>
  );
}
