import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { toPersianDigits } from '../../lib/format/numbers';
import { legacyImportApi, type LegacyImportReportDto } from './api';
import { ReportView } from './LegacyImportPage';

const fa = (v: number | string) => toPersianDigits(String(v));

/** الف) اطلاعات بانکی واحد (حساب، نوع چک، دسته‌چک، برگ چک) — یک‌بار و پیش از اسناد؛ تکرارش بی‌خطر است. */
function BankSection({ unit, enabled }: { unit: string; enabled: boolean }) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: ['legacy-import', 'status', unit], queryFn: legacyImportApi.status });
  const [checked, setChecked] = useState(false);
  const [report, setReport] = useState<LegacyImportReportDto | null>(null);
  const run = useMutation({
    mutationFn: (commit: boolean) => legacyImportApi.importBank(commit),
    onSuccess: (r, commit) => {
      setReport(r);
      setChecked(!commit && r.success);
      if (r.committed) {
        notify({ message: 'اطلاعات بانکی منتقل شد.', severity: 'success' });
        void queryClient.invalidateQueries({ queryKey: ['legacy-import'] });
      }
    },
  });
  const at = status.data?.bankImportedAt;
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        الف) اطلاعات بانکی و کارگاه‌ها {at && <Chip size="small" color="success" label={`منتقل شد (${new Date(at).toLocaleDateString('fa-IR')})`} sx={{ mr: 1 }} />}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        حساب‌های جاری، نوع چک، دسته‌چک‌ها، برگ چک‌ها و کارگاه‌ها از همهٔ سال‌ها؛ وضعیت چک (ابطال، چاپ، وصول) از آخرین سال. پیش از
        انتقال اسناد لازم است تا ردیف‌ها به چک وصل شوند. تکرارش بی‌خطر است: موجودها دوباره ساخته نمی‌شوند و فقط به‌روز
        می‌شوند.
      </Typography>
      <Stack direction="row" spacing={1.5}>
        <Button variant="outlined" startIcon={<FactCheckOutlinedIcon />} disabled={!enabled || run.isPending} onClick={() => run.mutate(false)}>
          بررسی اطلاعات بانکی
        </Button>
        <Button variant="contained" startIcon={<SaveOutlinedIcon />} disabled={!enabled || !checked || run.isPending} onClick={() => run.mutate(true)}>
          انتقال اطلاعات بانکی
        </Button>
      </Stack>
      {run.isPending && <LinearProgress sx={{ mt: 1.5 }} />}
      {run.isError && <ErrorBanner error={run.error} />}
      {report && <ReportView report={report} />}
    </Box>
  );
}

/**
 * مرحلهٔ ۴: انتقال اسناد سال‌به‌سال. اول «بررسی» (آزمایشی، بدون ثبت)، بعد «انتقال». انتقال دوبارهٔ یک سال فقط اسنادی را
 * که قبلاً از انتقال آمده‌اند حذف و از نو منتقل می‌کند؛ اسناد دستی سیستم جدید دست نمی‌خورند.
 */
