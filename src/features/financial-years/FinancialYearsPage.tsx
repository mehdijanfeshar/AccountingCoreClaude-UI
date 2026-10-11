import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FormLoadingSkeleton } from '../../components/FormLoadingSkeleton';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { apiClient } from '../../lib/api/client';
import { yearsApi } from '../../lib/api/yearsApi';
import { toPersianDigits } from '../../lib/format/numbers';

/** `GET /api/years/creation-status`. */
interface CreationStatus {
  candidateYear: number;
  currentYear: number | null;
  canCreate: boolean;
  reason: string | null;
  bankAccounts: number;
}

/** `POST /api/years/create`. */
interface CreateResult {
  year: number;
  previousYear: number | null;
  bankAccounts: number;
  checkBooksCreated: number;
  checkBooksRestored: number;
  checkBooksExisting: number;
}

const fa = (n: number | null | undefined) => toPersianDigits(String(n ?? '—'));

/**
 * سال مالی — فقط مدیر ستاد مرکزی (`setadOnly`؛ سرور هم کنترل می‌کند). هر سال در فروردین یک بار: ردیف تازهٔ
 * سال به‌عنوان سال پیش‌فرض، سال قبل از پیش‌فرض خارج، و برای هر حساب بانکی یک دسته‌چک صوری (اعلامیهٔ صوری)
 * سال تازه. سرور شرط‌ها را می‌سنجد؛ صفحه فقط وضعیت را نشان می‌دهد و تأیید می‌گیرد.
 */
export function FinancialYearsPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const status = useQuery({
    queryKey: ['years', 'creation-status'],
    queryFn: () => apiClient.get<CreationStatus>('/years/creation-status').then((r) => r.data),
  });
  const years = useQuery({ queryKey: ['years'], queryFn: yearsApi.getAll });

  const create = useMutation({
    mutationFn: () => apiClient.post<CreateResult>('/years/create').then((r) => r.data),
    onSuccess: (r) => {
      setConfirmOpen(false);
      const books = [
        r.checkBooksCreated ? `${fa(r.checkBooksCreated)} دسته‌چک صوری ساخته شد` : null,
        r.checkBooksRestored ? `${fa(r.checkBooksRestored)} بازگردانده شد` : null,
        r.checkBooksExisting ? `${fa(r.checkBooksExisting)} از قبل بود` : null,
      ].filter(Boolean);
      notify({
        message: `سال مالی ${fa(r.year)} ایجاد و پیش‌فرض شد${books.length ? `؛ ${books.join('، ')}` : ''}.`,
        severity: 'success',
      });
      void queryClient.invalidateQueries({ queryKey: ['years'] });
    },
    onError: () => setConfirmOpen(false),
  });

  const s = status.data;

  return (
    <section>
      <PageHeader
        icon={<EventOutlinedIcon />}
        title="سال مالی"
        description="ایجاد سال مالی تازه در فروردین هر سال — فقط ستاد مرکزی."
      />

      {status.isError && <ErrorBanner error={status.error} />}
      {create.isError && <ErrorBanner error={create.error} />}

      {status.isLoading && <FormLoadingSkeleton />}

      {s && (
        <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
              <Typography variant="body2">
                سال پیش‌فرض فعلی: <b>{fa(s.currentYear)}</b>
              </Typography>
              <Typography variant="body2">
                سال قابل ایجاد: <b>{fa(s.candidateYear)}</b>
              </Typography>
              <Typography variant="body2">
                حساب‌های بانکی: <b>{fa(s.bankAccounts)}</b>
              </Typography>
            </Stack>

            {s.canCreate ? (
              <Alert severity="info">
                با ایجاد سال {fa(s.candidateYear)}، این سال پیش‌فرض می‌شود
                {s.currentYear ? ` و سال ${fa(s.currentYear)} دیگر پیش‌فرض نیست` : ''}، و برای هر یک از{' '}
                {fa(s.bankAccounts)} حساب بانکی یک دسته‌چک صوری (اعلامیهٔ صوری) سال {fa(s.candidateYear)} ساخته
                می‌شود. کار دیگری انجام نمی‌شود.
              </Alert>
            ) : (
              <Alert severity="warning">{s.reason}</Alert>
            )}

            <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={<AddOutlinedIcon />}
                disabled={!s.canCreate || create.isPending}
                onClick={() => setConfirmOpen(true)}
              >
                ایجاد سال مالی {fa(s.candidateYear)}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      <Typography variant="h3" component="h2" sx={{ mb: 1.25 }}>
        سال‌های تعریف‌شده
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: 520 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>سال</TableCell>
              <TableCell>پیش‌فرض</TableCell>
              <TableCell align="left">آخرین شماره</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(years.data ?? []).map((y) => (
              <TableRow key={y.workingYear}>
                <TableCell sx={{ fontWeight: 600 }}>{fa(y.workingYear)}</TableCell>
                <TableCell>
                  {y.isCurrent ? <Chip size="small" color="primary" label="سال پیش‌فرض" /> : '—'}
                </TableCell>
                <TableCell align="left">{fa(y.lastNumber)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <ConfirmDialog
        open={confirmOpen}
        title={`ایجاد سال مالی ${s ? fa(s.candidateYear) : ''}`}
        description="سال تازه پیش‌فرض می‌شود و دسته‌چک‌های صوری سال تازه ساخته می‌شوند. ادامه می‌دهید؟"
        confirmLabel="ایجاد سال مالی"
        confirmColor="primary"
        pending={create.isPending}
        onConfirm={() => create.mutate()}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  );
}
