import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { MonoCode } from '../../components/MonoCode';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { formatLegacyJalaliDate, formatPersianDateTime } from '../../lib/format/dates';
import { formatThousands, normalizeNumericInput, toPersianDigits } from '../../lib/format/numbers';
import { pettyCashFundsApi, pettyCashSettlementApi } from './api';
import type { FinalizePettyCashSettlementResult } from './api';
import type {
  PettyCashSettlementHistoryItemDto,
  PettyCashSettlementVoucherLineDto,
} from '../../types/pettyCash';

const VOUCHER_LINE_COLUMNS: DataTableColumn<PettyCashSettlementVoucherLineDto>[] = [
  { key: 'accountCode', header: 'کد حساب', render: (row) => <MonoCode value={row.accountCode} /> },
  {
    key: 'accountTitle',
    header: 'شرح حساب',
    render: (row) => (
      <Box>
        <Typography variant="body2">{row.accountTitle ?? '—'}</Typography>
        {row.tafsilis.length > 0 && (
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap', rowGap: 0.5 }}>
            {row.tafsilis.map((t) => (
              <Chip key={t.tafsiliId} size="small" variant="outlined" label={`${t.tafsiliCode ?? ''} ${t.tafsiliTitle ?? ''}`.trim()} />
            ))}
          </Stack>
        )}
      </Box>
    ),
  },
  { key: 'debtor', header: 'بدهکار (ریال)', align: 'end', render: (row) => (row.debtor ? formatThousands(row.debtor) : '—') },
  { key: 'creditor', header: 'بستانکار (ریال)', align: 'end', render: (row) => (row.creditor ? formatThousands(row.creditor) : '—') },
];

const HISTORY_COLUMNS: DataTableColumn<PettyCashSettlementHistoryItemDto>[] = [
  {
    key: 'period',
    header: 'بازه',
    render: (row) => `${formatLegacyJalaliDate(row.periodStart)} تا ${formatLegacyJalaliDate(row.periodEnd)}`,
  },
  { key: 'openingBalance', header: 'مانده ابتدا (ریال)', align: 'end', render: (row) => formatThousands(row.openingBalance) },
  { key: 'countedBalance', header: 'مانده شمارش‌شده (ریال)', align: 'end', render: (row) => formatThousands(row.countedBalance) },
  {
    key: 'voucherDocNum',
    header: 'شمارهٔ سند',
    render: (row) =>
      row.voucherHeadId ? (
        <Button size="small" variant="text" component={RouterLink} to={`/operation/vouchers/${row.voucherHeadId}/view`}>
          {row.voucherDocNum ?? '—'}
        </Button>
      ) : (
        row.voucherDocNum ?? '—'
      ),
  },
  { key: 'finalizedByUserId', header: 'نهایی‌کننده', render: (row) => row.finalizedByUserId ?? '—' },
  { key: 'finalizedDate', header: 'تاریخ نهایی‌سازی', render: (row) => formatPersianDateTime(row.finalizedDate) },
];

/**
 * تسویهٔ دوره — بخش ۳-ب (`docs/tankhah-khazaneh-module.md` §۹، صفحهٔ ۱۰ پاورپوینت). پیش‌نمایش
 * دورهٔ جاری، ثبت شمارش صندوق و صدور سند حسابداری با نهایی‌سازی.
 *
 * ⚠️ محاسبه/تصمیم چیزی اینجا تکرار نمی‌شود — همهٔ ارقام و کنترل‌ها مستقیماً از سرور
 * (`GetPettyCashFundSettlementPreviewQuery`) می‌آیند؛ فقط نمایش و یک چک‌باکس تأیید محلی است.
 */
