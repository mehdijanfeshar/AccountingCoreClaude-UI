import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ErrorBanner } from '../../components/ErrorBanner';
import { MonoCode } from '../../components/MonoCode';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { formatThousands } from '../../lib/format/numbers';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { bankStatementsApi, receiptsApi } from './api';
import { RECEIPT_STATE } from './receiptTransferState';
import { resolveIgnoreFormSchema, type ResolveIgnoreFormValues } from './schema';
import { BANK_STATEMENT_LINE_RESOLUTION_TYPE } from './bankStatementState';
import type { BankStatementLineDto, ReceiptListItemDto } from '../../types/treasury';

interface BankStatementResolveDialogsProps {
  statementId: string;
  bankFeeTarget: BankStatementLineDto | null;
  onCloseBankFee: () => void;
  linkReceiptTarget: BankStatementLineDto | null;
  onCloseLinkReceipt: () => void;
  ignoreTarget: BankStatementLineDto | null;
  onCloseIgnore: () => void;
}

/**
 * سه راه رفع ردیف تطبیق‌نیافته — خزانه‌داری بخش ۴-د: سند کارمزد بانکی (فقط برداشت)، اتصال به
 * دریافت ثبت‌شده (فقط واریز)، نادیده‌گرفتن (یادداشت اجباری). هر سه از `POST .../resolve` با
 * `type` متفاوت استفاده می‌کنند.
 */
