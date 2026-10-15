import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SyncAltOutlinedIcon from '@mui/icons-material/SyncAltOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { useRoles } from '../../lib/roles';
import { meApi } from '../../lib/api/meApi';
import { getRequestedUnitCode } from '../../lib/session/unitScopeStore';
import { toPersianDigits } from '../../lib/format/numbers';
import { legacyImportApi, type LegacyImportReportDto } from './api';
import { ConnectionsEditor } from './ConnectionsEditor';
import { VouchersStep } from './VouchersStep';

const fa = (v: number | string | null | undefined) => toPersianDigits(String(v ?? '—'));
const faDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fa-IR') : '—');

/** گزارش بررسی/ثبت: خطاها (قرمز)، هشدارها (زرد)، توضیحات. */
export function ReportView({ report }: { report: LegacyImportReportDto }) {
  const severity = !report.success ? 'error' : report.committed ? 'success' : 'info';
  const openIssues = (report.issues ?? []).filter((i) => i.status !== 'resolved').length;
  const title = !report.success
    ? `${fa(report.errors.length + openIssues)} مورد باید اصلاح یا تصمیم‌گیری شود`
    : report.committed
      ? 'ثبت شد'
      : 'بررسی بدون خطا بود — هنوز چیزی ثبت نشده است';
  const list = (items: string[], color: string) =>
    items.length > 0 && (
      <Box component="ul" sx={{ m: 0, pl: 0, pr: 2.5, maxHeight: 260, overflow: 'auto', color }}>
        {items.map((s, i) => (
          <Typography component="li" variant="body2" key={i} sx={{ mb: 0.5 }}>
            {s}
          </Typography>
        ))}
      </Box>
    );
  return (
    <Stack spacing={1.5} sx={{ mt: 2 }}>
      <Alert severity={severity}>{title}</Alert>
      {list(report.errors, 'error.main')}
      {report.warnings.length > 0 && (
        <>
          <Typography variant="subtitle2">هشدارها ({fa(report.warnings.length)})</Typography>
          {list(report.warnings, 'warning.dark')}
        </>
      )}
      {list(report.info, 'text.secondary')}
    </Stack>
  );
}

/**
 * بارگذاری کاربرگ با دو مرحله: «بررسی» (همه‌چیز اجرا و برگردانده می‌شود) و «ثبت نهایی» که فقط بعد از بررسی
 * موفق همان فایل فعال است.
 */
function WorkbookUpload({
  upload,
  disabled,
  confirmText,
  onCommitted,
}: {
  upload: (file: File, commit: boolean) => Promise<LegacyImportReportDto>;
  disabled?: boolean;
  confirmText: string;
  onCommitted: () => void;
}) {
  const notify = useNotify();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [checkedFile, setCheckedFile] = useState<File | null>(null);
  const [report, setReport] = useState<LegacyImportReportDto | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const run = useMutation({
    mutationFn: ({ f, commit }: { f: File; commit: boolean }) => upload(f, commit),
    onSuccess: (r, { f, commit }) => {
      setReport(r);
      setConfirmOpen(false);
      setCheckedFile(!commit && r.success ? f : null);
      if (r.committed) {
        notify({ message: 'کاربرگ ثبت شد.', severity: 'success' });
        onCommitted();
      }
    },
    onError: () => setConfirmOpen(false),
  });

  const canCommit = !!file && checkedFile === file && !run.isPending;

  return (
    <Box>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        hidden
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setReport(null);
          setCheckedFile(null);
          e.target.value = '';
        }}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
        <Button
          variant="outlined"
          startIcon={<UploadFileOutlinedIcon />}
          disabled={disabled || run.isPending}
          onClick={() => inputRef.current?.click()}
        >
          انتخاب فایل کاربرگ
        </Button>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {file ? file.name : 'فایلی انتخاب نشده'}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<FactCheckOutlinedIcon />}
          disabled={disabled || !file || run.isPending}
          onClick={() => file && run.mutate({ f: file, commit: false })}
        >
          بررسی
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveOutlinedIcon />}
          disabled={disabled || !canCommit}
          onClick={() => setConfirmOpen(true)}
        >
          ثبت نهایی
        </Button>
      </Stack>
      {run.isPending && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary">
            در حال خواندن سیستم قدیم و بررسی کاربرگ… ممکن است چند دقیقه طول بکشد.
          </Typography>
        </Box>
      )}
      {run.isError && <ErrorBanner error={run.error} />}
      {report && <ReportView report={report} />}

      <ConfirmDialog
        open={confirmOpen}
        title="ثبت نهایی"
        description={confirmText}
        confirmLabel="ثبت نهایی"
        confirmColor="primary"
        pending={run.isPending}
        onConfirm={() => file && run.mutate({ f: file, commit: true })}
        onCancel={() => setConfirmOpen(false)}
      />
    </Box>
  );
}

