import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import FilterAltOffOutlinedIcon from '@mui/icons-material/FilterAltOffOutlined';
import { PageHeader } from '../../../components/PageHeader';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { JalaliDateField } from '../../../components/JalaliDateField';
import { MonoCode } from '../../../components/MonoCode';
import { Pagination } from '../../../components/Pagination';
import { StatTiles, type StatTile } from '../../../components/StatTiles';
import { BalanceBar } from '../_shared/BalanceBar';
import { useSession } from '../../../lib/session/SessionContext';
import { useNotify } from '../../../lib/notifications/NotificationProvider';
import { toLatinDigits, toPersianDigits } from '../../../lib/format/numbers';
import { DOC_LIFE_OPTIONS, getDocLifeLabel, getDocLifeTone } from '../../vouchers/api';
import { accountJournalApi } from './api';
import { exportAccountJournalToExcel, exportAccountJournalToPdf } from './export';
import { ACCOUNT_JOURNAL_PRINT_STYLES } from './printStyles';

const PAGE_SIZE_OPTIONS = [50, 100, 200, 500];

/** Formats an amount with thousands separators in Persian digits. */
function amount(value: number): string {
  return toPersianDigits(value.toLocaleString('en-US'));
}

/** Jalali YYYYMMDD → ۱۴۰۴/۰۲/۱۵. */
function jalali(value: string): string {
  if (value.length !== 8) return toPersianDigits(value || '—');
  return toPersianDigits(`${value.slice(0, 4)}/${value.slice(4, 6)}/${value.slice(6, 8)}`);
}

/**
 * دفتر روزنامه — `GET /api/reports/account-journal`.
 *
 * <b>Oldest first, and one row per posting line.</b> Both are deliberate and both differ from
 * مرور اسناد: a journal is the ordered record of what happened, read forwards, and each line keeps
 * its own شرح rather than inheriting the voucher's. Two postings to the same معین within one
 * voucher stay two rows.
 *
 * <b>Voucher grouping is visual, not structural.</b> Rows are grouped under a shaded voucher
 * header so a long run stays readable, but the page never regroups or re-sums the data it was
 * given — the totals under the table are the server's figures for the whole filtered set, not a
 * sum of what is on screen.
 */
