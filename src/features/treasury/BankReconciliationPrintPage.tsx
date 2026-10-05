import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { ErrorBanner } from '../../components/ErrorBanner';
import { FormLoadingSkeleton } from '../../components/FormLoadingSkeleton';
import { useSession } from '../../lib/session/SessionContext';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { formatThousands, toPersianDigits } from '../../lib/format/numbers';
import { bankStatementsApi } from './api';
import { bankAccountsApi } from '../bank-accounts/api';
import type { BankStatementBookLineDto, BankStatementLineDto } from '../../types/treasury';

const UNMATCHED = 1;
const RESOLVED = 4;
const IGNORED = 3;

function money(value: number): string {
  const text = toPersianDigits(formatThousands(Math.abs(value)));
  return value < 0 ? `(${text})` : text;
}

interface Item {
  key: string;
  date: string;
  reference: string | null;
  description: string | null;
  amount: number;
}

/**
 * صورت مغایرت بانکی (چاپی) — از مانده طبق دفتر به مانده طبق بانک:
 * دفتر + واریزهای بانک ثبت‌نشده در دفتر − برداشت‌های بانک ثبت‌نشده در دفتر − واریزهای دفتر نرسیده به
 * بانک + چک‌ها/پرداخت‌های دفتر وصول‌نشده = مانده تعدیل‌شده؛ اختلاف با مانده طبق بانک باید صفر باشد.
 * ردیف بانکی «رفع‌شده» (سند کارمزد یا اتصال به دریافت) توضیح داده شده است، جز «نادیده‌گرفته» که قلم باز می‌ماند.
 */
