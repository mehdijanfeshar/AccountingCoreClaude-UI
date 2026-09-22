import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useSession } from '../../lib/session/SessionContext';
import { meApi } from '../../lib/api/meApi';
import { yearsApi } from '../../lib/api/yearsApi';
import { toPersianDigits } from '../../lib/format/numbers';
import type { AccessibleUnitDto, YearDto } from '../../types/session';

interface InitialSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * «تغییر سال مالی و واحد» — the port of the old Angular `InitialSettingsComponent`.
 *
 * Two differences from the original worth knowing:
 *
 * 1. The unit list comes from `GET /api/me/accessible-units`, which is scoped server-side to the
 *    caller's own subtree (or every unit for ستاد مرکزی). The old app called an endpoint that did
 *    the same scoping internally; either way the client never filters — it cannot be trusted to.
 * 2. A year has no surrogate id here: `TB_YEAR`'s primary key IS the year number, so
 *    `workingYear` is both value and label.
 */
export function InitialSettingsDialog({ open, onClose }: InitialSettingsDialogProps) {
  const { financialYear, unitCode, setFinancialYear, setUnit } = useSession();

  const [draftYear, setDraftYear] = useState<YearDto | null>(null);
  const [draftUnit, setDraftUnit] = useState<AccessibleUnitDto | null>(null);
  const [touched, setTouched] = useState(false);

  const yearsQuery = useQuery({
    queryKey: ['years'],
    queryFn: () => yearsApi.getAll(),
    enabled: open,
  });

  const unitsQuery = useQuery({
    queryKey: ['accessible-units'],
    queryFn: () => meApi.getAccessibleUnits(),
    enabled: open,
  });

  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const units = useMemo(() => unitsQuery.data ?? [], [unitsQuery.data]);

  // Seed the drafts from the current session, falling back to the server's own defaults: the year
  // flagged isCurrent, and the unit flagged isDefault (the caller's own). Same rule the old app
  // used on first load.
  useEffect(() => {
    if (!open) return;

    if (years.length > 0 && draftYear === null) {
      const fromSession = years.find((y) => String(y.workingYear) === financialYear);
      setDraftYear(fromSession ?? years.find((y) => y.isCurrent === true) ?? null);
    }

    if (units.length > 0 && draftUnit === null) {
      const fromSession = units.find((u) => u.vahedCode === unitCode);
      setDraftUnit(fromSession ?? units.find((u) => u.isDefault) ?? null);
    }
  }, [open, years, units, financialYear, unitCode, draftYear, draftUnit]);

  // Drop the drafts when the dialog closes so reopening re-seeds from the (possibly changed)
  // session rather than showing a stale selection.
  useEffect(() => {
    if (open) return;
    setDraftYear(null);
    setDraftUnit(null);
    setTouched(false);
  }, [open]);

  const isLoading = yearsQuery.isLoading || unitsQuery.isLoading;
  const loadError = yearsQuery.error ?? unitsQuery.error;
  const isValid = draftYear !== null && draftUnit !== null;

  function handleConfirm() {
    setTouched(true);
    if (!isValid) return;

    setFinancialYear(String(draftYear!.workingYear));
    setUnit({ unitCode: draftUnit!.vahedCode, unitName: draftUnit!.vahedName });
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}
      >
        تغییر سال مالی و واحد
        <IconButton onClick={onClose} size="small" aria-label="بستن">
          <CloseOutlinedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {loadError ? (
          <ErrorBanner error={loadError} />
        ) : isLoading ? (
          <Stack sx={{ alignItems: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Stack>
        ) : (
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {touched && !isValid && <Alert severity="error">اطلاعات فرم را وارد کنید</Alert>}

            <Autocomplete
              options={years}
              value={draftYear}
              onChange={(_, value) => setDraftYear(value)}
              getOptionLabel={(option) => toPersianDigits(option.workingYear)}
              isOptionEqualToValue={(a, b) => a.workingYear === b.workingYear}
              noOptionsText="سال مالی‌ای تعریف نشده است"
              renderOption={(props, option) => {
                const { key, ...rest } = props as { key?: string } & Record<string, unknown>;
                return (
                  <li key={key ?? option.workingYear} {...rest}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <span>{toPersianDigits(option.workingYear)}</span>
                      {option.isCurrent === true && (
                        <Chip size="small" color="success" label="سال جاری" />
                      )}
                    </Stack>
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="سال مالی را انتخاب کنید"
                  required
                  error={touched && draftYear === null}
                />
              )}
            />

            <Autocomplete
              options={units}
              value={draftUnit}
              onChange={(_, value) => setDraftUnit(value)}
              getOptionLabel={(option) => `${option.vahedCode} - ${option.vahedName}`}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              noOptionsText="واحدی در دسترس شما نیست"
              renderOption={(props, option) => {
                const { key, ...rest } = props as { key?: string } & Record<string, unknown>;
                return (
                  <li key={key ?? option.id} {...rest}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <span>{`${option.vahedCode} - ${option.vahedName}`}</span>
                      {option.isDefault && <Chip size="small" label="واحد شما" />}
                    </Stack>
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="واحد مورد نظر را انتخاب کنید"
                  required
                  error={touched && draftUnit === null}
                  helperText={
                    units.length > 0
                      ? `${toPersianDigits(units.length)} واحد در دسترس شما`
                      : undefined
                  }
                />
              )}
            />
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit" startIcon={<CloseOutlinedIcon />}>
          انصراف
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="success"
          startIcon={<CheckOutlinedIcon />}
          disabled={isLoading || Boolean(loadError)}
        >
          ثبت
        </Button>
      </DialogActions>
    </Dialog>
  );
}
