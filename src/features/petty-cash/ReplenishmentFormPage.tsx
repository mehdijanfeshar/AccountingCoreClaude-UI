import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import DateObject from 'react-date-object';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import CurrencyExchangeOutlinedIcon from '@mui/icons-material/CurrencyExchangeOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import RadioButtonUncheckedOutlinedIcon from '@mui/icons-material/RadioButtonUncheckedOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { PageHeader } from '../../components/PageHeader';
import { FormCard } from '../../components/FormCard';
import { FormActions } from '../../components/FormActions';
import { FormLoadingSkeleton } from '../../components/FormLoadingSkeleton';
import { FormSectionLabel } from '../../components/FormSectionLabel';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { JalaliDateField } from '../../components/JalaliDateField';
import { LinkedEntityPickerField } from '../../components/LinkedEntityPickerField';
import { BankAccountPickerDialog } from '../../components/BankAccountPickerDialog';
import { MonoCode } from '../../components/MonoCode';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { useSession } from '../../lib/session/SessionContext';
import { toLatinDigits, toPersianDigits, formatThousands } from '../../lib/format/numbers';
import { formatPersianDateTime } from '../../lib/format/dates';
import { pettyCashFundsApi, pettyCashReplenishmentsApi } from './api';
import { PETTY_CASH_PAYMENT_METHOD_OPTIONS, getPaymentMethodLabel } from './pettyCashPaymentMethod';
import {
  PETTY_CASH_REPLENISHMENT_STATE,
  getReplenishmentStateLabel,
  isReplenishmentDraft,
} from './pettyCashReplenishmentState';
import {
  buildEmptyReplenishmentFormValues,
  replenishmentFormSchema,
  replenishmentFormValuesToPayload,
  type ReplenishmentFormValues,
} from './schema';
import type { BankAccountDto } from '../../types/bankAccount';
import type { PettyCashReplenishmentLineDto } from '../../types/pettyCash';

function todayLegacyJalali(): string {
  return toLatinDigits(new DateObject({ calendar: persian, locale: persian_fa }).format('YYYYMMDD'));
}

function percentOf(amount: number, ceiling: number): number {
  if (!ceiling) return 0;
  return Math.round((amount / ceiling) * 100);
}

const LINE_COLUMNS: DataTableColumn<PettyCashReplenishmentLineDto>[] = [
  { key: 'accountCode', header: 'کد حساب', render: (row) => <MonoCode value={row.accountCode} /> },
  { key: 'accountTitle', header: 'عنوان حساب هزینه', render: (row) => row.accountTitle ?? '—' },
  { key: 'docCount', header: 'تعداد سند', align: 'end', render: (row) => toPersianDigits(row.docCount) },
  { key: 'amount', header: 'مبلغ (ریال)', align: 'end', render: (row) => formatThousands(row.amount) },
];

/**
 * درخواست ترمیم/شارژ تنخواه — بخش ۳-الف (`docs/tankhah-khazaneh-module.md` §۹، صفحهٔ ۹ پاورپوینت).
 * هندل می‌کند `/treasury/petty-cash/replenishments/new?fundId=` (ساخت) و `/:id` (مشاهده/اقدام).
 *
 * ⚠️ کارت «اثر ترمیم» فقط در حالت ساخت (پیش از ارسال) از `replenishment-preview` محاسبه می‌شود —
 * دقیقاً همان عددی که `create` می‌سازد (`PettyCashReplenishmentPreviewDto` XML doc). در حالت
 * مشاهده، کارت‌های بالا از وضعیت *فعلی* تنخواه‌اند، نه یک عکس لحظه‌ای از زمان ساخت این ترمیم.
 */
