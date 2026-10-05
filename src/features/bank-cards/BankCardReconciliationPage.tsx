import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { ErrorBanner } from '../../components/ErrorBanner';
import { FormLoadingSkeleton } from '../../components/FormLoadingSkeleton';
import { useSession } from '../../lib/session/SessionContext';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { formatThousands, normalizeNumericInput, toPersianDigits } from '../../lib/format/numbers';
import { PERSIAN_MONTHS } from '../../types/fsRun';
import { bankCardsApi } from './api';

function money(value: number): string {
  const text = toPersianDigits(formatThousands(Math.abs(value)));
  return value < 0 ? `(${text})` : text;
}

interface Item {
  key: string;
  date: string | null;
  reference: string | null;
  description: string | null;
  amount: number;
}

/**
 * صورت مغایرت کارت حساب جاری تا پایان ماه:
 * دفتر + واریزهای بانک ثبت‌نشده − برداشت‌های بانک ثبت‌نشده − فیش‌های دفتر نرسیده به بانک + چک‌های وصول‌نشده
 * = مانده تعدیل‌شده؛ مانده طبق بانک در دیسکت نیست، پس اینجا وارد می‌شود.
 */
export function BankCardReconciliationPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const accountId = params.get('account') ?? '';
  const month = params.get('month') ?? '';
  const { financialYear, unitLabel } = useSession();
  const [bankInput, setBankInput] = useState('');

  const query = useQuery({
    queryKey: ['bank-card-reconciliation', accountId, financialYear, month],
    queryFn: () => bankCardsApi.reconciliation(accountId, financialYear, month),
    enabled: !!accountId && !!month && !!financialYear,
  });

  if (query.isLoading) return <FormLoadingSkeleton />;
  if (query.isError || !query.data) return <ErrorBanner error={query.error} />;
  const d = query.data;

  const bankItems = (rows: typeof d.bankOnlyDeposits, pick: 'deposit' | 'withdrawal'): Item[] =>
    rows.map((r) => ({ key: r.id, date: r.date, reference: r.number, description: 'صورت‌حساب بانک', amount: r[pick] }));
  const bookItems = (rows: typeof d.bookOnlyDeposits, pick: 'debit' | 'credit'): Item[] =>
    rows.map((b) => ({
      key: b.voucherDetailId,
      date: b.voucherDate,
      reference: `${b.number ?? ''}${b.voucherNumber ? ` · سند ${b.voucherNumber}` : ''}`,
      description: b.description,
      amount: b[pick],
    }));

  const sections: { title: string; sign: '+' | '−'; items: Item[] }[] = [
    { title: 'واریزهای بانک که در دفتر ثبت نشده', sign: '+', items: bankItems(d.bankOnlyDeposits, 'deposit') },
    { title: 'برداشت‌ها و اعلامیه‌های بدهکار بانک که در دفتر ثبت نشده', sign: '−', items: bankItems(d.bankOnlyWithdrawals, 'withdrawal') },
    { title: 'فیش‌های ثبت‌شده در دفتر که به بانک نرسیده', sign: '−', items: bookItems(d.bookOnlyDeposits, 'debit') },
    { title: 'چک‌های صادره که هنوز از بانک وصول نشده', sign: '+', items: bookItems(d.bookOnlyPayments, 'credit') },
  ];
  const sum = (items: Item[]) => items.reduce((s, i) => s + i.amount, 0);
  const adjusted = sections.reduce((acc, s) => acc + (s.sign === '+' ? sum(s.items) : -sum(s.items)), d.bookBalance);
  const bank = bankInput ? Number(bankInput) : null;
  const unexplained = bank === null ? null : bank - adjusted;

  return (
    <Box sx={{ '@media print': { '& .no-print': { display: 'none' } } }}>
      <Stack direction="row" spacing={1} className="no-print" sx={{ mb: 2, alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
        <Button variant="contained" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()}>
          چاپ / PDF
        </Button>
        <Button startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate(`/operation/bank-card?account=${accountId}&month=${month}`)}>
          بازگشت به کارت حساب
        </Button>
        <TextField
          size="small"
          label="مانده طبق صورت‌حساب بانک"
          value={bankInput ? toPersianDigits(formatThousands(bankInput)) : ''}
          onChange={(e) => setBankInput(normalizeNumericInput(e.target.value).replace(/[.]/g, ''))}
          slotProps={{ htmlInput: { dir: 'ltr' } }}
          sx={{ minWidth: 240 }}
        />
      </Stack>

      <Paper variant="outlined" sx={{ p: 4, maxWidth: 900, mx: 'auto', '@media print': { border: 0, p: 0, maxWidth: 'none' } }}>
        <Stack sx={{ textAlign: 'center', mb: 3 }} spacing={0.5}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>صورت مغایرت بانکی</Typography>
          <Typography variant="body2">{unitLabel}</Typography>
          <Typography variant="body2">
            حساب جاری {toPersianDigits(d.accountNumber)} {d.accountHolder ? `— ${d.accountHolder}` : ''}
          </Typography>
          <Typography variant="body2">
            پایان {PERSIAN_MONTHS[Number(d.month) - 1]} {toPersianDigits(d.year)} ({formatLegacyJalaliDate(d.toDate)})
          </Typography>
        </Stack>

        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>مانده طبق دفتر</TableCell>
              <TableCell align="left" sx={{ fontWeight: 700, width: 180 }}>{money(d.bookBalance)}</TableCell>
            </TableRow>
            {sections.map((s) => (
              <TableRow key={s.title}>
                <TableCell>
                  {s.sign} {s.title} ({toPersianDigits(s.items.length)} قلم)
                </TableCell>
                <TableCell align="left">{money(sum(s.items))}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>مانده تعدیل‌شده (باید برابر مانده بانک باشد)</TableCell>
              <TableCell align="left" sx={{ fontWeight: 700 }}>{money(adjusted)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>مانده طبق صورت‌حساب بانک</TableCell>
              <TableCell align="left" sx={{ fontWeight: 700 }}>{bank === null ? '—' : money(bank)}</TableCell>
            </TableRow>
            {unexplained !== null && (
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>اختلاف توضیح‌داده‌نشده</TableCell>
                <TableCell align="left" sx={{ fontWeight: 800, color: unexplained === 0 ? 'success.main' : 'error.main' }}>
                  {money(unexplained)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {sections.filter((s) => s.items.length > 0).map((s) => (
          <Box key={s.title} sx={{ mt: 3, breakInside: 'avoid' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              {s.sign} {s.title}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 110 }}>تاریخ</TableCell>
                  <TableCell sx={{ width: 180 }}>شماره</TableCell>
                  <TableCell>شرح</TableCell>
                  <TableCell align="left" sx={{ width: 160 }}>مبلغ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {s.items.map((i) => (
                  <TableRow key={i.key}>
                    <TableCell>{formatLegacyJalaliDate(i.date)}</TableCell>
                    <TableCell>{toPersianDigits(i.reference || '—')}</TableCell>
                    <TableCell>{i.description ?? '—'}</TableCell>
                    <TableCell align="left">{money(i.amount)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3} sx={{ fontWeight: 700 }}>جمع</TableCell>
                  <TableCell align="left" sx={{ fontWeight: 700 }}>{money(sum(s.items))}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Box>
        ))}

        <Stack direction="row" sx={{ mt: 6, justifyContent: 'space-around', textAlign: 'center' }}>
          <Typography variant="body2">تهیه‌کننده</Typography>
          <Typography variant="body2">رئیس حسابداری</Typography>
          <Typography variant="body2">مدیر مالی</Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
