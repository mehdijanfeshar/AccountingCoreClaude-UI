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
 * ⚠️⚠️ Known temporary shape (CLAUDE.md open risk #2): `typeCode` / `typeActivity` /
 * `typeAccCode` / `typeAction` are REAL multi-valued enums in the Legacy schema, but a
 * known backend bug currently types them `bool|null` on the wire. Do NOT invent enum
 * options here — this three-state (بله / خیر / تعیین‌نشده) toggle is the only UI that
 * matches what the backend can actually accept today. When risk #2 is fixed server-side,
 * this component must be replaced with a real enum dropdown driven by the corrected
 * contract, not patched in place.
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
