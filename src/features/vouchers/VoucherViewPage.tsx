import { Fragment, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../lib/api/client';
import { useQuery } from '@tanstack/react-query';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableContainer from '@mui/material/TableContainer';
import Paper from '@mui/material/Paper';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { PageHeader } from '../../components/PageHeader';
import { FormSectionLabel } from '../../components/FormSectionLabel';
import { FormLoadingSkeleton } from '../../components/FormLoadingSkeleton';
import { RecordMetaFooter } from '../../components/RecordMetaFooter';
import { ErrorBanner } from '../../components/ErrorBanner';
import { MonoCode } from '../../components/MonoCode';
import { toPersianDigits } from '../../lib/format/numbers';
import { useAllAccountCodes } from '../chart-of-accounts/useAllAccountCodes';
import { useSession } from '../../lib/session/SessionContext';
import { VoucherPrintSheet } from './VoucherPrintSheet';
import {
  voucherDetailsApi,
  voucherHeadsApi,
  getDocLifeLabel,
  getDocLifeTone,
  isVoucherEditable,
} from './api';

/**
 * نمایش سند — read-only view of a voucher and its articles.
 *
 * <para>
 * Exists because most vouchers in the cartable cannot be opened for editing at all: only
 * یادداشت and موقت are editable (phase 38), so without this page a reviewed or accepted voucher
 * would be a row you can see in a list and never look inside. It is a separate, much smaller page
 * rather than a read-only mode threaded through the 700-line entry form — that form is built
 * around react-hook-form, dynamic تفصیلی fields and a two-phase save, none of which a viewer
 * needs, and every one of which is a place a "read-only" flag could leak.
 * </para>
 */
export function VoucherViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { items: accountCodes } = useAllAccountCodes();
  const { unitLabel: sessionUnitLabel } = useSession();
  // `?unit=` — set by multi-unit reports (e.g. دفتر کل over «همهٔ واحدها») when the voucher belongs to
  // another unit. Sent as that unit's X-Vahed-Code; the server still checks the caller may see it.
  const [searchParams] = useSearchParams();
  const otherUnit = searchParams.get('unit') || null;

  const voucher = useQuery({
    queryKey: ['voucher-heads', id, 'with-lines', otherUnit],
    queryFn: async () => {
      const headers = otherUnit ? { 'X-Vahed-Code': otherUnit } : undefined;
      const head = await apiClient
        .get<Awaited<ReturnType<typeof voucherHeadsApi.getById>>>(`/voucher-heads/${id}`, { headers })
        .then((res) => res.data);
      const lines = await apiClient
        .get<Awaited<ReturnType<typeof voucherDetailsApi.list>>>('/voucher-details', {
          params: { pageNumber: 1, pageSize: 200, voucherHeadId: id },
          headers,
        })
        .then((res) => res.data);
      // اطلاعات تکمیلی ردیف‌ها (تفصیلی، شناسه، ویژگی، فیش، چک). خطایش نباید کل صفحه را از کار بیندازد.
      const extras = await apiClient
        .get<VoucherLineDisplay[]>(`/voucher-line-extras/vouchers/${id}/display`, { headers })
        .then((res) => (Array.isArray(res.data) ? res.data : []))
        .catch(() => [] as VoucherLineDisplay[]);
      return { head, lines: lines.items, extras: new Map(extras.map((e) => [e.detailId, e])) };
    },
    enabled: Boolean(id),
  });

  const accountLabel = useMemo(() => {
    const byId = new Map((accountCodes ?? []).map((a) => [a.id, `${a.accCode ?? ''} - ${a.accCodeName ?? ''}`]));
    return (accountId: string | null | undefined) => (accountId ? byId.get(accountId) ?? '—' : '—');
  }, [accountCodes]);

  const totals = useMemo(() => {
    const lines = voucher.data?.lines ?? [];
    return lines.reduce(
      (acc, line) => ({
        debtor: acc.debtor + Number(line.debtor ?? 0),
        creditor: acc.creditor + Number(line.creditor ?? 0),
      }),
      { debtor: 0, creditor: 0 },
    );
  }, [voucher.data]);

  if (voucher.isLoading) return <FormLoadingSkeleton />;
  if (voucher.isError) return <ErrorBanner error={voucher.error} />;

  const head = voucher.data!.head;
  const lines = voucher.data!.lines;
  const extras = voucher.data!.extras;
  const unitLabel = otherUnit ? `واحد ${otherUnit}` : sessionUnitLabel;
  // Opened from a multi-unit report for another unit's voucher: view only, no edit shortcut.
  const editable = isVoucherEditable(head.docLife) && !otherUnit;
  const isBalanced = totals.debtor === totals.creditor;

  return (
    // در چاپ فقط برگهٔ چاپی (VoucherPrintSheet، بیرون از قالب برنامه) چاپ می‌شود.
    <Box component="section">
      <PageHeader
        eyebrow="عملیات"
        icon={<DescriptionOutlinedIcon />}
        title={`نمایش سند ${head.docNum ? toPersianDigits(head.docNum) : ''}`}
        description="این صفحه فقط نمایشی است و هیچ تغییری در سند ایجاد نمی‌کند."
        actions={
          <Stack direction="row" spacing={1} sx={{ displayPrint: 'none' }}>
            {/* چاپ / PDF از مسیر چاپ مرورگر — فارسی را درست شکل می‌دهد؛ منو و دکمه‌ها چاپ نمی‌شوند. */}
            <Button variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()}>
              چاپ سند
            </Button>
            <Button
              variant="outlined"
              startIcon={<ArrowForwardOutlinedIcon />}
              onClick={() => navigate('/operation/voucher-heads')}
            >
              بازگشت به کارتابل
            </Button>
            {editable && (
              <Button
                variant="contained"
                startIcon={<EditOutlinedIcon />}
                onClick={() => navigate(`/operation/vouchers/${head.id}/edit`)}
              >
                ویرایش سند
              </Button>
            )}
          </Stack>
        }
      />

      {!editable && (
        <Alert severity="info" sx={{ mb: 2, displayPrint: 'none' }}>
          این سند در وضعیت «{getDocLifeLabel(head.docLife)}» است و قابل ویرایش یا حذف نیست. برای
          تغییر، ابتدا وضعیت آن را از کارتابل به «یادداشت» یا «موقت» برگردانید.
        </Alert>
      )}

      {/* Deliberately a Paper, not FormCard: FormCard renders a <form>, and this page has nothing
          to submit. A form element here would be markup that lies about what the page does. */}
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          '@media print': {
            border: 0,
            p: 0,
            '& .MuiTableContainer-root': { overflow: 'visible' },
            '& thead': { display: 'table-header-group' },
            '& tr': { breakInside: 'avoid' },
          },
        }}
      >
        <Grid container spacing={3}>
          <Grid size={12}>
            <FormSectionLabel label="مشخصات سند" />
          </Grid>

          <ReadOnlyField label="شماره سند" value={head.docNum ? toPersianDigits(head.docNum) : '—'} mono />
          {/* Fixed at creation; «مرتب‌سازی» changes the voucher number, never this one. */}
          <ReadOnlyField label="شماره عطف" value={head.atfNum?.trim() ? toPersianDigits(head.atfNum.trim()) : '—'} mono />
          <ReadOnlyField label="تاریخ سند" value={head.dateDoc ? toPersianDigits(head.dateDoc) : '—'} mono />
          <ReadOnlyField label="سال مالی" value={head.year ? toPersianDigits(head.year) : '—'} />
          <Grid size={{ xs: 12, sm: 3 }}>
            <FieldShell label="وضعیت">
              <Chip size="small" color={getDocLifeTone(head.docLife)} label={getDocLifeLabel(head.docLife)} />
            </FieldShell>
          </Grid>

          <ReadOnlyField label="شرح سند" value={head.headDesc || '—'} span={12} />

          <Grid size={12}>
            <FormSectionLabel label={`ردیف‌های سند (${toPersianDigits(lines.length)} ردیف)`} />
          </Grid>

          <Grid size={12}>
            <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ردیف</TableCell>
                    <TableCell>حساب معین</TableCell>
                    <TableCell>شرح</TableCell>
                    <TableCell align="left">بدهکار</TableCell>
                    <TableCell align="left">بستانکار</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lines.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        این سند هیچ ردیفی ندارد.
                      </TableCell>
                    </TableRow>
                  )}
                  {lines.map((line, index) => {
                    const extra = extras.get(line.id);
                    const hasExtra = !!extra && hasLineExtras(extra);
                    return (
                      <Fragment key={line.id}>
                        <TableRow hover sx={hasExtra ? { '& > td': { borderBottom: 0 } } : undefined}>
                          <TableCell>{toPersianDigits(index + 1)}</TableCell>
                          <TableCell>{accountLabel(line.accountId)}</TableCell>
                          <TableCell>{line.description || '—'}</TableCell>
                          <TableCell align="left">{toPersianDigits(Number(line.debtor ?? 0).toLocaleString('en-US'))}</TableCell>
                          <TableCell align="left">{toPersianDigits(Number(line.creditor ?? 0).toLocaleString('en-US'))}</TableCell>
                        </TableRow>
                        {hasExtra && (
                          <TableRow>
                            <TableCell />
                            <TableCell colSpan={4} sx={{ pt: 0 }}>
                              <LineExtrasView extra={extra} />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>

          <Grid size={12}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{ justifyContent: 'flex-end', alignItems: 'center' }}
            >
              <Box sx={{ fontSize: 13 }}>
                جمع بدهکار: <strong>{toPersianDigits(totals.debtor.toLocaleString('en-US'))}</strong>
              </Box>
              <Box sx={{ fontSize: 13 }}>
                جمع بستانکار: <strong>{toPersianDigits(totals.creditor.toLocaleString('en-US'))}</strong>
              </Box>
              {/* The backend deliberately does not enforce balance (open risk #3), so this is
                  reported rather than asserted — a voucher can genuinely be unbalanced. */}
              <Chip
                size="small"
                color={isBalanced ? 'success' : 'warning'}
                label={isBalanced ? 'سند متوازن است' : 'سند متوازن نیست'}
              />
            </Stack>
          </Grid>

          <Grid size={12}>
            <RecordMetaFooter
              createdDate={head.createdDate}
              updatedDate={head.updatedDate}
              addUserId={head.addUserId}
              changeUserId={head.changeUserId}
            />
          </Grid>
        </Grid>
      </Paper>

      <VoucherPrintSheet unitLabel={unitLabel} head={head} lines={lines} accountLabel={accountLabel} extras={extras} />
    </Box>
  );
}

interface LabeledValue {
  title: string;
  value: string | null;
}

/** پاسخ `GET voucher-line-extras/vouchers/{id}/display` — یک ردیف. */
interface VoucherLineDisplay {
  detailId: string;
  tafsilis: { levelName: string | null; code: string | null; name: string | null }[];
  attributes: LabeledValue[];
  identities: { groupTitle: string; fixedValues: LabeledValue[]; values: LabeledValue[] }[];
  receipt: { kind: number; no: string; date: string } | null;
  cheque: { no: string; date: string | null; payTo: string | null; isSori: boolean; bookTitle: string | null } | null;
}

function hasLineExtras(e: VoucherLineDisplay): boolean {
  return e.tafsilis.length > 0 || e.attributes.length > 0 || e.identities.length > 0 || !!e.receipt || !!e.cheque;
}

function joinValues(items: LabeledValue[]): string {
  return items.map((i) => `${i.title}: ${i.value?.trim() || '—'}`).join('، ');
}

/** تفصیلی‌ها، شناسه، ویژگی، فیش/حواله و چک یک ردیف — زیر همان ردیف، فقط خواندنی. */
function LineExtrasView({ extra }: { extra: VoucherLineDisplay }) {
  const rows: { label: string; text: string }[] = [];
  if (extra.tafsilis.length > 0) {
    rows.push({
      label: 'تفصیلی',
      text: extra.tafsilis
        .map((t) => `${t.levelName ? `${t.levelName}: ` : ''}${[t.code, t.name].filter(Boolean).join(' - ') || '—'}`)
        .join('، '),
    });
  }
  if (extra.attributes.length > 0) rows.push({ label: 'شناسه', text: joinValues(extra.attributes) });
  extra.identities.forEach((g) => {
    const parts = [joinValues(g.fixedValues), joinValues(g.values)].filter(Boolean);
    rows.push({ label: `ویژگی «${g.groupTitle}»`, text: parts.join(' | ') || '—' });
  });
  if (extra.receipt) {
    const kind = extra.receipt.kind === 2 ? 'حواله' : 'فیش';
    rows.push({ label: kind, text: `شماره ${extra.receipt.no} — تاریخ ${extra.receipt.date}` });
  }
  if (extra.cheque) {
    const c = extra.cheque;
    const parts = [`شماره ${c.no}`, c.date ? `تاریخ ${c.date}` : null, c.payTo ? `در وجه ${c.payTo}` : null, c.bookTitle ? `دسته‌چک ${c.bookTitle}` : null];
    rows.push({ label: c.isSori ? 'چک صوری' : 'چک', text: parts.filter(Boolean).join(' — ') });
  }

  return (
    <Stack spacing={0.5} sx={{ p: 1, borderRadius: 1, bgcolor: 'action.hover', fontSize: 12.5 }}>
      {rows.map((r, i) => (
        <Box key={i}>
          <Box component="span" sx={{ color: 'text.secondary', fontWeight: 700 }}>{r.label}: </Box>
          {toPersianDigits(r.text)}
        </Box>
      ))}
    </Stack>
  );
}

function FieldShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack spacing={0.5}>
      <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
        {label}
      </Box>
      <Box>{children}</Box>
    </Stack>
  );
}

function ReadOnlyField({
  label,
  value,
  mono = false,
  span = 3,
}: {
  label: string;
  value: string;
  mono?: boolean;
  span?: number;
}) {
  return (
    <Grid size={{ xs: 12, sm: span }}>
      <FieldShell label={label}>
        {mono ? <MonoCode value={value} /> : <Box sx={{ fontSize: 14 }}>{value}</Box>}
      </FieldShell>
    </Grid>
  );
}