function StepCard({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5, mb: 2.5 }}>
      <Typography variant="h3" component="h2" sx={{ mb: 1.5 }}>
        {fa(n)}. {title}
      </Typography>
      {children}
    </Paper>
  );
}

/**
 * انتقال از سیستم قدیم (خط‌کدینگ؛ یک اسکیما برای هر واحد و هر سال) به کدینگ شناور.
 * واحد: یافتن اسکیماهای سالانه ← دریافت کاربرگ ← وارد کردن کد ملی/شناسهٔ ملی اشخاص ← بارگذاری و ثبت.
 * ستاد (یک‌بار): کدینگ مشترک گروه/کل/معین. انتقال اسناد بعد از ثبت کدینگ واحد، جدا و بدون دخالت کاربر است.
 */
export function LegacyImportPage() {
  const roles = useRoles();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: () => meApi.getCurrentUser(), staleTime: 5 * 60 * 1000 });
  const unit = getRequestedUnitCode() ?? me.data?.vahedCode ?? '';

  const status = useQuery({ queryKey: ['legacy-import', 'status', unit], queryFn: legacyImportApi.status });
  const sources = useMutation({ mutationFn: legacyImportApi.sources });
  const unitDownload = useMutation({ mutationFn: legacyImportApi.downloadUnitWorkbook });
  const [chartUnits, setChartUnits] = useState('');
  const chartDownload = useMutation({
    mutationFn: () => legacyImportApi.downloadChartWorkbook((chartUnits || unit).split(/[,،\s]+/).filter(Boolean)),
  });
  const refreshStatus = () => void queryClient.invalidateQueries({ queryKey: ['legacy-import', 'status'] });

  const s = status.data;
  const chip = (done: boolean | undefined, when: string | null | undefined, doneLabel: string, todo: string) =>
    done ? (
      <Chip color="success" size="small" label={`${doneLabel} — ${faDate(when ?? null)}`} />
    ) : (
      <Chip variant="outlined" size="small" label={todo} />
    );

  return (
    <section>
      <PageHeader
        icon={<SyncAltOutlinedIcon />}
        title="انتقال از سیستم قدیم"
        description="تعریف کدینگ واحد از روی سیستم قدیم: تفصیلی‌ها، اشخاص با کد ملی، فعالیت و مرکز هزینه؛ سپس انتقال اسناد."
      />

      {status.isError && <ErrorBanner error={status.error} />}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2.5 }}>
        <Typography variant="body2" sx={{ alignSelf: 'center' }}>
          واحد <b>{fa(unit)}</b>:
        </Typography>
        {chip(s?.chartImported, s?.chartImportedAt, 'کدینگ مشترک منتقل شده', 'کدینگ مشترک (ستاد) هنوز منتقل نشده')}
        {chip(s?.unitCodingImported, s?.unitCodingImportedAt, 'کدینگ واحد ثبت شده', 'کدینگ واحد هنوز ثبت نشده')}
      </Stack>

      {s && !s.chartImported && (
        <Alert severity="warning" sx={{ mb: 2.5 }}>
          کدینگ مشترک (گروه، کل و معین) باید یک‌بار توسط مدیر ستاد منتقل شود؛ تا آن زمان ثبت کدینگ واحد ممکن نیست.
        </Alert>
      )}

      <StepCard n={1} title="اتصال دستی">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          سیستم قدیم برای هر سال مالی یک اسکیما دارد. سرور را با ورود آدرس یا از فایل XML سرورهای سیستم قدیم تعیین
          کنید؛ سپس برای هر سال نام کاربر و رمز را وارد، با دکمهٔ آزمودن بررسی و ذخیره کنید. رمز روی سرور رمزگذاری‌شده
          نگه داشته می‌شود.
        </Typography>
        <ConnectionsEditor unit={unit} />
        <Divider sx={{ my: 2 }} />
        <Button
          variant="outlined"
          startIcon={<SearchOutlinedIcon />}
          disabled={sources.isPending}
          onClick={() => sources.mutate()}
        >
          {sources.isPending ? 'در حال بررسی…' : 'بررسی همهٔ اتصال‌ها'}
        </Button>
        {sources.isError && <ErrorBanner error={sources.error} />}
        {sources.data && (
          <TableContainer sx={{ mt: 2, maxWidth: 720 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>سال</TableCell>
                  <TableCell>اسکیما</TableCell>
                  <TableCell>سرور</TableCell>
                  <TableCell>وضعیت</TableCell>
                  <TableCell align="left">تعداد سند</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sources.data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>هیچ اسکیمایی پیدا نشد؛ تنظیمات سرور و رمز را بررسی کنید.</TableCell>
                  </TableRow>
                )}
                {sources.data.map((x) => (
                  <TableRow key={`${x.server}-${x.schema}`}>
                    <TableCell sx={{ fontWeight: 600 }}>{fa(x.year)}</TableCell>
                    <TableCell dir="ltr">{x.schema}</TableCell>
                    <TableCell dir="ltr">{x.server}</TableCell>
                    <TableCell>
                      {x.connected ? (
                        <Chip size="small" color="success" label="متصل" />
                      ) : (
                        <Chip size="small" color="error" label={x.error ?? 'خطا'} />
                      )}
                    </TableCell>
                    <TableCell align="left">{x.connected ? fa(x.vouchers) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </StepCard>

      <StepCard n={2} title="دریافت کاربرگ کدینگ واحد">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          تفصیلی‌های همهٔ سال‌ها در یک فایل. برای تفصیلی‌هایی که شخص‌اند «نوع شخص» را حقیقی یا حقوقی بگذارید و کد ملی
          (۱۰ رقم) یا شناسهٔ ملی (۱۱ رقم) را بنویسید؛ کد ملی همان کد تفصیلی در سیستم جدید می‌شود و اگر آن شخص در واحد
          دیگری تعریف شده باشد، همان تفصیلی استفاده می‌شود. راهنمای کامل در برگهٔ اول فایل است.
        </Typography>
        <Button
          variant="contained"
          startIcon={<FileDownloadOutlinedIcon />}
          disabled={unitDownload.isPending}
          onClick={() => unitDownload.mutate()}
        >
          {unitDownload.isPending
            ? 'در حال ساخت کاربرگ…'
            : s?.unitCodingImported
              ? 'دریافت کاربرگ ثبت‌شده'
              : 'دریافت کاربرگ'}
        </Button>
        {unitDownload.isError && <ErrorBanner error={unitDownload.error} />}
      </StepCard>

      <StepCard n={3} title="بارگذاری کاربرگ پرشده">
        {s?.unitCodingImported ? (
          <Alert severity="success">کدینگ این واحد ثبت شده است. اسناد را در مرحلهٔ ۴ سال‌به‌سال منتقل کنید.</Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              اول «بررسی» کنید: همه‌چیز آزمایشی اجرا می‌شود و هیچ تغییری ثبت نمی‌شود. اگر بدون خطا بود «ثبت نهایی» فعال
              می‌شود.
            </Typography>
            <WorkbookUpload
              upload={legacyImportApi.uploadUnitWorkbook}
              disabled={!s?.chartImported}
              confirmText="تفصیلی‌ها، فعالیت‌ها و مراکز هزینهٔ این واحد در سیستم جدید تعریف می‌شوند. این کار برای هر واحد یک‌بار است. ادامه می‌دهید؟"
              onCommitted={refreshStatus}
            />
          </>
        )}
      </StepCard>

      <StepCard n={4} title="انتقال اسناد">
        <VouchersStep unit={unit} enabled={!!s?.unitCodingImported} />
      </StepCard>

      {roles.isSetad && (
        <>
          <Divider sx={{ my: 3 }} />
          <Paper variant="outlined" sx={{ p: 2.5, mb: 2.5, borderColor: 'warning.main' }}>
            <Typography variant="h3" component="h2" sx={{ mb: 1 }}>
              کدینگ مشترک — فقط مدیر ستاد، یک‌بار
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              گروه، کل و معین برای همهٔ واحدها یکسان و بدون کد واحد است. کاربرگ از کل/معین واحدهای داده‌شده ساخته
              می‌شود (معمولاً اولین واحد). اگر واحد بعدی معین تازه‌ای داشت، کاربرگ را دوباره با همهٔ واحدها بسازید و ثبت
              کنید؛ کدهای موجود دوباره ساخته نمی‌شوند.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2, alignItems: { sm: 'center' } }}>
              <TextField
                size="small"
                label="کد واحدها (با ویرگول)"
                placeholder={unit}
                value={chartUnits}
                onChange={(e) => setChartUnits(e.target.value)}
                sx={{ minWidth: 240 }}
                slotProps={{ htmlInput: { dir: 'ltr' } }}
              />
              <Button
                variant="contained"
                startIcon={<FileDownloadOutlinedIcon />}
                disabled={chartDownload.isPending}
                onClick={() => chartDownload.mutate()}
              >
                {chartDownload.isPending ? 'در حال ساخت…' : 'دریافت کاربرگ کدینگ مشترک'}
              </Button>
            </Stack>
            {chartDownload.isError && <ErrorBanner error={chartDownload.error} />}
            <WorkbookUpload
              upload={legacyImportApi.uploadChartWorkbook}
              confirmText="گروه، کل و معین‌های لازم در درخت حساب سیستم جدید ساخته می‌شوند (ردیف‌های آزمایشی هم‌کد بازاستفاده می‌شوند). ادامه می‌دهید؟"
              onCommitted={refreshStatus}
            />
          </Paper>
        </>
      )}
    </section>
  );
}