export function AccountJournalPage() {
  const { financialYear, unitLabel, isConfigured } = useSession();
  const notify = useNotify();

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  const emptyDraft = {
    fromVoucherNo: '',
    toVoucherNo: '',
    fromDate: '',
    toDate: '',
    fromAccountCode: '',
    toAccountCode: '',
    docLife: '' as string,
    description: '',
  };
  const [draft, setDraft] = useState(emptyDraft);
  const [applied, setApplied] = useState(emptyDraft);

  const report = useQuery({
    queryKey: ['account-journal', financialYear, pageNumber, pageSize, applied],
    queryFn: () =>
      accountJournalApi.get({
        year: financialYear,
        pageNumber,
        pageSize,
        fromVoucherNo: applied.fromVoucherNo || undefined,
        toVoucherNo: applied.toVoucherNo || undefined,
        fromDate: applied.fromDate || undefined,
        toDate: applied.toDate || undefined,
        fromAccountCode: applied.fromAccountCode || undefined,
        toAccountCode: applied.toAccountCode || undefined,
        docLife: applied.docLife === '' ? undefined : Number(applied.docLife),
        description: applied.description || undefined,
      }),
    enabled: isConfigured,
  });

  const rows = useMemo(() => report.data?.items ?? [], [report.data]);
  const totalDebtor = report.data?.totalDebtor ?? 0;
  const totalCreditor = report.data?.totalCreditor ?? 0;
  const totalCount = report.data?.totalCount ?? 0;
  const isBalanced = totalDebtor === totalCreditor;

  /**
   * Marks the first row of each voucher so the table can print a divider above it. Computed from
   * the server's order rather than by grouping — re-grouping would let the display disagree with
   * the sequence the journal was returned in, which is the one thing a journal must preserve.
   */
  const rowsWithBreaks = useMemo(
    () =>
      rows.map((row, index) => ({
        row,
        startsVoucher: index === 0 || rows[index - 1].voucherNumber !== row.voucherNumber,
      })),
    [rows],
  );

  const tiles: StatTile[] = [
    { key: 'count', label: 'تعداد ردیف', value: totalCount, tone: 'primary' },
    { key: 'debtor', label: 'جمع بدهکار', value: amount(totalDebtor), tone: 'info' },
    { key: 'creditor', label: 'جمع بستانکار', value: amount(totalCreditor), tone: 'warning' },
    {
      key: 'balance',
      label: isBalanced ? 'تراز' : 'اختلاف',
      value: amount(Math.abs(totalDebtor - totalCreditor)),
      tone: isBalanced ? 'success' : 'error',
      hint: isBalanced ? 'بدهکار و بستانکار برابرند' : 'بدهکار و بستانکار برابر نیستند',
    },
  ];

  const context = {
    year: financialYear,
    fromDate: applied.fromDate,
    toDate: applied.toDate,
    unitLabel,
    totalDebtor,
    totalCreditor,
    totalCount,
    exportedCount: rows.length,
  };

  async function handleExcel() {
    try {
      await exportAccountJournalToExcel(rows, context);
    } catch (error) {
      notify({
        message: error instanceof Error ? error.message : 'ساخت فایل اکسل با خطا مواجه شد.',
        severity: 'error',
      });
    }
  }

  function applyFilters() {
    setPageNumber(1);
    setApplied(draft);
  }

  const hasDraftFilters = Object.values(draft).some((v) => v !== '');
  const hasAppliedFilters = Object.values(applied).some((v) => v !== '');

  return (
    <section>
      <style>{ACCOUNT_JOURNAL_PRINT_STYLES}</style>

      <Box className="account-journal-no-print">
        <PageHeader
          eyebrow="گزارش‌ها"
          icon={<ArticleOutlinedIcon />}
          title="دفتر روزنامه"
          description="همهٔ ردیف‌های اسناد، به ترتیب تاریخ و شماره سند."
          actions={
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<FileDownloadOutlinedIcon />}
                onClick={handleExcel}
                disabled={rows.length === 0}
              >
                خروجی اکسل
              </Button>
              <Button
                variant="outlined"
                startIcon={<PrintOutlinedIcon />}
                onClick={exportAccountJournalToPdf}
                disabled={rows.length === 0}
              >
                چاپ / PDF
              </Button>
            </Stack>
          }
        />

        {!isConfigured && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="body2">
              برای دیدن گزارش، ابتدا سال مالی را از نوار بالای صفحه انتخاب کنید.
            </Typography>
          </Paper>
        )}

        <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
              فیلترها
            </Typography>
            {hasAppliedFilters && <Chip size="small" color="primary" label="فیلتر فعال" />}
            <Button
              size="small"
              variant="text"
              startIcon={<TuneOutlinedIcon />}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              {filtersOpen ? 'بستن' : 'نمایش'}
            </Button>
          </Stack>

          <Collapse in={filtersOpen}>
            <Stack spacing={2} sx={{ pt: 2 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <JalaliDateField
                  label="از تاریخ"
                  value={draft.fromDate}
                  onChange={(v) => setDraft((d) => ({ ...d, fromDate: v }))}
                  size="small"
                />
                <JalaliDateField
                  label="تا تاریخ"
                  value={draft.toDate}
                  onChange={(v) => setDraft((d) => ({ ...d, toDate: v }))}
                  size="small"
                />
                <TextField
                  size="small"
                  label="از شمارهٔ سند"
                  value={draft.fromVoucherNo}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, fromVoucherNo: toLatinDigits(e.target.value) }))
                  }
                  slotProps={{ htmlInput: { maxLength: 6, inputMode: 'numeric' } }}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="تا شمارهٔ سند"
                  value={draft.toVoucherNo}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, toVoucherNo: toLatinDigits(e.target.value) }))
                  }
                  slotProps={{ htmlInput: { maxLength: 6, inputMode: 'numeric' } }}
                  fullWidth
                />
              </Stack>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  size="small"
                  label="از کد معین"
                  helperText="کد ناقص هم پذیرفته می‌شود — مثلاً ۱۱ همهٔ حساب‌های زیر ۱۱ را شامل است."
                  value={draft.fromAccountCode}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, fromAccountCode: toLatinDigits(e.target.value) }))
                  }
                  slotProps={{ htmlInput: { maxLength: 6, inputMode: 'numeric' } }}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="تا کد معین"
                  value={draft.toAccountCode}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, toAccountCode: toLatinDigits(e.target.value) }))
                  }
                  slotProps={{ htmlInput: { maxLength: 6, inputMode: 'numeric' } }}
                  fullWidth
                />
                <TextField
                  select
                  size="small"
                  label="وضعیت سند"
                  value={draft.docLife}
                  onChange={(e) => setDraft((d) => ({ ...d, docLife: e.target.value }))}
                  sx={{ minWidth: 150 }}
                >
                  <MenuItem value="">همه</MenuItem>
                  {DOC_LIFE_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  size="small"
                  label="شرح ردیف شامل"
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  slotProps={{ htmlInput: { maxLength: 250 } }}
                  fullWidth
                />
              </Stack>

              <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                <Button
                  size="small"
                  variant="text"
                  startIcon={<FilterAltOffOutlinedIcon />}
                  disabled={!hasDraftFilters && !hasAppliedFilters}
                  onClick={() => {
                    setDraft(emptyDraft);
                    setApplied(emptyDraft);
                    setPageNumber(1);
                  }}
                >
                  پاک کردن
                </Button>
                <Button size="small" variant="contained" onClick={applyFilters}>
                  اعمال فیلتر
                </Button>
              </Stack>
            </Stack>
          </Collapse>
        </Paper>

        <StatTiles tiles={tiles} isLoading={report.isLoading} />

        {/* Screen-only. On paper the totals row under the table already carries these figures, and a
            bar would spend a third of the first sheet repeating them. */}
        <BalanceBar debtor={totalDebtor} creditor={totalCreditor} hasRows={rows.length > 0} />

        {report.isError && <ErrorBanner error={report.error} />}
      </Box>

      <Box id="account-journal-print-root">
        <Box sx={{ display: 'none', '@media print': { display: 'block', mb: 2 } }}>
          <Typography variant="h2">دفتر روزنامه</Typography>
          <Typography variant="body2">
            واحد: {unitLabel || '—'} | سال مالی: {toPersianDigits(financialYear || '—')} |{' '}
            {toPersianDigits(rows.length)} ردیف از {toPersianDigits(totalCount)} ردیف
          </Typography>
        </Box>

        <Paper variant="outlined">
          <Box
            className="account-journal-no-print"
            sx={{ p: 1.5, display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}
          >
            {/* A journal is read in long runs, so the page size is a first-class control here
                rather than a fixed constant like on the other report pages. */}
            <TextField
              select
              size="small"
              label="تعداد در صفحه"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPageNumber(1);
              }}
              sx={{ width: 150 }}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {toPersianDigits(option)}
                </MenuItem>
              ))}
            </TextField>
            {totalCount > 0 && (
              <Typography variant="caption" color="text.secondary">
                {toPersianDigits(totalCount)} ردیف
              </Typography>
            )}
          </Box>

          {/* Bounded height with its own scrollbar — a 500-row page would otherwise scroll the
              whole document and carry the sticky header and totals row out of view. */}
          <TableContainer sx={{ overflowX: 'auto', maxHeight: '60vh' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 110 }}>شماره سند</TableCell>
                  <TableCell sx={{ width: 120 }}>تاریخ</TableCell>
                  <TableCell sx={{ width: 110 }}>کد معین</TableCell>
                  <TableCell sx={{ width: 200 }}>نام حساب</TableCell>
                  <TableCell>شرح</TableCell>
                  <TableCell sx={{ width: 110 }}>وضعیت</TableCell>
                  <TableCell align="left">بدهکار</TableCell>
                  <TableCell align="left">بستانکار</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {report.isLoading &&
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}

                {!report.isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                      {!isConfigured
                        ? 'سال مالی انتخاب نشده است.'
                        : 'برای این بازه، ردیفی ثبت نشده است.'}
                    </TableCell>
                  </TableRow>
                )}

                {!report.isLoading &&
                  rowsWithBreaks.map(({ row, startsVoucher }, index) => (
                    <Fragment key={`${row.voucherNumber}-${index}`}>
                      <TableRow
                        hover
                        sx={
                          startsVoucher && index > 0
                            ? {
                                '& td': {
                                  borderTop: (theme) =>
                                    `2px solid ${alpha(theme.palette.primary.main, 0.25)}`,
                                },
                              }
                            : undefined
                        }
                      >
                        <TableCell>
                          {startsVoucher ? <MonoCode value={row.voucherNumber} /> : ''}
                        </TableCell>
                        <TableCell>{startsVoucher ? jalali(row.voucherDate) : ''}</TableCell>
                        <TableCell>
                          <MonoCode value={row.accountCode} />
                        </TableCell>
                        <TableCell>{row.accountName || '—'}</TableCell>
                        <TableCell>{row.description || '—'}</TableCell>
                        <TableCell>
                          {startsVoucher ? (
                            <Chip
                              size="small"
                              label={getDocLifeLabel(row.docLife)}
                              color={getDocLifeTone(row.docLife)}
                            />
                          ) : (
                            ''
                          )}
                        </TableCell>
                        <TableCell align="left">
                          {row.debtor === 0 ? '—' : amount(row.debtor)}
                        </TableCell>
                        <TableCell align="left">
                          {row.creditor === 0 ? '—' : amount(row.creditor)}
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  ))}
              </TableBody>

              {rows.length > 0 && (
                <TableBody>
                  <TableRow
                    sx={{
                      '& td': {
                        fontWeight: 700,
                        borderTop: (theme) => `2px solid ${alpha(theme.palette.text.primary, 0.35)}`,
                        backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.04),
                      },
                    }}
                  >
                    <TableCell colSpan={6}>
                      جمع کل ({toPersianDigits(totalCount)} ردیف)
                    </TableCell>
                    <TableCell align="left">{amount(totalDebtor)}</TableCell>
                    <TableCell align="left">{amount(totalCreditor)}</TableCell>
                  </TableRow>
                </TableBody>
              )}
            </Table>
          </TableContainer>
        </Paper>
      </Box>

      <Box className="account-journal-no-print">
        <Pagination
          pageNumber={pageNumber}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={setPageNumber}
        />
      </Box>
    </section>
  );
}