export function BankStatementResolveDialogs({
  statementId,
  bankFeeTarget,
  onCloseBankFee,
  linkReceiptTarget,
  onCloseLinkReceipt,
  ignoreTarget,
  onCloseIgnore,
}: BankStatementResolveDialogsProps) {
  const notify = useNotify();
  const queryClient = useQueryClient();

  async function invalidateAfterAction() {
    await queryClient.invalidateQueries({ queryKey: ['treasury-bank-statements', statementId] });
  }

  /* ------------------------------------------------------------------------------------------- *
   * سند کارمزد بانکی — فقط تأیید، بدون فیلد اضافه.
   * ------------------------------------------------------------------------------------------- */
  const bankFeeMutation = useMutation({
    mutationFn: () =>
      bankStatementsApi.resolveLine(statementId, bankFeeTarget!.id, {
        type: BANK_STATEMENT_LINE_RESOLUTION_TYPE.bankFeeVoucher,
        receiptId: null,
        note: null,
      }),
    onSuccess: async () => {
      await invalidateAfterAction();
      notify('سند کارمزد بانکی (موقت) صادر شد.');
      onCloseBankFee();
    },
  });

  /* ------------------------------------------------------------------------------------------- *
   * نادیده گرفتن — یادداشت اجباری.
   * ------------------------------------------------------------------------------------------- */
  const {
    register: registerIgnore,
    handleSubmit: handleSubmitIgnore,
    reset: resetIgnore,
    formState: { errors: ignoreErrors },
  } = useForm<ResolveIgnoreFormValues>({ resolver: zodResolver(resolveIgnoreFormSchema), defaultValues: { note: '' } });

  useEffect(() => {
    if (ignoreTarget) resetIgnore({ note: '' });
  }, [ignoreTarget, resetIgnore]);

  const ignoreMutation = useMutation({
    mutationFn: (values: ResolveIgnoreFormValues) =>
      bankStatementsApi.resolveLine(statementId, ignoreTarget!.id, {
        type: BANK_STATEMENT_LINE_RESOLUTION_TYPE.ignored,
        receiptId: null,
        note: values.note.trim(),
      }),
    onSuccess: async () => {
      await invalidateAfterAction();
      notify('ردیف نادیده گرفته شد.');
      onCloseIgnore();
    },
  });

  /* ------------------------------------------------------------------------------------------- *
   * اتصال به دریافت — فقط دریافت‌های «ثبت‌شده»؛ فهرست به مبلغ ردیف نزدیک‌ترین‌ها را اول نشان می‌دهد
   * (فیلتر سمت سرور روی حساب بانکی/مبلغ وجود ندارد — همان کنترل واقعی در لحظهٔ `resolve` اجرا
   * می‌شود، ۴۰۰ اگر ناهماهنگ باشد).
   * ------------------------------------------------------------------------------------------- */
  const registeredReceiptsQuery = useQuery({
    queryKey: ['treasury-receipts-registered-for-resolve'],
    queryFn: () => receiptsApi.list({ pageNumber: 1, pageSize: 100, state: RECEIPT_STATE.registered }),
    enabled: linkReceiptTarget !== null,
  });

  const sortedReceipts = useMemo(() => {
    const items = registeredReceiptsQuery.data?.page.items ?? [];
    if (!linkReceiptTarget) return items;
    const targetAmount = linkReceiptTarget.deposit;
    return [...items].sort((a, b) => Math.abs(a.amount - targetAmount) - Math.abs(b.amount - targetAmount));
  }, [registeredReceiptsQuery.data, linkReceiptTarget]);

  const linkReceiptMutation = useMutation({
    mutationFn: (receiptId: string) =>
      bankStatementsApi.resolveLine(statementId, linkReceiptTarget!.id, {
        type: BANK_STATEMENT_LINE_RESOLUTION_TYPE.linkedReceipt,
        receiptId,
        note: null,
      }),
    onSuccess: async () => {
      await invalidateAfterAction();
      notify('ردیف به دریافت انتخاب‌شده متصل شد.');
      onCloseLinkReceipt();
    },
    onError: (error) => {
      notify({ message: error instanceof Error ? error.message : 'اتصال با خطا مواجه شد.', severity: 'error' });
    },
  });

  const receiptColumns: DataTableColumn<ReceiptListItemDto>[] = [
    { key: 'code', header: 'شماره', render: (row) => <MonoCode value={row.code} /> },
    { key: 'payerName', header: 'پرداخت‌کننده', render: (row) => row.payerName },
    { key: 'amount', header: 'مبلغ (ریال)', align: 'end', render: (row) => formatThousands(row.amount) },
    { key: 'receiptDate', header: 'تاریخ دریافت', render: (row) => formatLegacyJalaliDate(row.receiptDate) },
    {
      key: 'action',
      header: '',
      render: (row) => (
        <Button size="small" variant="outlined" disabled={linkReceiptMutation.isPending} onClick={() => linkReceiptMutation.mutate(row.id)}>
          اتصال
        </Button>
      ),
    },
  ];

  return (
    <>
      {/* سند کارمزد بانکی */}
      <Dialog open={bankFeeTarget !== null} onClose={onCloseBankFee} maxWidth="xs" fullWidth>
        <DialogTitle>ایجاد سند کارمزد بانکی</DialogTitle>
        <DialogContent>
          {bankFeeMutation.error && <ErrorBanner error={bankFeeMutation.error} />}
          <DialogContentText>
            یک سند حسابداری موقت — بدهکار «حساب کارمزد بانکی» (از تنظیمات خزانه)، بستانکار حساب بانک — برای مبلغ{' '}
            {bankFeeTarget ? formatThousands(bankFeeTarget.withdrawal) : ''} ریال صادر می‌شود. ادامه می‌دهید؟
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseBankFee} color="inherit" disabled={bankFeeMutation.isPending}>
            انصراف
          </Button>
          <Button variant="contained" disabled={bankFeeMutation.isPending} onClick={() => bankFeeMutation.mutate()}>
            {bankFeeMutation.isPending ? 'در حال صدور…' : 'صدور سند'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* نادیده گرفتن */}
      <Dialog open={ignoreTarget !== null} onClose={onCloseIgnore} maxWidth="xs" fullWidth>
        <DialogTitle>نادیده گرفتن ردیف</DialogTitle>
        <DialogContent>
          {ignoreMutation.error && <ErrorBanner error={ignoreMutation.error} />}
          <TextField
            {...registerIgnore('note')}
            autoFocus
            fullWidth
            required
            multiline
            minRows={2}
            label="یادداشت"
            error={!!ignoreErrors.note}
            helperText={ignoreErrors.note?.message}
            slotProps={{ htmlInput: { maxLength: 500 } }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseIgnore} color="inherit" disabled={ignoreMutation.isPending}>
            انصراف
          </Button>
          <Button
            variant="contained"
            color="warning"
            disabled={ignoreMutation.isPending}
            onClick={handleSubmitIgnore((values) => ignoreMutation.mutate(values))}
          >
            {ignoreMutation.isPending ? 'در حال ثبت…' : 'نادیده گرفتن'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* اتصال به دریافت */}
      <Dialog open={linkReceiptTarget !== null} onClose={onCloseLinkReceipt} maxWidth="md" fullWidth>
        <DialogTitle>اتصال به دریافت ثبت‌شده</DialogTitle>
        <DialogContent>
          {linkReceiptTarget && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              مبلغ ردیف واریزی: {formatThousands(linkReceiptTarget.deposit)} ریال — فهرست زیر بر اساس نزدیکی مبلغ مرتب شده؛ تطبیق واقعی حساب
              بانکی/مبلغ در لحظهٔ اتصال روی سرور بررسی می‌شود.
            </Typography>
          )}
          {registeredReceiptsQuery.isError && <ErrorBanner error={registeredReceiptsQuery.error} />}
          {linkReceiptMutation.isError && <ErrorBanner error={linkReceiptMutation.error} />}
          {!registeredReceiptsQuery.isError && (
            <DataTable
              columns={receiptColumns}
              rows={sortedReceipts}
              getRowKey={(row) => row.id}
              isLoading={registeredReceiptsQuery.isLoading}
              emptyMessage="دریافت ثبت‌شده‌ای یافت نشد."
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseLinkReceipt}>بستن</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