export function BankReconciliationPrintPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { unitLabel } = useSession();

  const statementQuery = useQuery({
    queryKey: ['treasury-bank-statements', id],
    queryFn: () => bankStatementsApi.getById(id as string),
    enabled: Boolean(id),
  });
  const statement = statementQuery.data;
  const bankAccountQuery = useQuery({
    queryKey: ['bank-accounts', statement?.bankAccountId],
    queryFn: () => bankAccountsApi.getById(statement!.bankAccountId),
    enabled: Boolean(statement?.bankAccountId),
  });

  if (statementQuery.isLoading) return <FormLoadingSkeleton />;
  if (statementQuery.isError || !statement) return <ErrorBanner error={statementQuery.error} />;

  const bankOpen = (l: BankStatementLineDto) =>
    l.matchState === UNMATCHED || (l.matchState === RESOLVED && l.resolutionType === IGNORED);
  const fromLine = (l: BankStatementLineDto, amount: number): Item => ({
    key: l.id,
    date: l.lineDate,
    reference: l.bankReference,
    description: l.description ?? l.resolutionNote,
    amount,
  });
  const fromBook = (b: BankStatementBookLineDto, amount: number): Item => ({
    key: b.voucherDetailId,
    date: b.voucherDate,
    reference: b.voucherNumber ? `سند ${b.voucherNumber}` : null,
    description: b.description,
    amount,
  });

  const bankDeposits = statement.lines.filter((l) => bankOpen(l) && l.deposit > 0).map((l) => fromLine(l, l.deposit));
  const bankWithdrawals = statement.lines.filter((l) => bankOpen(l) && l.withdrawal > 0).map((l) => fromLine(l, l.withdrawal));
  const bookDeposits = statement.bookOnly.filter((b) => b.debit > 0).map((b) => fromBook(b, b.debit));
  const bookPayments = statement.bookOnly.filter((b) => b.credit > 0).map((b) => fromBook(b, b.credit));

  const sum = (items: Item[]) => items.reduce((s, i) => s + i.amount, 0);
  const book = statement.summary.bookBalance;
  const bank = statement.closingBalance;
  const adjusted = book + sum(bankDeposits) - sum(bankWithdrawals) - sum(bookDeposits) + sum(bookPayments);
  const unexplained = bank - adjusted;
  const account = bankAccountQuery.data;

  const sections: { title: string; sign: '+' | '−'; items: Item[] }[] = [
    { title: 'واریزهای بانک که در دفتر ثبت نشده', sign: '+', items: bankDeposits },
    { title: 'برداشت‌ها و کارمزدهای بانک که در دفتر ثبت نشده', sign: '−', items: bankWithdrawals },
    { title: 'واریزهای ثبت‌شده در دفتر که به بانک نرسیده', sign: '−', items: bookDeposits },
    { title: 'چک‌ها و پرداخت‌های دفتر که هنوز از بانک وصول نشده', sign: '+', items: bookPayments },
  ];

  return (
    <Box sx={{ '@media print': { '& .no-print': { display: 'none' } } }}>
      <Stack direction="row" spacing={1} className="no-print" sx={{ mb: 2 }}>
        <Button variant="contained" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()}>
          چاپ / PDF
        </Button>
        <Button startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate(`/treasury/khazaneh/bank-reconciliation/${id}`)}>
          بازگشت به صورت‌حساب
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 4, maxWidth: 900, mx: 'auto', '@media print': { border: 0, p: 0, maxWidth: 'none' } }}>
        <Stack sx={{ textAlign: 'center', mb: 3 }} spacing={0.5}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>صورت مغایرت بانکی</Typography>
          <Typography variant="body2">{unitLabel}</Typography>
          <Typography variant="body2">
            حساب {toPersianDigits(account?.accountNumber ?? '—')} {account?.accountHolder ? `— ${account.accountHolder}` : ''}
          </Typography>
          <Typography variant="body2">
            صورت‌حساب {toPersianDigits(statement.code)} · از {formatLegacyJalaliDate(statement.fromDate)} تا{' '}
            {formatLegacyJalaliDate(statement.toDate)}
          </Typography>
        </Stack>

        <Table size="small" sx={{ '& td, & th': { borderColor: 'divider' } }}>
          <TableBody>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>مانده طبق دفتر در {formatLegacyJalaliDate(statement.toDate)}</TableCell>
              <TableCell align="left" sx={{ fontWeight: 700, width: 180 }}>{money(book)}</TableCell>
            </TableRow>
            {sections.map((s) => (
              <TableRow key={s.title}>
                <TableCell>{s.sign} {s.title} ({toPersianDigits(s.items.length)} قلم)</TableCell>
                <TableCell align="left">{money(sum(s.items))}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>مانده تعدیل‌شده</TableCell>
              <TableCell align="left" sx={{ fontWeight: 700 }}>{money(adjusted)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>مانده طبق صورت‌حساب بانک</TableCell>
              <TableCell align="left" sx={{ fontWeight: 700 }}>{money(bank)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 800 }}>اختلاف توضیح‌داده‌نشده</TableCell>
              <TableCell align="left" sx={{ fontWeight: 800, color: unexplained === 0 ? 'success.main' : 'error.main' }}>
                {money(unexplained)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        {unexplained !== 0 && (
          <Alert severity="warning" sx={{ mt: 2 }} className="no-print">
            مانده‌ها پس از تعدیل برابر نیستند. ردیف‌های تطبیق‌نخورده را بررسی کنید یا تطبیق خودکار را دوباره اجرا کنید.
          </Alert>
        )}

        {sections.filter((s) => s.items.length > 0).map((s) => (
          <Box key={s.title} sx={{ mt: 3, breakInside: 'avoid' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              {s.sign} {s.title}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 110 }}>تاریخ</TableCell>
                  <TableCell sx={{ width: 140 }}>شماره / مرجع</TableCell>
                  <TableCell>شرح</TableCell>
                  <TableCell align="left" sx={{ width: 160 }}>مبلغ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {s.items.map((i) => (
                  <TableRow key={i.key}>
                    <TableCell>{formatLegacyJalaliDate(i.date)}</TableCell>
                    <TableCell>{toPersianDigits(i.reference ?? '—')}</TableCell>
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
