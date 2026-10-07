import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useSession } from '../../lib/session/SessionContext';
import { toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import { MONTH_NAMES, monthReopenApi } from './api';
import { MonthReopenLogTable } from './MonthReopenLogTable';

/**
 * برگشت صورتحساب ماه (واحد جاری). با رمز ۸ رقمی که ستاد صادر کرده، همهٔ اسناد «تأیید دائم» ماه
 * انتخاب‌شده به «بررسی‌شده» برمی‌گردند تا قابل اصلاح شوند. رمز یک‌بار مصرف است و پس از ۵ ورود
 * نادرست باطل می‌شود.
 */
export function MonthReopenApplyPage() {
  const queryClient = useQueryClient();
  const { financialYear, unitCode, unitName } = useSession();
  const [month, setMonth] = useState<number | ''>('');
  const [code, setCode] = useState('');
  const [done, setDone] = useState<{ month: number; count: number } | null>(null);

  const accessQuery = useQuery({ queryKey: ['month-reopen-access'], queryFn: monthReopenApi.access });
  const logQuery = useQuery({
    queryKey: ['month-reopen-log', financialYear, unitCode],
    queryFn: () => monthReopenApi.log(financialYear),
    enabled: !!financialYear,
  });

  const apply = useMutation({
    mutationFn: () => monthReopenApi.apply(financialYear, month as number, code),
    onSuccess: async (r) => {
      setDone({ month: month as number, count: r.revertedCount });
      setCode('');
      await queryClient.invalidateQueries({ queryKey: ['month-reopen-log'] });
      await queryClient.invalidateQueries({ queryKey: ['voucher-heads'] });
    },
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: ['month-reopen-log'] });
    },
  });

  const codeValid = /^\d{8}$/.test(code);
  const canSubmit = !!financialYear && month !== '' && codeValid && !apply.isPending;

  return (
    <Stack spacing={2}>
      <PageHeader
        eyebrow="عملیات"
        icon={<LockOpenOutlinedIcon />}
        title="برگشت صورتحساب ماه"
        description="اسناد «تأیید دائم» یک ماه با رمز ستاد به «بررسی‌شده» برمی‌گردند تا قابل اصلاح شوند."
      />

      {accessQuery.data && !accessQuery.data.canApply && (
        <Alert severity="warning">برگشت صورتحساب فقط با نقش‌های مدیریتی واحد ممکن است.</Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="body2" sx={{ mb: 2 }}>
          واحد {toPersianDigits(unitCode)} — {unitName}، سال مالی {toPersianDigits(financialYear)}
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'flex-start' } }}>
          <TextField
            select
            size="small"
            label="ماه"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            sx={{ width: 160 }}
          >
            {MONTH_NAMES.map((name, i) => (
              <MenuItem key={name} value={i + 1}>
                {name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="رمز برگشت (۸ رقم)"
            value={code}
            onChange={(e) => setCode(toLatinDigits(e.target.value).replace(/\D/g, '').slice(0, 8))}
            slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric', style: { letterSpacing: 3 } } }}
            sx={{ width: 200 }}
          />
          <Button
            variant="contained"
            color="warning"
            disabled={!canSubmit}
            onClick={() => {
              setDone(null);
              apply.mutate();
            }}
          >
            برگشت صورتحساب
          </Button>
        </Stack>

        {apply.error && (
          <Stack sx={{ mt: 2 }}>
            <ErrorBanner error={apply.error} />
          </Stack>
        )}
        {done && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {toPersianDigits(done.count)} سند {MONTH_NAMES[done.month - 1]} به وضعیت «بررسی‌شده» برگشت. از کارتابل
            اسناد می‌توانید آن‌ها را به «موقت» ببرید و اصلاح کنید.
          </Alert>
        )}
      </Paper>

      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        رمزهای این واحد در سال {toPersianDigits(financialYear)}
      </Typography>
      <MonthReopenLogTable rows={logQuery.data ?? []} isLoading={logQuery.isLoading} showUnit={false} />
    </Stack>
  );
}
