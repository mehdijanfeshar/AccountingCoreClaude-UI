import type { ReactNode } from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import { formatThousands, normalizeNumericInput } from '../lib/format/numbers';

interface AmountFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  required?: boolean;
  helperText?: string;
  disabled?: boolean;
  icon?: ReactNode;
}

/**
 * Money input for RHF forms. The field value stays a plain Latin-digit numeric string (safe
 * for the API — see `lib/format/numbers.ts` hard rule); the box itself displays it grouped with
 * Persian digits (`formatThousands`) so amounts read the way every accounting UI shows money.
 *
 * ⚠️ Known limitation: because the displayed string is re-derived from the raw value on every
 * keystroke, the caret can jump to the end when editing in the middle of a long number. Not a
 * masked-input implementation — acceptable for the amount fields this is used on (single edit,
 * rarely mid-string correction), flagged here rather than silently left as a mystery.
 */
export function AmountField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  required,
  helperText,
  disabled,
  icon,
}: AmountFieldProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          label={label}
          fullWidth
          required={required}
          disabled={disabled}
          inputMode="decimal"
          value={field.value ? formatThousands(String(field.value)) : ''}
          onChange={(e) => field.onChange(normalizeNumericInput(e.target.value))}
          onBlur={field.onBlur}
          inputRef={field.ref}
          error={!!fieldState.error}
          helperText={fieldState.error?.message ?? helperText}
          slotProps={icon ? { input: { startAdornment: <InputAdornment position="start">{icon}</InputAdornment> } } : undefined}
        />
      )}
    />
  );
}