export function ReplenishmentFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isView = Boolean(id);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { financialYear } = useSession();

  const [selectedFundId, setSelectedFundId] = useState(searchParams.get('fundId') ?? '');
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  const fundsQuery = useQuery({ queryKey: ['petty-cash-funds'], queryFn: () => pettyCashFundsApi.list() });
  const funds = fundsQuery.data ?? [];

  const existingQuery = useQuery({
    queryKey: ['petty-cash-replenishments', id],
    queryFn: () => pettyCashReplenishmentsApi.getById(id as string),
    enabled: isView,
  });

  const fundId = isView ? existingQuery.data?.fundId ?? '' : selectedFundId;
  const selectedFund = useMemo(() => funds.find((f) => f.id === fundId) ?? null, [funds, fundId]);

  const previewQuery = useQuery({
    queryKey: ['petty-cash-replenishment-preview', fundId],
    queryFn: () => pettyCashReplenishmentsApi.preview(fundId),
    enabled: !isView && fundId !== '',
  });

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ReplenishmentFormValues>({
    resolver: zodResolver(replenishmentFormSchema),
    defaultValues: buildEmptyReplenishmentFormValues(todayLegacyJalali()),
  });

  const sourceBankAccountLabel = watch('sourceBankAccountLabel');

  function handlePickBankAccount(account: BankAccountDto) {
    setValue('sourceBankAccountId', account.id, { shouldDirty: true });
    setValue('sourceBankAccountLabel', `${account.accountNumber ?? ''} — ${account.accountHolder ?? ''}`, {
      shouldDirty: true,
    });
  }

  async function invalidateAfterAction() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['petty-cash-replenishments'] }),
      queryClient.invalidateQueries({ queryKey: ['petty-cash-replenishment-preview'] }),
      queryClient.invalidateQueries({ queryKey: ['petty-cash-funds'] }),
      queryClient.invalidateQueries({ queryKey: ['petty-cash-dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['petty-cash-ledger'] }),
      queryClient.invalidateQueries({ queryKey: ['petty-cash-expense-docs'] }),
    ]);
  }

  const createMutation = useMutation({
    mutationFn: async (vars: { values: ReplenishmentFormValues; submit: boolean }) => {
      const payload = replenishmentFormValuesToPayload(vars.values, fundId, financialYear || '', vars.submit);
      return pettyCashReplenishmentsApi.create(payload);
    },
    onSuccess: async (result, vars) => {
      await invalidateAfterAction();
      notify(vars.submit ? 'درخواست ترمیم ارسال شد.' : 'درخواست ترمیم به‌صورت پیش‌نویس ذخیره شد.');
      navigate(`/treasury/petty-cash/replenishments/${result.id}`);
    },
    onError: setSubmitError,
  });

  function onSaveDraft(values: ReplenishmentFormValues) {
    setSubmitError(null);
    createMutation.mutate({ values, submit: false });
  }

  function onSubmitForApproval(values: ReplenishmentFormValues) {
    setSubmitError(null);
    createMutation.mutate({ values, submit: true });
  }

  const submitMutation = useMutation({
    mutationFn: () => pettyCashReplenishmentsApi.submit(id as string),
    onSuccess: async () => {
      await invalidateAfterAction();
      notify('درخواست ترمیم برای تأیید ارسال شد.');
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => pettyCashReplenishmentsApi.approve(id as string),
    onSuccess: async () => {
      await invalidateAfterAction();
      notify('ترمیم تأیید شد.');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (note?: string) => pettyCashReplenishmentsApi.reject(id as string, note),
    onSuccess: async () => {
      await invalidateAfterAction();
      notify('ترمیم رد شد.');
      setRejectOpen(false);
      setRejectNote('');
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: () => pettyCashReplenishmentsApi.recordPayment(id as string),
    onSuccess: async () => {
      await invalidateAfterAction();
      notify('پرداخت ترمیم ثبت شد.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => pettyCashReplenishmentsApi.remove(id as string),
    onSuccess: async () => {
      await invalidateAfterAction();
      notify('درخواست ترمیم حذف شد.');
      navigate('/treasury/petty-cash/replenishments');
    },
  });

  const replenishment = existingQuery.data;
  const state = replenishment?.state;

  // کارت‌های بالا: در حالت ساخت از `replenishment-preview`؛ در حالت مشاهده از وضعیت فعلی تنخواه
  // (`selectedFund`، برگرفته از `GET funds`) — چون `PettyCashReplenishmentDto` این ارقام را
  // نگه نمی‌دارد (فقط خطوط/مبلغ خودِ همین ترمیم را snapshot کرده).
  const ceiling = selectedFund?.ceiling ?? previewQuery.data?.ceiling ?? 0;
  const cashBalance = isView ? selectedFund?.cashBalance ?? 0 : previewQuery.data?.cashBalance ?? 0;
  const approvedAmount = isView ? selectedFund?.approvedAmount ?? 0 : previewQuery.data?.approvedAmount ?? 0;
  const approvedCount = isView ? selectedFund?.approvedCount ?? 0 : previewQuery.data?.approvedCount ?? 0;
  const inFlightAmount = isView ? selectedFund?.inFlightAmount ?? 0 : previewQuery.data?.inFlightAmount ?? 0;
  const inFlightCount = isView ? selectedFund?.inFlightCount ?? 0 : previewQuery.data?.inFlightCount ?? 0;
  const lines = isView ? replenishment?.lines ?? [] : previewQuery.data?.lines ?? [];
  const totalAmount = isView ? replenishment?.totalAmount ?? 0 : previewQuery.data?.totalAmount ?? 0;

  // اثر ترمیم — فقط در حالت ساخت، مستقیماً از پیش‌نمایش (دقیقاً همان چیزی که `create` می‌سازد).
  const balanceAfter = previewQuery.data?.balanceAfter ?? null;

  const pending = createMutation.isPending;

  if (isView && existingQuery.isLoading) return <FormLoadingSkeleton />;
  if (isView && existingQuery.isError) return <ErrorBanner error={existingQuery.error} />;

  return (
    <section>
      <PageHeader
        eyebrow="تنخواه و خزانه‌داری"
        icon={<CurrencyExchangeOutlinedIcon />}
        accentColor="secondary"
        title={isView ? `ترمیم ${replenishment?.code ?? ''}` : 'درخواست ترمیم جدید'}
        description={
          isView
            ? `تنخواه ${replenishment?.fundName ?? ''} — وضعیت: ${getReplenishmentStateLabel(state)}`
            : 'ساخت درخواست ترمیم از اسناد تأییدشدهٔ منتظر ترمیم یک تنخواه.'
        }
      />

      {isView && replenishment?.state === PETTY_CASH_REPLENISHMENT_STATE.rejected && (
        <Alert severity="error" sx={{ mb: 2 }}>
          این درخواست ترمیم ردشده است.
        </Alert>
      )}

      {submitError !== null && <ErrorBanner error={submitError} />}

      {!isView && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
          <TextField
            select
            size="small"
            required
            label="تنخواه"
            value={selectedFundId}
            onChange={(e) => setSelectedFundId(e.target.value)}
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
      )}

      {fundId && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: '100%' }}>
                <Typography variant="caption" color="text.secondary">
                  سقف مصوب
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {formatThousands(ceiling)}
                </Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: '100%' }}>
                <Typography variant="caption" color="text.secondary">
                  موجودی نقد
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {formatThousands(cashBalance)}
                </Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: '100%' }}>
                <Typography variant="caption" color="text.secondary">
                  تأییدشده منتظر ترمیم
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {formatThousands(approvedAmount)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {toPersianDigits(approvedCount)} سند
                </Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: '100%' }}>
                <Typography variant="caption" color="text.secondary">
                  در جریان
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {formatThousands(inFlightAmount)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {toPersianDigits(inFlightCount)} سند — در این ترمیم نیست
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
              مبلغ ترمیم بر اساس اسناد تأییدشده
            </Typography>
            <DataTable
              columns={LINE_COLUMNS}
              rows={lines}
              getRowKey={(row) => row.accountCodeId ?? 'no-account'}
              isLoading={!isView && previewQuery.isLoading}
              emptyMessage="سند تأییدشدهٔ منتظر ترمیمی وجود ندارد."
            />
            <Stack direction="row" sx={{ justifyContent: 'flex-end', mt: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                جمع: {formatThousands(totalAmount)} ریال
              </Typography>
            </Stack>
          </Paper>

          {!isView && (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 8 }}>
                <FormCard accentColor="secondary" watermarkIcon={<CurrencyExchangeOutlinedIcon />} onSubmit={handleSubmit(onSubmitForApproval)}>
                  <Grid container spacing={3}>
                    <Grid size={12}>
                      <FormSectionLabel label="اطلاعات ترمیم" accentColor="secondary" />
                    </Grid>

                    <LinkedEntityPickerField
                      icon={<AccountBalanceOutlinedIcon fontSize="small" color="action" />}
                      label="حساب بانکی مبدأ"
                      value={sourceBankAccountLabel}
                      required
                      error={!!errors.sourceBankAccountId}
                      helperText={errors.sourceBankAccountId?.message}
                      placeholder="انتخاب نشده"
                      pickButtonLabel="انتخاب حساب بانکی"
                      onPick={() => setBankPickerOpen(true)}
                    />

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Controller
                        control={control}
                        name="paymentMethod"
                        render={({ field }) => (
                          <TextField
                            select
                            fullWidth
                            required
                            label="روش پرداخت"
                            value={field.value}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                            error={!!errors.paymentMethod}
                            helperText={errors.paymentMethod?.message}
                          >
                            {PETTY_CASH_PAYMENT_METHOD_OPTIONS.map((option) => (
                              <MenuItem key={option.value} value={option.value}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </TextField>
                        )}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Controller
                        control={control}
                        name="registerDate"
                        render={({ field }) => (
                          <JalaliDateField
                            label="تاریخ ثبت"
                            value={field.value}
                            onChange={field.onChange}
                            required
                            error={!!errors.registerDate}
                            helperText={errors.registerDate?.message}
                          />
                        )}
                      />
                    </Grid>
                    <Grid size={12}>
                      <Controller
                        control={control}
                        name="note"
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="یادداشت (اختیاری)"
                            fullWidth
                            multiline
                            minRows={2}
                            slotProps={{ htmlInput: { maxLength: 1000 } }}
                            error={!!errors.note}
                            helperText={errors.note?.message}
                          />
                        )}
                      />
                    </Grid>

                    <Grid size={12}>
                      <FormActions
                        onCancel={() => navigate('/treasury/petty-cash/replenishments')}
                        pending={pending}
                        submitLabel="ارسال برای تأیید"
                        extra={
                          <Button type="button" variant="outlined" disabled={pending} onClick={handleSubmit(onSaveDraft)}>
                            ذخیره پیش‌نویس
                          </Button>
                        }
                      />
                    </Grid>
                  </Grid>
                </FormCard>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <ReplenishmentEffectCard ceiling={ceiling} cashBalance={cashBalance} balanceAfter={balanceAfter} />
                <Box sx={{ mt: 2 }}>
                  <ApprovalPathCard state={null} />
                </Box>
              </Grid>
            </Grid>
          )}

          {isView && replenishment && (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 8 }}>
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                  <FormSectionLabel label="اطلاعات ترمیم" accentColor="secondary" />
                  <Grid container spacing={2} sx={{ mt: 0.5 }}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        حساب بانکی مبدأ
                      </Typography>
                      <Typography variant="body2">{replenishment.sourceBankAccountNumber ?? '—'}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        روش پرداخت
                      </Typography>
                      <Typography variant="body2">{getPaymentMethodLabel(replenishment.paymentMethod)}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        تاریخ ایجاد
                      </Typography>
                      <Typography variant="body2">{formatPersianDateTime(replenishment.createdDate)}</Typography>
                    </Grid>
                    {replenishment.paidDate && (
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          تاریخ پرداخت
                        </Typography>
                        <Typography variant="body2">{formatPersianDateTime(replenishment.paidDate)}</Typography>
                      </Grid>
                    )}
                    {replenishment.note && (
                      <Grid size={12}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          یادداشت
                        </Typography>
                        <Typography variant="body2">{replenishment.note}</Typography>
                      </Grid>
                    )}
                  </Grid>

                  {submitMutation.error && <ErrorBanner error={submitMutation.error} />}
                  {approveMutation.error && <ErrorBanner error={approveMutation.error} />}
                  {recordPaymentMutation.error && <ErrorBanner error={recordPaymentMutation.error} />}
                  {deleteMutation.error && <ErrorBanner error={deleteMutation.error} />}

                  <Stack direction="row" spacing={1} sx={{ mt: 3, flexWrap: 'wrap' }}>
                    {isReplenishmentDraft(state) && (
                      <>
                        <Button
                          variant="contained"
                          color="secondary"
                          startIcon={<SendOutlinedIcon />}
                          disabled={submitMutation.isPending}
                          onClick={() => submitMutation.mutate()}
                        >
                          {submitMutation.isPending ? 'در حال ارسال…' : 'ارسال برای تأیید'}
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          startIcon={<DeleteOutlineIcon />}
                          onClick={() => setPendingDelete(true)}
                        >
                          حذف
                        </Button>
                      </>
                    )}
                    {state === PETTY_CASH_REPLENISHMENT_STATE.pendingFinanceManager && (
                      <>
                        <Button
                          variant="contained"
                          color="success"
                          startIcon={<CheckCircleOutlineIcon />}
                          disabled={approveMutation.isPending}
                          onClick={() => approveMutation.mutate()}
                        >
                          {approveMutation.isPending ? 'در حال تأیید…' : 'تأیید'}
                        </Button>
                        <Button variant="outlined" color="error" startIcon={<CancelOutlinedIcon />} onClick={() => setRejectOpen(true)}>
                          رد
                        </Button>
                      </>
                    )}
                    {state === PETTY_CASH_REPLENISHMENT_STATE.pendingTreasurer && (
                      <>
                        <Tooltip title="موقت است — سند حسابداری واقعی این پرداخت در بخش خزانه (بخش ۴+) صادر می‌شود.">
                          <span>
                            <Button
                              variant="contained"
                              color="success"
                              startIcon={<PaymentsOutlinedIcon />}
                              disabled={recordPaymentMutation.isPending}
                              onClick={() => recordPaymentMutation.mutate()}
                            >
                              {recordPaymentMutation.isPending ? 'در حال ثبت…' : 'ثبت پرداخت'}
                            </Button>
                          </span>
                        </Tooltip>
                        <Button variant="outlined" color="error" startIcon={<CancelOutlinedIcon />} onClick={() => setRejectOpen(true)}>
                          رد
                        </Button>
                      </>
                    )}
                  </Stack>
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <ApprovalPathCard state={state ?? null} />
              </Grid>
            </Grid>
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingDelete}
        title="حذف درخواست ترمیم"
        description={`درخواست ترمیم «${replenishment?.code ?? ''}» حذف می‌شود. ادامه می‌دهید؟`}
        pending={deleteMutation.isPending}
        confirmLabel="حذف"
        onCancel={() => setPendingDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
      />

      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>رد درخواست ترمیم</DialogTitle>
        <DialogContent>
          {rejectMutation.error && <ErrorBanner error={rejectMutation.error} />}
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            label="یادداشت (اختیاری)"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(false)} color="inherit" disabled={rejectMutation.isPending}>
            انصراف
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={rejectMutation.isPending}
            onClick={() => rejectMutation.mutate(rejectNote.trim() || undefined)}
          >
            {rejectMutation.isPending ? 'در حال ثبت…' : 'رد درخواست'}
          </Button>
        </DialogActions>
      </Dialog>

      <BankAccountPickerDialog
        open={bankPickerOpen}
        title="انتخاب حساب بانکی مبدأ"
        onClose={() => setBankPickerOpen(false)}
        onSelect={handlePickBankAccount}
      />
    </section>
  );
}

