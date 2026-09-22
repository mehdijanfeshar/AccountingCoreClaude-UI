import DatePicker from 'react-multi-date-picker';
import DateObject from 'react-date-object';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import type { SxProps, Theme } from '@mui/material/styles';
import { toLatinDigits } from '../lib/format/numbers';

/**
 * The one Jalali date field in the app. Stores and emits the Legacy `YYYYMMDD` string every
 * `DATE_DOC`-shaped column in this schema uses, and shows the user `YYYY/MM/DD`.
 *
 * <b>Why this exists as a shared component rather than six inline pickers.</b> It was six, and all
 * six had the same bug: a picked date was saved correctly but the field then rendered empty, so
 * there was no way to tell what you had chosen.
 *
 * The cause is that **`react-date-object` cannot parse a separator-less format**. Both shapes in
 * use — `new DateObject({ date: '14040215', format: 'YYYYMMDD' })` and handing the raw string to
 * `DatePicker` with `format="YYYYMMDD"` — produce an object whose `isValid` is `false`, and an
 * invalid DateObject formats to `''`. Verified against the installed library:
 *
 * <pre>
 *   parsed with format 'YYYYMMDD' → isValid = false, format() = ""
 *   built from {year, month, day} → isValid = true,  format() = "۱۴۰۴/۰۲/۱۵"
 * </pre>
 *
 * So the value is split into its parts by hand below. The display format stays `YYYY/MM/DD` — a
 * separator-less format is unreadable to a human anyway; it is purely the storage shape.
 */
export interface JalaliDateFieldProps {
  label: string;
  /** Legacy `YYYYMMDD` string, or empty. */
  value: string | null | undefined;
  /** Receives a Legacy `YYYYMMDD` string, or `''` when cleared. */
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  required?: boolean;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  sx?: SxProps<Theme>;
}

/**
 * Turns a stored `YYYYMMDD` string into a valid <see cref="DateObject"/>, or `undefined` when
 * there is nothing to show.
 *
 * Exported so the parsing rule is testable and so nothing re-invents the broken
 * `{ date, format }` form.
 */
export function parseLegacyJalali(value: string | null | undefined): DateObject | undefined {
  if (!value) return undefined;

  const digits = toLatinDigits(value).trim();

  // Anything that is not exactly 8 digits is not a date this schema can hold. Returning undefined
  // shows an empty field, which is honest — better than rendering a silently wrong day.
  if (!/^\d{8}$/.test(digits)) return undefined;

  const parsed = new DateObject({
    calendar: persian,
    locale: persian_fa,
    year: Number(digits.slice(0, 4)),
    month: Number(digits.slice(4, 6)),
    day: Number(digits.slice(6, 8)),
  });

  return parsed.isValid ? parsed : undefined;
}

export function JalaliDateField({
  label,
  value,
  onChange,
  disabled,
  error,
  helperText,
  required,
  size = 'medium',
  fullWidth = true,
  sx,
}: JalaliDateFieldProps) {
  return (
    <DatePicker
      calendar={persian}
      locale={persian_fa}
      format="YYYY/MM/DD"
      disabled={disabled}
      value={parseLegacyJalali(value)}
      // `persian_fa`'s digits are Persian (۰-۹), so `format()` returns Persian-digit text.
      // `toLatinDigits` is required, not optional: only Latin digits may reach the API.
      onChange={(date) => onChange(date ? toLatinDigits((date as DateObject).format('YYYYMMDD')) : '')}
      render={(shown, openCalendar) => (
        <TextField
          label={label}
          value={shown}
          onClick={disabled ? undefined : openCalendar}
          onFocus={disabled ? undefined : openCalendar}
          disabled={disabled}
          error={error}
          helperText={helperText}
          required={required}
          size={size}
          fullWidth={fullWidth}
          sx={sx}
          slotProps={{
            // Read-only, not disabled: the value must stay selectable and copyable, and typing a
            // partial date into a Jalali field produces garbage the picker then has to interpret.
            htmlInput: { readOnly: true },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <CalendarMonthOutlinedIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            },
          }}
        />
      )}
    />
  );
}
