import FormLabel from '@mui/material/FormLabel';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import FormHelperText from '@mui/material/FormHelperText';

/** Form-level representation of a nullable boolean: '' means "not set" (null on the wire). */
export type TriStateValue = 'true' | 'false' | '';

interface TriStateToggleProps {
  label: string;
  value: TriStateValue;
  onChange: (value: TriStateValue) => void;
  helperText?: string;
}

/**
 * Generic nullable-boolean (بله/خیر/تعیین‌نشده) toggle for genuinely two-state Legacy flag
 * columns typed `bool|null` on the wire.
 *
 * ⚠️ NOT for `TB_ACCOUNTCODE.typeCode` / `typeActivity` / `typeAccCode` / `typeAction` — those
 * four were REAL multi-valued enums that phase 25/26 fixed server-side (now nullable integers,
 * see `features/chart-of-accounts/accountCodeEnums.ts`); `chart-of-accounts` no longer uses
 * this component for them. Before reusing this toggle for any other column, confirm the field
 * really is boolean and not another instance of the same `bool?`-instead-of-enum bug (open
 * risk #2 in CLAUDE.md covered only these four; other columns have not all been audited).
 */
export function TriStateToggle({ label, value, onChange, helperText }: TriStateToggleProps) {
  return (
    <Stack spacing={0.5}>
      <FormLabel component="legend">{label}</FormLabel>
      <ToggleButtonGroup
        exclusive
        size="small"
        color="primary"
        value={value}
        onChange={(_event, next: TriStateValue | null) => {
          if (next !== null) onChange(next);
        }}
        aria-label={label}
      >
        <ToggleButton value="true">بله</ToggleButton>
        <ToggleButton value="false">خیر</ToggleButton>
        <ToggleButton value="">تعیین‌نشده</ToggleButton>
      </ToggleButtonGroup>
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
    </Stack>
  );
}

export function triStateToBoolean(value: TriStateValue): boolean | null {
  if (value === '') return null;
  return value === 'true';
}

export function booleanToTriState(value: boolean | null | undefined): TriStateValue {
  if (value === null || value === undefined) return '';
  return value ? 'true' : 'false';
}
