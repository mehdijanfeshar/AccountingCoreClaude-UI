import { Fragment, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
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
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { PageHeader } from '../../../components/PageHeader';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { JalaliDateField } from '../../../components/JalaliDateField';
import { Pagination } from '../../../components/Pagination';
import { useSession } from '../../../lib/session/SessionContext';
import { apiClient } from '../../../lib/api/client';
import { formatLegacyJalaliDate } from '../../../lib/format/dates';
import { formatThousands, toLatinDigits, toPersianDigits } from '../../../lib/format/numbers';
import { DOC_LIFE_OPTIONS } from '../../vouchers/api';
import { ReportUnitScopeBar, reportUnitScopeParams, getReportUnitScope } from '../_shared/reportUnitScope';

interface AccountDto {
  kolCode: string;
  kolName: string | null;
  opening: number;
  periodDebit: number;
  periodCredit: number;
  closing: number;
}

interface RowDto {
  kolCode: string;
  voucherHeadId: string;
  vahedCode: string | null;
  dateDoc: string | null;
  docNum: string | null;
  description: string | null;
  debit: number;
  credit: number;
  balance: number;
}

interface ResultDto {
  accounts: AccountDto[];
  rows: RowDto[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
}

const PAGE_SIZE = 100;

/** Shared by the dim-while-refetching transitions: crisp and short, a report is not a showpiece. */
const FADE = 'opacity 150ms cubic-bezier(0.23, 1, 0.32, 1)';

function money(v: number): string {
  return v ? toPersianDigits(formatThousands(v)) : '—';
}

/** مانده با برچسب بد/بس (مثبت = بدهکار). */
function balance(v: number): string {
  if (!v) return '—';
  return `${toPersianDigits(formatThousands(Math.abs(v)))} ${v > 0 ? 'بد' : 'بس'}`;
}

function SkeletonRows({ rows, cols }: { rows: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((__, j) => (
            <TableCell key={j}>
              <Skeleton variant="text" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/**
 * دفتر کل: برای هر حساب کل، ماندهٔ ابتدای دوره، سطر هر سند با ماندهٔ جاری و جمع دوره
 * (`GET /api/reports/general-ledger`). مثل سیستم قدیم فیلتر تاریخ، کد کل، شمارهٔ سند و وضعیت سند دارد و
 * مثل تراز آزمایشی دامنهٔ واحد (جاری/زیرمجموعه/کل کشور) و گروه درمانی/بیمه‌ای/ستادی.
 *
 * Changing a filter or page keeps the previous result on screen, dimmed, until the new one
 * arrives. Blanking the report on every page turn made the whole page jump and lost the reader's
 * place for no reason.
 */
export function GeneralLedgerPage() {
  const navigate = useNavigate();
  const { financialYear, isConfigured } = useSession();
  const empty = { fromDate: '', toDate: '', fromKol: '', toKol: '', docLife: '', fromNo: '', toNo: '' };
  const [draft, setDraft] = useState(empty);
  const [applied, setApplied] = useState(empty);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const query = useQuery({
    queryKey: ['trial-balance', 'general-ledger', financialYear, applied, page, pageSize, getReportUnitScope()],
    queryFn: () => {
      const params: Record<string, string | number> = { year: financialYear, pageNumber: page, pageSize };
      if (applied.fromDate) params.fromDate = applied.fromDate;
      if (applied.toDate) params.toDate = applied.toDate;
      if (applied.fromKol) params.fromKol = toLatinDigits(applied.fromKol);
      if (applied.toKol) params.toKol = toLatinDigits(applied.toKol);
      if (applied.docLife) params.docLife = Number(applied.docLife);
      if (applied.fromNo) params.fromVoucherNo = toLatinDigits(applied.fromNo);
      if (applied.toNo) params.toVoucherNo = toLatinDigits(applied.toNo);
      return apiClient
        .get<ResultDto>('/reports/general-ledger', { params: { ...params, ...reportUnitScopeParams() } })
        .then((r) => r.data);
    },
    enabled: isConfigured && !!financialYear,
    placeholderData: (previous) => previous,
  });

  const data = query.data;
  const refreshing = query.isFetching && !query.isLoading;
  const showUnit = getReportUnitScope().unitScope !== 0;
  const detailCols = showUnit ? 7 : 6;

  const totals = (data?.accounts ?? []).reduce(
    (t, a) => ({ opening: t.opening + a.opening, debit: t.debit + a.periodDebit, credit: t.credit + a.periodCredit, closing: t.closing + a.closing }),
    { opening: 0, debit: 0, credit: 0, closing: 0 },
  );
  const accountsByKol = new Map((data?.accounts ?? []).map((a) => [a.kolCode, a]));
  const singleKol = applied.fromKol && applied.fromKol === applied.toKol ? applied.fromKol : '';

  function apply(next = draft) {
    setApplied(next);
    setPage(1);
  }

  function submitFilters(e: FormEvent) {
    // A form, so Enter in any filter field runs the report, as it does in every search box.
    e.preventDefault();
    apply();
  }

  function onlyKol(code: string) {
    const next = { ...draft, fromKol: code, toKol: code };
    setDraft(next);
    apply(next);
  }

  function allKols() {
    const next = { ...draft, fromKol: '', toKol: '' };
    setDraft(next);
    apply(next);
  }

  function onAccountKey(e: KeyboardEvent, code: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onlyKol(code);
    }
  }

  function voucherHref(r: RowDto) {
    return `/operation/vouchers/${r.voucherHeadId}/view${showUnit && r.vahedCode ? `?unit=${encodeURIComponent(r.vahedCode)}` : ''}`;
  }

  return (
    <Box component="section" sx={{ '@media print': { '& .no-print': { display: 'none' } } }}>
      <PageHeader
        icon={<MenuBookOutlinedIcon />}
        title="دفتر کل"
        description={`گردش هر حساب کل به تفکیک سند، با ماندهٔ جاری. سال مالی ${toPersianDigits(financialYear || '-')}.`}
        actions={
          <Button variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()} disabled={!data} className="no-print">
            چاپ
          </Button>
        }
      />
      <Box className="no-print">
        <ReportUnitScopeBar />
      </Box>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }} className="no-print" component="form" onSubmit={submitFilters}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap', alignItems: { md: 'center' } }}>
          <JalaliDateField size="small" label="از تاریخ" value={draft.fromDate} onChange={(v) => setDraft({ ...draft, fromDate: v })} />
          <JalaliDateField size="small" label="تا تاریخ" value={draft.toDate} onChange={(v) => setDraft({ ...draft, toDate: v })} />
          <TextField size="small" label="از کد کل" value={draft.fromKol} onChange={(e) => setDraft({ ...draft, fromKol: e.target.value })} sx={{ width: { md: 120 } }} />
          <TextField size="small" label="تا کد کل" value={draft.toKol} onChange={(e) => setDraft({ ...draft, toKol: e.target.value })} sx={{ width: { md: 120 } }} />
          <TextField size="small" label="از شماره سند" value={draft.fromNo} onChange={(e) => setDraft({ ...draft, fromNo: e.target.value })} sx={{ width: { md: 130 } }} />
          <TextField size="small" label="تا شماره سند" value={draft.toNo} onChange={(e) => setDraft({ ...draft, toNo: e.target.value })} sx={{ width: { md: 130 } }} />
          <TextField select size="small" label="وضعیت سند (حداقل)" value={draft.docLife} onChange={(e) => setDraft({ ...draft, docLife: e.target.value })} sx={{ minWidth: 170 }}>
            <MenuItem value="">همه</MenuItem>
            {DOC_LIFE_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={String(o.value)}>{o.label}</MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1}>
            <Button type="submit" variant="contained" startIcon={<SearchOutlinedIcon />} disabled={!isConfigured}>
              جستجو
            </Button>
            <Button onClick={() => { setDraft(empty); apply(empty); }}>پاک کردن</Button>
          </Stack>
        </Stack>
      </Paper>

      {query.isError && <ErrorBanner error={query.error} />}

      {(query.isLoading || data) && (
        <>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', mb: 1.25 }}>
            <Typography variant="h3" component="h2">خلاصهٔ حساب‌های کل</Typography>
            {data && data.accounts.length > 1 && (
              <Typography variant="body2" color="text.secondary" className="no-print">
                برای دیدن گردش یک حساب، روی آن کلیک کنید.
              </Typography>
            )}
          </Stack>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 4, opacity: refreshing ? 0.55 : 1, transition: FADE }} aria-busy={query.isFetching}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>کد کل</TableCell>
                  <TableCell>نام حساب</TableCell>
                  <TableCell align="left">ماندهٔ ابتدای دوره</TableCell>
                  <TableCell align="left">گردش بدهکار</TableCell>
                  <TableCell align="left">گردش بستانکار</TableCell>
                  <TableCell align="left">ماندهٔ پایان دوره</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {query.isLoading && <SkeletonRows rows={4} cols={6} />}
                {data && data.accounts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                      سندی با این شرایط پیدا نشد. بازهٔ تاریخ یا کد کل را بازتر کنید.
                    </TableCell>
                  </TableRow>
                )}
                {data?.accounts.map((a) => {
                  const selected = singleKol === a.kolCode;
                  return (
                    <TableRow
                      key={a.kolCode}
                      hover
                      selected={selected}
                      tabIndex={0}
                      aria-label={`نمایش گردش حساب کل ${a.kolCode}`}
                      onClick={() => onlyKol(a.kolCode)}
                      onKeyDown={(e) => onAccountKey(e, a.kolCode)}
                      sx={{
                        cursor: 'pointer',
                        '&:focus-visible': { outline: (t) => `2px solid ${t.palette.primary.main}`, outlineOffset: -2 },
                      }}
                    >
                      <TableCell sx={{ fontWeight: 600 }}>{toPersianDigits(a.kolCode)}</TableCell>
                      <TableCell>{a.kolName ?? '—'}</TableCell>
                      <TableCell align="left">{balance(a.opening)}</TableCell>
                      <TableCell align="left">{money(a.periodDebit)}</TableCell>
                      <TableCell align="left">{money(a.periodCredit)}</TableCell>
                      <TableCell align="left" sx={{ fontWeight: 700 }}>{balance(a.closing)}</TableCell>
                    </TableRow>
                  );
                })}
                {data && data.accounts.length > 1 && (
                  <TableRow sx={{ '& td': { fontWeight: 800, borderTop: '3px double', borderTopColor: 'text.secondary', bgcolor: 'grey.50' } }}>
                    <TableCell colSpan={2}>جمع</TableCell>
                    <TableCell align="left">{balance(totals.opening)}</TableCell>
                    <TableCell align="left">{money(totals.debit)}</TableCell>
                    <TableCell align="left">{money(totals.credit)}</TableCell>
                    <TableCell align="left">{balance(totals.closing)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.25, minHeight: 32 }}>
            <Typography variant="h3" component="h2">گردش به تفکیک سند</Typography>
            {singleKol && (
              <Chip
                size="small"
                color="primary"
                label={`فقط کل ${toPersianDigits(singleKol)}`}
                onDelete={allKols}
                className="no-print"
              />
            )}
          </Stack>
          {/* Header stays put while scrolling a long ledger; the column names are what give the
              numbers meaning, and a 100-row page is far taller than the screen. */}
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ maxHeight: { md: '70vh' }, opacity: refreshing ? 0.55 : 1, transition: FADE, '@media print': { maxHeight: 'none' } }}
            aria-busy={query.isFetching}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>تاریخ سند</TableCell>
                  <TableCell>شماره سند</TableCell>
                  {showUnit && <TableCell>واحد</TableCell>}
                  <TableCell>شرح</TableCell>
                  <TableCell align="left">بدهکار</TableCell>
                  <TableCell align="left">بستانکار</TableCell>
                  <TableCell align="left">مانده</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {query.isLoading && <SkeletonRows rows={8} cols={detailCols} />}
                {data && data.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={detailCols} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                      گردشی برای نمایش نیست.
                    </TableCell>
                  </TableRow>
                )}
                {data?.rows.map((r, i) => {
                  // Each account opens with its own heading row instead of repeating the code, greyed
                  // out, on every line: the code says which account once, and the opening balance it
                  // carries is the figure the running balance below starts from.
                  const first = i === 0 || data.rows[i - 1].kolCode !== r.kolCode;
                  const account = accountsByKol.get(r.kolCode);
                  return (
                    <Fragment key={`${r.kolCode}-${r.voucherHeadId}`}>
                      {first && (
                        <TableRow>
                          <TableCell colSpan={detailCols - 1} sx={{ bgcolor: 'grey.100', fontWeight: 700, py: 1 }}>
                            کل {toPersianDigits(r.kolCode)}
                            {account?.kolName && (
                              <Box component="span" sx={{ fontWeight: 500, color: 'text.secondary', marginInlineStart: 8 }}>
                                {account.kolName}
                              </Box>
                            )}
                          </TableCell>
                          <TableCell align="left" sx={{ bgcolor: 'grey.100', py: 1, whiteSpace: 'nowrap' }}>
                            <Typography component="span" variant="caption" color="text.secondary" sx={{ marginInlineEnd: 8 }}>
                              ابتدای دوره
                            </Typography>
                            <Box component="span" sx={{ fontWeight: 600 }}>{balance(account?.opening ?? 0)}</Box>
                          </TableCell>
                        </TableRow>
                      )}
                      <TableRow hover>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatLegacyJalaliDate(r.dateDoc)}</TableCell>
                        <TableCell>
                          {/* A real link: middle-click and «open in new tab» work, and the ledger
                              keeps its place when the user comes back. */}
                          <Link
                            href={voucherHref(r)}
                            underline="hover"
                            sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
                            onClick={(e) => {
                              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                              e.preventDefault();
                              navigate(voucherHref(r));
                            }}
                          >
                            {toPersianDigits(r.docNum ?? '-')}
                          </Link>
                        </TableCell>
                        {showUnit && <TableCell>{toPersianDigits(r.vahedCode ?? '')}</TableCell>}
                        <TableCell>{r.description ?? '—'}</TableCell>
                        <TableCell align="left">{money(r.debit)}</TableCell>
                        <TableCell align="left">{money(r.credit)}</TableCell>
                        <TableCell align="left" sx={{ fontWeight: 600 }}>{balance(r.balance)}</TableCell>
                      </TableRow>
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          {data && (
            <Box className="no-print">
              <Pagination
                pageNumber={page}
                pageSize={pageSize}
                totalCount={data.totalCount}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
