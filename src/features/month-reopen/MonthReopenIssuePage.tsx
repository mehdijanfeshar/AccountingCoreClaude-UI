import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import Autocomplete from '@mui/material/Autocomplete';
import { useSession } from '../../lib/session/SessionContext';
import { toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import { MONTH_NAMES, monthReopenApi, type IssueMonthReopenResult } from './api';
import { MonthReopenLogTable } from './MonthReopenLogTable';

/**
 * صدور رمز برگشت صورتحساب (فقط مدیر ستاد در واحد ستاد مرکزی). رمز ۸ رقمی برای (واحد، سال، ماه) ساخته
 * می‌شود و به واحد داده می‌شود تا در صفحهٔ «برگشت صورتحساب ماه» وارد کند. رمز یک‌بار مصرف است؛ تا
 * مصرف نشده، صدور دوباره همان رمز را نشان می‌دهد.
 */
export function MonthReopenIssuePage() {
  const queryClient = useQueryClient();
  const { financialYear } = useSession();
  const [year, setYear] = useState(financialYear || '');
  const [month, setMonth] = useState<number | ''>('');
  const [unit, setUnit] = useState<{ vahedCode: string; vahedName: string } | null>(null);
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<IssueMonthReopenResult | null>(null);

  const yearValid = /^1[34]\d{2}$/.test(year);
  const accessQuery = useQuery({ queryKey: ['month-reopen-access'], queryFn: monthReopenApi.access });
  const unitsQuery = useQuery({
    queryKey: ['month-reopen-units'],
    queryFn: monthReopenApi.units,
    enabled: !!accessQuery.data?.canIssue,
    staleTime: 10 * 60_000,
  });
  const logQuery = useQuery({
    queryKey: ['month-reopen-log', year],
    queryFn: () => monthReopenApi.log(year),
    enabled: yearValid && !!accessQuery.data?.canIssue,
  });

  const issue = useMutation({
    mutationFn: () => monthReopenApi.issue(unit!.vahedCode, year, month as number, reason.trim() || null),
    onSuccess: async (r) => {
      setResult(r);
      await queryClient.invalidateQueries({ queryKey: ['month-reopen-log'] });
    },
  });

  if (accessQuery.data && !accessQuery.data.canIssue) {
    return (
      <Stack spacing={2}>
        <PageHeader eyebrow="عملیات" icon={<KeyOutlinedIcon />} title="صدور رمز برگشت صورتحساب" />
        <Alert severity="warning">این صفحه فقط برای مدیر ستاد در واحد ستاد مرکزی است.</Alert>
      </Stack>
    );
  }

  const canSubmit = !!unit && yearValid && month !== '' && !issue.isPending;

  return (
    <Stack spacing={2}>
      <PageHeader
        eyebrow="عملیات"
        icon={<KeyOutlinedIcon />}
        title="صدور رمز برگشت صورتحساب"
        description="رمز ۸ رقمی برای برگرداندن اسناد «تأیید دائم» یک ماه از یک واحد به «بررسی‌شده». رمز را به واحد بدهید."
      />

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'flex-start' } }}>
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
              // کد واحد (فارسی یا لاتین) یا بخشی از نام؛ «ی/ک» عربی و فارسی یکسان.
              const norm = (s: string) => toLatinDigits(s).replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim().toLowerCase();
              const q = norm(inputValue);
              const list = q ? options.filter((u) => u.vahedCode.includes(q) || norm(u.vahedName).includes(q)) : options;
              return list.slice(0, 100);
            }}
            noOptionsText="واحدی پیدا نشد"
            renderInput={(params) => <TextField {...params} label="واحد (کد یا نام)" />}
          />
          <TextField
            size="small"
            label="سال مالی"
            value={toPersianDigits(year)}
            onChange={(e) => setYear(toLatinDigits(e.target.value).slice(0, 4))}
            error={year !== '' && !yearValid}
            sx={{ width: 120 }}
          />
          <TextField
            select
            size="small"
            label="ماه"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            sx={{ width: 140 }}
          >
            {MONTH_NAMES.map((name, i) => (
              <MenuItem key={name} value={i + 1}>
                {name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="علت (اختیاری)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            sx={{ flex: 1 }}
          />
          <Button variant="contained" disabled={!canSubmit} onClick={() => { setResult(null); issue.mutate(); }}>
            صدور رمز
          </Button>
        </Stack>

        {issue.error && (
          <Stack sx={{ mt: 2 }}>
            <ErrorBanner error={issue.error} />
          </Stack>
        )}

        {result && (
          <Alert severity="success" sx={{ mt: 2 }}>
            <Typography variant="body2">
              رمز برگشت صورتحساب {MONTH_NAMES[result.month - 1]} {toPersianDigits(result.year)} واحد{' '}
              {toPersianDigits(result.unitCode)} (دفعهٔ {toPersianDigits(result.seq)})
              {result.reused ? ' — رمز قبلی هنوز استفاده نشده و همان نمایش داده شد' : ''}:
            </Typography>
            <Typography variant="h5" sx={{ fontFamily: 'monospace', letterSpacing: 4, mt: 1 }} dir="ltr">
              {result.code}
            </Typography>
          </Alert>
        )}
      </Paper>

      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        سابقهٔ رمزهای سال {toPersianDigits(year)}
      </Typography>
      <MonthReopenLogTable rows={logQuery.data ?? []} isLoading={logQuery.isLoading} showUnit />
    </Stack>
  );
}
