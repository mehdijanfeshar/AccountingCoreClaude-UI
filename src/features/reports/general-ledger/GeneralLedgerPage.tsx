import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
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
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
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

function money(v: number): string {
  return v ? toPersianDigits(formatThousands(v)) : '—';
}

/** مانده با برچسب بد/بس (مثبت = بدهکار). */
function balance(v: number): string {
  if (!v) return '—';
  return `${toPersianDigits(formatThousands(Math.abs(v)))} ${v > 0 ? 'بد' : 'بس'}`;
}

/**
 * دفتر کل — برای هر حساب کل: ماندهٔ ابتدای دوره، سطر هر سند با ماندهٔ جاری و جمع دوره
 * (`GET /api/reports/general-ledger`). مثل سیستم قدیم فیلتر تاریخ، کد کل، شمارهٔ سند و وضعیت سند دارد و
 * مثل تراز آزمایشی دامنهٔ واحد (جاری/زیرمجموعه/کل کشور) و گروه درمانی/بیمه‌ای/ستادی.
 */
export function GeneralLedgerPage() {
  const navigate = useNavigate();
  const { financialYear, isConfigured } = useSession();
  const empty = { fromDate: '', toDate: '', fromKol: '', toKol: '', docLife: '', fromNo: '', toNo: '' };
  const [draft, setDraft] = useState(empty);
  const [applied, setApplied] = useState(empty);
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['trial-balance', 'general-ledger', financialYear, applied, page, getReportUnitScope()],
    queryFn: () => {
      const params: Record<string, string | number> = { year: financialYear, pageNumber: page, pageSize: PAGE_SIZE };
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
  });

  const data = query.data;
  const totals = (data?.accounts ?? []).reduce(
    (t, a) => ({ opening: t.opening + a.opening, debit: t.debit + a.periodDebit, credit: t.credit + a.periodCredit, closing: t.closing + a.closing }),
    { opening: 0, debit: 0, credit: 0, closing: 0 },
  );
  const names = new Map((data?.accounts ?? []).map((a) => [a.kolCode, a.kolName]));

  function apply(next = draft) {
    setApplied(next);
    setPage(1);
  }

  function onlyKol(code: string) {
    const next = { ...draft, fromKol: code, toKol: code };
    setDraft(next);
    apply(next);
  }

  return (
    <section>
      <PageHeader
        eyebrow="گزارش‌ها"
        icon={<MenuBookOutlinedIcon />}
        title="دفتر کل"
        description={`گردش هر حساب کل به تفکیک سند با ماندهٔ جاری — سال ${toPersianDigits(financialYear || '—')}.`}
        actions={
          <Button variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()} disabled={!data}>
            چاپ
          </Button>
        }
      />
      <ReportUnitScopeBar />

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }} className="no-print">
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <JalaliDateField size="small" label="از تاریخ" value={draft.fromDate} onChange={(v) => setDraft({ ...draft, fromDate: v })} />
          <JalaliDateField size="small" label="تا تاریخ" value={draft.toDate} onChange={(v) => setDraft({ ...draft, toDate: v })} />
          <TextField size="small" label="از کد کل" value={draft.fromKol} onChange={(e) => setDraft({ ...draft, fromKol: e.target.value })} sx={{ width: 120 }} />
          <TextField size="small" label="تا کد کل" value={draft.toKol} onChange={(e) => setDraft({ ...draft, toKol: e.target.value })} sx={{ width: 120 }} />
          <TextField size="small" label="از شماره سند" value={draft.fromNo} onChange={(e) => setDraft({ ...draft, fromNo: e.target.value })} sx={{ width: 130 }} />
          <TextField size="small" label="تا شماره سند" value={draft.toNo} onChange={(e) => setDraft({ ...draft, toNo: e.target.value })} sx={{ width: 130 }} />
          <TextField select size="small" label="وضعیت سند (حداقل)" value={draft.docLife} onChange={(e) => setDraft({ ...draft, docLife: e.target.value })} sx={{ minWidth: 170 }}>
            <MenuItem value="">همه</MenuItem>
            {DOC_LIFE_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={String(o.value)}>{o.label}</MenuItem>
            ))}
          </TextField>
          <Button variant="contained" onClick={() => apply()}>جستجو</Button>
          <Button onClick={() => { setDraft(empty); apply(empty); }}>پاک کردن</Button>
        </Stack>
      </Paper>

      {query.isError && <ErrorBanner error={query.error} />}
      {query.isLoading && <Typography color="text.secondary">در حال تهیهٔ گزارش…</Typography>}

      {data && (
        <>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>خلاصهٔ حساب‌های کل</Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
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
                {data.accounts.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center">سندی با این شرایط نیست.</TableCell></TableRow>
                )}
                {data.accounts.map((a) => (
                  <TableRow key={a.kolCode} hover sx={{ cursor: 'pointer' }} onClick={() => onlyKol(a.kolCode)}>
                    <TableCell>{toPersianDigits(a.kolCode)}</TableCell>
                    <TableCell>{a.kolName ?? '—'}</TableCell>
                    <TableCell align="left">{balance(a.opening)}</TableCell>
                    <TableCell align="left">{money(a.periodDebit)}</TableCell>
                    <TableCell align="left">{money(a.periodCredit)}</TableCell>
                    <TableCell align="left" sx={{ fontWeight: 700 }}>{balance(a.closing)}</TableCell>
                  </TableRow>
                ))}
                {data.accounts.length > 0 && (
                  <TableRow sx={{ '& td': { fontWeight: 800 } }}>
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

          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            گردش به تفکیک سند {applied.fromKol && applied.fromKol === applied.toKol ? `— کل ${toPersianDigits(applied.fromKol)}` : ''}
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>کد کل</TableCell>
                  <TableCell>تاریخ سند</TableCell>
                  <TableCell>شماره سند</TableCell>
                  {getReportUnitScope().unitScope !== 0 && <TableCell>واحد</TableCell>}
                  <TableCell>شرح</TableCell>
                  <TableCell align="left">بدهکار</TableCell>
                  <TableCell align="left">بستانکار</TableCell>
                  <TableCell align="left">مانده</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.rows.map((r, i) => {
                  const first = i === 0 || data.rows[i - 1].kolCode !== r.kolCode;
                  return (
                    <TableRow key={`${r.kolCode}-${r.voucherHeadId}`} hover>
                      <TableCell sx={{ fontWeight: first ? 700 : 400, color: first ? 'text.primary' : 'text.disabled' }}>
                        {toPersianDigits(r.kolCode)}{first && names.get(r.kolCode) ? ` — ${names.get(r.kolCode)}` : ''}
                      </TableCell>
                      <TableCell>{formatLegacyJalaliDate(r.dateDoc)}</TableCell>
                      <TableCell>
                        <Button size="small" onClick={() => navigate(`/operation/vouchers/${r.voucherHeadId}/view`)}>
                          {toPersianDigits(r.docNum ?? '—')}
                        </Button>
                      </TableCell>
                      {getReportUnitScope().unitScope !== 0 && <TableCell>{toPersianDigits(r.vahedCode ?? '')}</TableCell>}
                      <TableCell>{r.description ?? '—'}</TableCell>
                      <TableCell align="left">{money(r.debit)}</TableCell>
                      <TableCell align="left">{money(r.credit)}</TableCell>
                      <TableCell align="left" sx={{ fontWeight: 600 }}>{balance(r.balance)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <Pagination pageNumber={page} pageSize={PAGE_SIZE} totalCount={data.totalCount} onPageChange={setPage} />
        </>
      )}
    </section>
  );
}