export function PettyCashSettlementPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();

  const [fundId, setFundId] = useState('');
  const [countedInput, setCountedInput] = useState('');
  const [acknowledgeInFlight, setAcknowledgeInFlight] = useState(false);
  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false);
  const [lastFinalized, setLastFinalized] = useState<FinalizePettyCashSettlementResult | null>(null);

  const fundsQuery = useQuery({ queryKey: ['petty-cash-funds'], queryFn: () => pettyCashFundsApi.list() });
  const funds = fundsQuery.data ?? [];

  useEffect(() => {
    if (!fundId && funds.length > 0) setFundId(funds[0].id);
  }, [fundId, funds]);

  const previewQuery = useQuery({
    queryKey: ['petty-cash-settlement', fundId],
    queryFn: () => pettyCashSettlementApi.preview(fundId),
    enabled: fundId !== '',
  });

  const historyQuery = useQuery({
    queryKey: ['petty-cash-settlements', fundId],
    queryFn: () => pettyCashSettlementApi.history(fundId),
    enabled: fundId !== '',
  });

  const preview = previewQuery.data;

  // فیلد شمارش با مقدار سرور همگام می‌شود (تا وقتی کاربر خودش دست نزده)؛ با عوض‌شدن تنخواه یا
  // دورهٔ محاسبه‌شده دوباره از صفر می‌سازیمش.
  useEffect(() => {
    setCountedInput(preview?.countedBalance != null ? String(preview.countedBalance) : '');
    setAcknowledgeInFlight(false);
    setLastFinalized(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fundId, preview?.periodId, preview?.periodStart]);

  async function invalidateAfterAction() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['petty-cash-settlement', fundId] }),
      queryClient.invalidateQueries({ queryKey: ['petty-cash-settlements', fundId] }),
      queryClient.invalidateQueries({ queryKey: ['petty-cash-funds'] }),
      queryClient.invalidateQueries({ queryKey: ['petty-cash-dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['petty-cash-expense-docs'] }),
      queryClient.invalidateQueries({ queryKey: ['petty-cash-ledger'] }),
    ]);
  }

  const countMutation = useMutation({
    mutationFn: () => pettyCashSettlementApi.count(fundId, Number(countedInput || 0)),
    onSuccess: async () => {
      await invalidateAfterAction();
      notify('شمارش صندوق ذخیره شد.');
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: () => pettyCashSettlementApi.finalize(fundId, acknowledgeInFlight),
    onSuccess: async (result) => {
      await invalidateAfterAction();
      setLastFinalized(result);
      setConfirmFinalizeOpen(false);
      notify(`دورهٔ تسویه نهایی و سند ${result.voucherDocNum} صادر شد.`);
    },
    onError: () => setConfirmFinalizeOpen(false),
  });

  const closingMatchesCounted =
    preview?.countedBalance != null && preview.countedBalance === preview.closingCashBalance;
  const countedDiff = preview?.countedBalance != null ? preview.countedBalance - preview.closingCashBalance : null;

  // کنترل‌های مسدودکننده — همهٔ چک‌های سرور به‌جز «سند در جریان» که با چک‌باکس تأیید محلی جبران
  // می‌شود (خودِ سرور هم دقیقاً همین دو راه را قبول می‌کند: صفر سند در جریان، یا acknowledge=true).
  const blockingChecks = useMemo(
    () => (preview?.checks ?? []).filter((c) => c.key !== 'inFlightAcknowledged'),
    [preview?.checks],
  );
  const allBlockingChecksOk = blockingChecks.every((c) => c.ok);
  const needsAcknowledge = (preview?.inFlightCount ?? 0) > 0;
  const finalizeDisabled =
    !preview || !allBlockingChecksOk || (needsAcknowledge && !acknowledgeInFlight) || finalizeMutation.isPending;

  return (
    <section>
      <PageHeader
        eyebrow="تنخواه و خزانه‌داری"
        icon={<EventRepeatOutlinedIcon />}
        accentColor="secondary"
        title={preview ? `تسویه دوره ${formatLegacyJalaliDate(preview.periodStart)} تا ${formatLegacyJalaliDate(preview.periodEnd)}` : 'تسویه دوره'}
        description="پیش‌نمایش دورهٔ جاری، ثبت شمارش صندوق و صدور سند حسابداری تسویه."
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <TextField
          select
          size="small"
          label="تنخواه"
          value={fundId}
          onChange={(e) => setFundId(e.target.value)}
          sx={{ minWidth: 260 }}
        >
          {funds.length === 0 && (
            <MenuItem value="" disabled>
              {fundsQuery.isLoading ? 'در حال بارگذاری…' : 'هیچ تنخواهی تعریف نشده است'}
            </MenuItem>
          )}
          {funds.map((fund) => (
            <MenuItem key={fund.id} value={fund.id}>
              {fund.code ? `${fund.code} — ` : ''}
              {fund.name}
            </MenuItem>
          ))}
        </TextField>
      </Paper>

      {previewQuery.isError && <ErrorBanner error={previewQuery.error} />}
      {countMutation.isError && <ErrorBanner error={countMutation.error} />}
      {finalizeMutation.isError && <ErrorBanner error={finalizeMutation.error} />}

      {lastFinalized && (
        <Alert severity="success" sx={{ mb: 2 }}>
          دورهٔ تسویه نهایی شد — {toPersianDigits(lastFinalized.settledDocCount)} سند تسویه شد. سند حسابداری{' '}
          <strong>{lastFinalized.voucherDocNum}</strong> صادر شد.{' '}
          <Button
            size="small"
            variant="text"
            component={RouterLink}
            to={`/operation/vouchers/${lastFinalized.voucherHeadId}/view`}
          >
            مشاهدهٔ سند
          </Button>
        </Alert>
      )}

      {!previewQuery.isError && fundId && preview && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: '100%' }}>
                <Typography variant="caption" color="text.secondary">
                  مانده ابتدای دوره
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {formatThousands(preview.openingBalance)}
                </Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: '100%' }}>
                <Typography variant="caption" color="text.secondary">
                  + ترمیم و استرداد
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {formatThousands(preview.replenishmentsAndRefunds)}
                </Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: '100%' }}>
                <Typography variant="caption" color="text.secondary">
                  − هزینهٔ تأییدشده
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {formatThousands(preview.approvedExpenses)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {toPersianDigits(preview.expenseDocIds.length)} سند
                </Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: '100%' }}>
                <Typography variant="caption" color="text.secondary">
                  = مانده نقد پایان دوره
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {formatThousands(preview.closingCashBalance)}
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {preview.inFlightCount > 0 && (
            <Alert severity="info" sx={{ mb: 3 }}>
              {toPersianDigits(preview.inFlightCount)} سند در جریان ({formatThousands(preview.inFlightAmount)} ریال) در این دوره منظور نمی‌شود و به دورهٔ بعد منتقل می‌گردد.
            </Alert>
          )}

          <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
              شمارش صندوق / حساب
            </Typography>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <TextField
                label="مبلغ شمارش‌شده (ریال)"
                size="small"
                inputMode="decimal"
                value={countedInput ? formatThousands(countedInput) : ''}
                onChange={(e) => setCountedInput(normalizeNumericInput(e.target.value))}
                sx={{ minWidth: 220 }}
              />
              <Button
                variant="outlined"
                disabled={!countedInput || countMutation.isPending}
                onClick={() => countMutation.mutate()}
              >
                {countMutation.isPending ? 'در حال ذخیره…' : 'ذخیرهٔ شمارش'}
              </Button>
              {preview.countedBalance != null && (
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: { xs: 0, sm: 1 } }}>
                  {closingMatchesCounted ? (
                    <>
                      <CheckCircleOutlineIcon fontSize="small" color="success" />
                      <Typography variant="body2" color="success.main">
                        با مانده محاسبه‌شده برابر است.
                      </Typography>
                    </>
                  ) : (
                    <>
                      <CancelOutlinedIcon fontSize="small" color="error" />
                      <Typography variant="body2" color="error.main">
                        اختلاف: {formatThousands(Math.abs(countedDiff ?? 0))} ریال
                      </Typography>
                    </>
                  )}
                </Stack>
              )}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 2 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                پیش‌نمایش سند تسویه
              </Typography>
              {preview.voucherPreview.balanced ? (
                <Chip size="small" color="success" icon={<CheckCircleOutlineIcon fontSize="small" />} label="متوازن" />
              ) : (
                <Chip size="small" color="error" icon={<CancelOutlinedIcon fontSize="small" />} label="نامتوازن" />
              )}
            </Stack>
            <DataTable
              columns={VOUCHER_LINE_COLUMNS}
              rows={preview.voucherPreview.lines}
              getRowKey={(row) => `${row.accountCodeId ?? 'no-account'}-${row.debtor}-${row.creditor}`}
              isLoading={previewQuery.isLoading}
              emptyMessage="سند تأییدشدهٔ منتظر تسویه‌ای در این دوره نیست."
            />
            <Stack direction="row" spacing={3} sx={{ justifyContent: 'flex-end', mt: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                جمع بدهکار: {formatThousands(preview.voucherPreview.totalDebtor)}
              </Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                جمع بستانکار: {formatThousands(preview.voucherPreview.totalCredit)}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              سند ترمیم (بدهکار تنخواه / بستانکار بانک) جداگانه و هنگام اجرای پرداخت خزانه صادر می‌شود.
            </Typography>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
              کنترل‌های پیش از بستن
            </Typography>
            <List dense disablePadding>
              {preview.checks.map((check) => (
                <ListItem key={check.key} disableGutters sx={{ py: 0.25 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    {check.ok ? (
                      <CheckCircleOutlineIcon fontSize="small" color="success" />
                    ) : (
                      <CancelOutlinedIcon fontSize="small" color="warning" />
                    )}
                  </ListItemIcon>
                  <ListItemText primary={check.message} slotProps={{ primary: { variant: 'body2' } }} />
                </ListItem>
              ))}
            </List>

            {needsAcknowledge && (
              <FormControlLabel
                sx={{ mt: 1.5 }}
                control={
                  <Checkbox
                    checked={acknowledgeInFlight}
                    onChange={(e) => setAcknowledgeInFlight(e.target.checked)}
                  />
                }
                label={`انتقال ${toPersianDigits(preview.inFlightCount)} سند در جریان به دورهٔ بعد را تأیید می‌کنم`}
              />
            )}

            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                color="secondary"
                disabled={finalizeDisabled}
                startIcon={finalizeMutation.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
                onClick={() => setConfirmFinalizeOpen(true)}
              >
                {finalizeMutation.isPending ? 'در حال صدور…' : 'نهایی‌سازی و صدور سند'}
              </Button>
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
              تاریخچهٔ دوره‌ها
            </Typography>
            {historyQuery.isError && <ErrorBanner error={historyQuery.error} />}
            {!historyQuery.isError && (
              <DataTable
                columns={HISTORY_COLUMNS}
                rows={historyQuery.data ?? []}
                getRowKey={(row) => row.periodId}
                isLoading={historyQuery.isLoading}
                emptyMessage="هنوز هیچ دوره‌ای نهایی نشده است."
              />
            )}
          </Paper>
        </>
      )}

      <ConfirmDialog
        open={confirmFinalizeOpen}
        title="نهایی‌سازی دورهٔ تسویه"
        description="پس از نهایی‌سازی دوره قفل می‌شود؛ اصلاح فقط با سند معکوس. ادامه می‌دهید؟"
        confirmLabel="نهایی‌سازی"
        confirmColor="primary"
        pending={finalizeMutation.isPending}
        onCancel={() => setConfirmFinalizeOpen(false)}
        onConfirm={() => finalizeMutation.mutate()}
      />
    </section>
  );
}
