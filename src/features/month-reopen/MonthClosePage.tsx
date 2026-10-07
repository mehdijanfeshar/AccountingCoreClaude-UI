import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { useSession } from '../../lib/session/SessionContext';
import { formatPersianDateTime } from '../../lib/format/dates';
import { toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import {
  MONTH_NAMES,
  UNIT_CATEGORY_OPTIONS,
  monthCloseApi,
  monthReopenApi,
  type MonthCloseLogDto,
  type MonthCloseSummaryDto,
} from './api';

type Scope = 'category' | 'unit';

/**
 * صورتحساب ماه. ستاد (مدیر ستاد در واحد ستاد مرکزی): اسناد «بررسی‌شده» یک ماه را برای یک گروه واحد یا یک
 * واحد «تأیید دائم» می‌کند؛ واحدی که سند یادداشت/موقت یا اعلامیهٔ ارسال‌نشده دارد صورتحساب نمی‌شود و دلیلش در
 * لاگ می‌آید. کاربر واحد فقط لاگ واحد خودش را می‌بیند (چرا صورتحساب نشده).
 */
export function MonthClosePage() {
  const queryClient = useQueryClient();
  const { financialYear } = useSession();
  const [year, setYear] = useState(financialYear || '');
  const [month, setMonth] = useState<number | ''>('');
  const [scope, setScope] = useState<Scope>('category');
  const [category, setCategory] = useState<number | 0>(2);
  const [unit, setUnit] = useState<{ vahedCode: string; vahedName: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [summary, setSummary] = useState<MonthCloseSummaryDto | null>(null);
  const [onlyRejected, setOnlyRejected] = useState(false);

  const yearValid = /^1[34]\d{2}$/.test(year);
  const accessQuery = useQuery({ queryKey: ['month-reopen-access'], queryFn: monthReopenApi.access });
  const isHq = !!accessQuery.data?.canIssue;
  const unitsQuery = useQuery({
    queryKey: ['month-reopen-units'],
    queryFn: monthReopenApi.units,
    enabled: isHq,
    staleTime: 10 * 60_000,
  });
  const logQuery = useQuery({
    queryKey: ['month-close-log', year, month],
    queryFn: () => monthCloseApi.log(year, month === '' ? undefined : month),
    enabled: yearValid && !!accessQuery.data,
  });

  const close = useMutation({
    mutationFn: () =>
      monthCloseApi.close({
        year,
        month: month as number,
        unitCategory: scope === 'category' && category !== 0 ? category : null,
        unitCode: scope === 'unit' ? unit!.vahedCode : null,
      }),
    onSuccess: async (s) => {
      setSummary(s);
      setConfirmOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['month-close-log'] });
      await queryClient.invalidateQueries({ queryKey: ['voucher-heads'] });
    },
  });

  const scopeLabel =
    scope === 'unit'
      ? unit
        ? `واحد ${toPersianDigits(unit.vahedCode)} — ${unit.vahedName}`
        : ''
      : category === 0
        ? 'همهٔ واحدها'
        : `همهٔ واحدهای ${UNIT_CATEGORY_OPTIONS.find((o) => o.value === category)?.label}`;
  const canSubmit = isHq && yearValid && month !== '' && (scope === 'category' || !!unit) && !close.isPending;

  const columns: DataTableColumn<MonthCloseLogDto>[] = [
    ...(isHq
      ? [{ key: 'unit', header: 'واحد', render: (r: MonthCloseLogDto) => `${toPersianDigits(r.vahedCode)} — ${r.vahedName ?? ''}` }]
      : []),
    { key: 'month', header: 'ماه', render: (r) => `${MONTH_NAMES[r.month - 1]} ${toPersianDigits(r.year)}` },
    {
      key: 'result',
      header: 'نتیجه',
      render: (r) =>
        r.result === 1 ? <Chip size="small" color="success" label="صورتحساب شد" /> : <Chip size="small" color="error" label="صورتحساب نشد" />,
    },
    { key: 'reason', header: 'شرح / دلیل', render: (r) => r.reason ?? '—' },
    { key: 'date', header: 'زمان', render: (r) => `${formatPersianDateTime(r.createdDate)} — ${r.userId}` },
  ];

  const logRows = (logQuery.data ?? []).filter((r) => !onlyRejected || r.result === 2);

  return (
    <Stack spacing={2}>
      <PageHeader
        eyebrow="عملیات"
        icon={<FactCheckOutlinedIcon />}
        title="صورتحساب ماه"
        description={
          isHq
            ? 'اسناد «بررسی‌شده» یک ماه برای یک گروه واحد یا یک واحد «تأیید دائم» می‌شوند. واحدی که سند یادداشت/موقت یا اعلامیهٔ ارسال‌نشده دارد صورتحساب نمی‌شود.'
            : 'نتیجهٔ صورتحساب ماه‌های واحد شما توسط ستاد، و دلیل صورتحساب‌نشدن.'
        }
      />

      {isHq && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' } }}>
              <TextField
                size="small"
                label="سال مالی"
                value={toPersianDigits(year)}
                onChange={(e) => setYear(toLatinDigits(e.target.value).slice(0, 4))}
                error={year !== '' && !yearValid}
                sx={{ width: 120 }}
              />
              <TextField select size="small" label="ماه" value={month} onChange={(e) => setMonth(Number(e.target.value))} sx={{ width: 140 }}>
                {MONTH_NAMES.map((name, i) => (
                  <MenuItem key={name} value={i + 1}>
                    {name}
                  </MenuItem>
                ))}
              </TextField>
              <RadioGroup row value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
                <FormControlLabel value="category" control={<Radio size="small" />} label="گروه واحد" />
                <FormControlLabel value="unit" control={<Radio size="small" />} label="یک واحد" />
              </RadioGroup>
              {scope === 'category' ? (
                <TextField select size="small" label="گروه" value={category} onChange={(e) => setCategory(Number(e.target.value))} sx={{ width: 160 }}>
                  {UNIT_CATEGORY_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                  <MenuItem value={0}>همهٔ واحدها</MenuItem>
                </TextField>
              ) : (
                <Autocomplete
                  size="small"
                  sx={{ minWidth: 320 }}
                  options={unitsQuery.data ?? []}
                  loading={unitsQuery.isLoading}
                  value={unit}
                  onChange={(_, v) => setUnit(v)}
                  getOptionLabel={(u) => `${toPersianDigits(u.vahedCode)} — ${u.vahedName}`}
                  isOptionEqualToValue={(a, b) => a.vahedCode === b.vahedCode}
                  filterOptions={(options, { inputValue }) => {
                    const norm = (s: string) => toLatinDigits(s).replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim().toLowerCase();
                    const q = norm(inputValue);
                    const list = q ? options.filter((u) => u.vahedCode.includes(q) || norm(u.vahedName).includes(q)) : options;
                    return list.slice(0, 100);
                  }}
                  noOptionsText="واحدی پیدا نشد"
                  renderInput={(params) => <TextField {...params} label="واحد (کد یا نام)" />}
                />
              )}
              <Button variant="contained" disabled={!canSubmit} onClick={() => { close.reset(); setConfirmOpen(true); }}>
                صورتحساب
              </Button>
            </Stack>

            {summary && (
              <Alert severity={summary.rejectedUnits > 0 ? 'warning' : 'success'}>
                از {toPersianDigits(summary.targetUnits)} واحد: {toPersianDigits(summary.closedUnits)} واحد صورتحساب شد (
                {toPersianDigits(summary.acceptedVouchers)} سند تأیید دائم)، {toPersianDigits(summary.rejectedUnits)} واحد صورتحساب نشد
                (دلیل در جدول پایین)، {toPersianDigits(summary.alreadyClosedUnits)} واحد از قبل صورتحساب شده بود و{' '}
                {toPersianDigits(summary.idleUnits)} واحد در این ماه سندی نداشت.
              </Alert>
            )}
          </Stack>
        </Paper>
      )}

      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          لاگ صورتحساب {month !== '' ? MONTH_NAMES[month - 1] : ''} {toPersianDigits(year)}
        </Typography>
        {!isHq && (
          <TextField select size="small" label="ماه" value={month} onChange={(e) => setMonth(e.target.value === '' ? '' : Number(e.target.value))} sx={{ width: 140 }}>
            <MenuItem value="">همهٔ ماه‌ها</MenuItem>
            {MONTH_NAMES.map((name, i) => (
              <MenuItem key={name} value={i + 1}>
                {name}
              </MenuItem>
            ))}
          </TextField>
        )}
        <FormControlLabel
          control={<Checkbox size="small" checked={onlyRejected} onChange={(e) => setOnlyRejected(e.target.checked)} />}
          label="فقط صورتحساب‌نشده‌ها"
        />
      </Stack>
      <DataTable
        columns={columns}
        rows={logRows}
        getRowKey={(r) => r.id}
        isLoading={logQuery.isLoading}
        emptyMessage="لاگی برای این دوره ثبت نشده است."
      />

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>صورتحساب {month !== '' ? MONTH_NAMES[month - 1] : ''} {toPersianDigits(year)}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            اسناد «بررسی‌شدهٔ» {scopeLabel} «تأیید دائم» می‌شوند و دیگر قابل اصلاح نیستند (مگر با رمز برگشت ستاد). ادامه می‌دهید؟
          </Typography>
          {close.error && (
            <Stack sx={{ mt: 2 }}>
              <ErrorBanner error={close.error} />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>انصراف</Button>
          <Button variant="contained" disabled={close.isPending} onClick={() => close.mutate()}>
            صورتحساب
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
