import type { ReactNode } from 'react';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';

interface LinkedEntityPickerFieldProps {
  icon: ReactNode;
  label: string;
  value: string | null | undefined;
  placeholder?: string;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  pickButtonLabel?: string;
  onPick: () => void;
  /** Omit to hide the "پاک کردن" button — used where the link is required and can't be cleared. */
  onClear?: () => void;
}

/**
 * The "read-only labeled field + انتخاب/پاک‌کردن buttons" pattern for picking a linked entity
 * (حساب معین، واحد سازمانی، ...) via one of the app's picker dialogs — every base-info form that
 * links to an `AccountCodeDto`/`VahedInfoDto` repeated this exact block by hand. Renders the two
 * Grid items (8/4 split) the callers already used, so it drops into an existing
 * `<Grid container>` without changing layout.
 */
export function LinkedEntityPickerField({
  icon,
  label,
  value,
  placeholder = 'انتخاب نشده',
  required,
  error,
  helperText,
  pickButtonLabel = 'انتخاب',
  onPick,
  onClear,
}: LinkedEntityPickerFieldProps) {
  return (
    <>
      <Grid size={{ xs: 12, sm: 8 }}>
        <TextField
          label={label}
          fullWidth
          required={required}
          value={value ?? ''}
          placeholder={placeholder}
          error={error}
          helperText={helperText}
          slotProps={{
            input: {
              readOnly: true,
              startAdornment: <InputAdornment position="start">{icon}</InputAdornment>,
            },
          }}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 4 }} sx={{ display: 'flex', alignItems: 'center' }}>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={onPick}>
            {pickButtonLabel}
          </Button>
          {onClear && (
            <Button color="inherit" onClick={onClear}>
              پاک کردن
            </Button>
          )}
        </Stack>
      </Grid>
    </>
  );
}