export function VouchersStep({ unit, enabled }: { unit: string; enabled: boolean }) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const connections = useQuery({ queryKey: ['legacy-import', 'connections', unit], queryFn: legacyImportApi.connections });
  const status = useQuery({ queryKey: ['legacy-import', 'vouchers', unit], queryFn: legacyImportApi.voucherStatus });
  const [year, setYear] = useState<number | null>(null);
  const [checkedYear, setCheckedYear] = useState<number | null>(null);
  const [report, setReport] = useState<LegacyImportReportDto | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const years = [...new Set([...(connections.data?.years.map((y) => y.year) ?? []), ...(status.data?.map((s) => s.year) ?? [])])].sort();
  const done = (y: number) => status.data?.find((s) => s.year === y);
  const firstPending = years.find((y) => !done(y));

  const run = useMutation({
    mutationFn: ({ y, commit }: { y: number; commit: boolean }) => legacyImportApi.importVouchers(y, commit),
    onSuccess: (r, { y, commit }) => {
      setReport(r);
      setConfirmOpen(false);
      setCheckedYear(!commit && r.success ? y : null);
      if (r.committed) {
        notify({ message: `اسناد سال ${fa(y)} منتقل شد.`, severity: 'success' });
        void queryClient.invalidateQueries({ queryKey: ['legacy-import', 'vouchers', unit] });
      }
    },
    onError: () => setConfirmOpen(false),
  });
  const mapDownload = useMutation({ mutationFn: (y: number) => legacyImportApi.downloadVoucherMap(y) });

  const pick = (y: number) => {
    setYear(y);
    setReport(null);
    setCheckedYear(null);
  };
  const again = year != null && !!done(year);

  return (
    <Box>
      {!enabled && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          اول کدینگ واحد (مرحلهٔ ۳) را ثبت نهایی کنید.
        </Alert>
      )}
      <BankSection unit={unit} enabled={enabled} />

      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        ب) اسناد
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        سال‌به‌سال و از قدیمی‌ترین سال. شمارهٔ اسناد به ترتیب تاریخ از نو زده می‌شود و فهرست شمارهٔ قدیم ← جدید هر سال
        قابل دریافت است. سندهای افتتاحیه و اختتامیهٔ سیستم قدیم هم منتقل می‌شوند. همراه اسناد هر سال، فیش/حواله‌ها، کارت
        بانک، چک‌های در جریان وصول، اعلامیه‌ها و ویژگی‌های ردیف همان سال هم منتقل و ردیف‌ها به چک و فیش وصل می‌شوند.
        اعتبار ردیف‌ها و شناسه‌های واریز منتقل نمی‌شوند.
      </Typography>

      <TableContainer sx={{ mb: 1.5 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 110 }}>سال مالی</TableCell>
              <TableCell>وضعیت</TableCell>
              <TableCell sx={{ width: 300 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {years.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} sx={{ color: 'text.secondary' }}>
                  سالی نیست — اول در مرحلهٔ ۱ اتصال‌ها را ذخیره کنید.
                </TableCell>
              </TableRow>
            )}
            {years.map((y) => {
              const d = done(y);
              return (
                <TableRow key={y} selected={year === y}>
                  <TableCell>{fa(y)}</TableCell>
                  <TableCell>
                    {d ? (
                      <Chip
                        size="small"
                        color="success"
                        label={`منتقل شد — ${fa(d.vouchers)} سند، ${fa(d.lines)} ردیف (${new Date(d.migratedAt).toLocaleDateString('fa-IR')})`}
                      />
                    ) : (
                      <Chip size="small" variant="outlined" label={y === firstPending ? 'نوبت این سال' : 'منتقل نشده'} />
                    )}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant={year === y ? 'contained' : 'outlined'} disabled={!enabled || run.isPending} onClick={() => pick(y)}>
                        {year === y ? 'انتخاب‌شده' : 'انتخاب'}
                      </Button>
                      {d && (
                        <Button
                          size="small"
                          startIcon={<FileDownloadOutlinedIcon />}
                          sx={{ whiteSpace: 'nowrap' }}
                          disabled={mapDownload.isPending}
                          onClick={() => mapDownload.mutate(y)}
                        >
                          شماره قدیم ← جدید
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      {mapDownload.isError && <ErrorBanner error={mapDownload.error} />}

      {year != null && (
        <>
          {again && (
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              اسناد سال {fa(year)} قبلاً منتقل شده‌اند. انتقال دوباره آن اسناد را حذف و از نو منتقل می‌کند (اسناد دستی سیستم
              جدید دست نمی‌خورند).
            </Alert>
          )}
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              startIcon={<FactCheckOutlinedIcon />}
              disabled={!enabled || run.isPending}
              onClick={() => run.mutate({ y: year, commit: false })}
            >
              بررسی سال {fa(year)}
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveOutlinedIcon />}
              disabled={!enabled || checkedYear !== year || run.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              {again ? `انتقال دوبارهٔ سال ${fa(year)}` : `انتقال سال ${fa(year)}`}
            </Button>
          </Stack>
          <Typography variant="caption" color={checkedYear === year ? 'success.main' : 'text.secondary'} sx={{ display: 'block', mt: 0.75 }}>
            {checkedYear === year
              ? `بررسی بدون خطا بود؛ حالا «${again ? 'انتقال دوباره' : 'انتقال'}» را بزنید تا ثبت شود.`
              : 'مرحلهٔ ۱: «بررسی» (آزمایشی، چیزی ثبت نمی‌شود) — مرحلهٔ ۲: «انتقال» که فقط بعد از بررسی بدون خطا فعال می‌شود.'}
          </Typography>
        </>
      )}
      {run.isPending && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary">
            در حال خواندن اسناد از سیستم قدیم… ممکن است چند دقیقه طول بکشد.
          </Typography>
        </Box>
      )}
      {run.isError && <ErrorBanner error={run.error} />}
      {report && <ReportView report={report} />}

      <ConfirmDialog
        open={confirmOpen}
        title={`انتقال اسناد سال ${year != null ? fa(year) : ''}`}
        description={
          again
            ? 'اسناد انتقال قبلی این سال حذف و از نو منتقل می‌شوند. ادامه می‌دهید؟'
            : 'اسناد این سال در سیستم جدید ثبت می‌شوند. ادامه می‌دهید؟'
        }
        confirmLabel={again ? 'انتقال دوباره' : 'انتقال'}
        confirmColor="primary"
        pending={run.isPending}
        onConfirm={() => year != null && run.mutate({ y: year, commit: true })}
        onCancel={() => setConfirmOpen(false)}
      />
    </Box>
  );
}