interface ReplenishmentEffectCardProps {
  ceiling: number;
  cashBalance: number;
  balanceAfter: number | null;
}

/** کارت «اثر ترمیم» — موجودی قبل → بعد، ٪ سقف، و دو کنترل نمایشی (منبع حقیقت هر دو سمت سرور است). */
function ReplenishmentEffectCard({ ceiling, cashBalance, balanceAfter }: ReplenishmentEffectCardProps) {
  const afterOk = balanceAfter == null ? null : balanceAfter <= ceiling;
  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
        اثر ترمیم
      </Typography>
      <Stack spacing={0.75}>
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">
            موجودی نقد قبل
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {formatThousands(cashBalance)} ({toPersianDigits(percentOf(cashBalance, ceiling))}٪ سقف)
          </Typography>
        </Stack>
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            موجودی نقد بعد
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {balanceAfter != null
              ? `${formatThousands(balanceAfter)} (${toPersianDigits(percentOf(balanceAfter, ceiling))}٪ سقف)`
              : '—'}
          </Typography>
        </Stack>
      </Stack>
      <Divider sx={{ my: 2 }} />
      <List dense disablePadding>
        <ListItem disableGutters sx={{ py: 0.25 }}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            {afterOk === null ? (
              <RadioButtonUncheckedOutlinedIcon fontSize="small" color="disabled" />
            ) : afterOk ? (
              <CheckCircleOutlineIcon fontSize="small" color="success" />
            ) : (
              <CancelOutlinedIcon fontSize="small" color="error" />
            )}
          </ListItemIcon>
          <ListItemText primary="در حد سقف مصوب" slotProps={{ primary: { variant: 'body2' } }} />
        </ListItem>
        <ListItem disableGutters sx={{ py: 0.25 }}>
          <ListItemIcon sx={{ minWidth: 32 }}>
            <CheckCircleOutlineIcon fontSize="small" color="success" />
          </ListItemIcon>
          <ListItemText
            primary="هیچ سندی دو بار ترمیم نمی‌شود"
            slotProps={{ primary: { variant: 'body2' } }}
          />
        </ListItem>
      </List>
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
        این‌ها فقط راهنمای سریع‌اند؛ تصمیم نهایی همیشه از سرور می‌آید.
      </Typography>
    </Paper>
  );
}

interface ApprovalPathCardProps {
  state: number | null;
}

/** «مسیر تأیید: ۱. مدیر مالی ← ۲. خزانه‌دار» — مرحلهٔ فعلی هایلایت می‌شود. */
function ApprovalPathCard({ state }: ApprovalPathCardProps) {
  const financeManagerDone = state != null && state >= PETTY_CASH_REPLENISHMENT_STATE.pendingTreasurer;
  const financeManagerActive = state === PETTY_CASH_REPLENISHMENT_STATE.pendingFinanceManager;
  const treasurerDone = state === PETTY_CASH_REPLENISHMENT_STATE.paid;
  const treasurerActive = state === PETTY_CASH_REPLENISHMENT_STATE.pendingTreasurer;
  const rejected = state === PETTY_CASH_REPLENISHMENT_STATE.rejected;

  function stepChip(label: string, done: boolean, active: boolean) {
    return (
      <Chip
        size="small"
        color={done ? 'success' : active ? 'primary' : 'default'}
        variant={active ? 'filled' : 'outlined'}
        icon={done ? <CheckCircleOutlineIcon fontSize="small" /> : undefined}
        label={label}
      />
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
        مسیر تأیید
      </Typography>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        {stepChip('۱. مدیر مالی', financeManagerDone, financeManagerActive)}
        <Box component="span" sx={{ color: 'text.disabled' }}>
          ←
        </Box>
        {stepChip('۲. خزانه‌دار', treasurerDone, treasurerActive)}
      </Stack>
      {rejected && (
        <Chip size="small" color="error" label="ردشده" sx={{ mt: 1.5 }} icon={<CancelOutlinedIcon fontSize="small" />} />
      )}
      {state === null && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          پس از ارسال، درخواست ابتدا نزد مدیر مالی و سپس خزانه‌دار می‌رود.
        </Typography>
      )}
    </Paper>
  );
}
