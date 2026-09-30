import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FormLoadingSkeleton } from '../../components/FormLoadingSkeleton';
import { MonoCode } from '../../components/MonoCode';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { formatThousands } from '../../lib/format/numbers';
import { bankStatementsApi } from './api';
import { bankAccountsApi } from '../bank-accounts/api';
import { BankStatementKpiTiles } from './BankStatementKpiTiles';
import { BankStatementLinesTable } from './BankStatementLinesTable';
import { BankStatementLineFormDialog } from './BankStatementLineFormDialog';
import { BankStatementManualMatchDialog } from './BankStatementManualMatchDialog';
import { BankStatementResolveDialogs } from './BankStatementResolveDialogs';
import { getBankStatementSourceLabel, getBankStatementStateColor, getBankStatementStateLabel, isBankStatementOpen } from './bankStatementState';
import type { BankStatementBookLineDto, BankStatementLineDto } from '../../types/treasury';

function bankAccountLabel(account: { accountNumber: string | null; accountHolder: string | null } | undefined): string {
  if (!account) return '—';
  return `${account.accountNumber ?? ''} — ${account.accountHolder ?? ''}`;
}

/**
 * جزئیات صورت‌حساب بانکی — خزانه‌داری بخش ۴-د (`docs/tankhah-khazaneh-module.md` §۱۰). KPI +
 * جدول ردیف‌ها (با اقدام هر ردیف بسته به `matchState`) + بخش «فقط در دفتر». نوار ابزار: تطبیق
 * خودکار، افزودن ردیف، بارگذاری فایل دیسکت (تا وقتی parser تعریف نشده همیشه ۴۰۹ می‌دهد)، بستن/
 * بازگشایی. ویرایش/حذف/افزودن ردیف فقط در وضعیت باز.
 */
export function BankStatementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<BankStatementLineDto | null>(null);
  const [manualMatchTarget, setManualMatchTarget] = useState<BankStatementLineDto | null>(null);
  const [bankFeeTarget, setBankFeeTarget] = useState<BankStatementLineDto | null>(null);
  const [linkReceiptTarget, setLinkReceiptTarget] = useState<BankStatementLineDto | null>(null);
  const [ignoreTarget, setIgnoreTarget] = useState<BankStatementLineDto | null>(null);
  const [pendingUnmatch, setPendingUnmatch] = useState<BankStatementLineDto | null>(null);
  const [pendingUnresolve, setPendingUnresolve] = useState<BankStatementLineDto | null>(null);
  const [pendingDeleteLine, setPendingDeleteLine] = useState<BankStatementLineDto | null>(null);
  const [importError, setImportError] = useState<unknown>(null);

  const statementQuery = useQuery({
    queryKey: ['treasury-bank-statements', id],
    queryFn: () => bankStatementsApi.getById(id as string),
    enabled: Boolean(id),
  });
  const statement = statementQuery.data;

  const bankAccountQuery = useQuery({
    queryKey: ['bank-accounts', statement?.bankAccountId],
    queryFn: () => bankAccountsApi.getById(statement!.bankAccountId),
    enabled: Boolean(statement?.bankAccountId),
  });

  async function invalidateStatement() {
    await queryClient.invalidateQueries({ queryKey: ['treasury-bank-statements', id] });
  }

  const closeMutation = useMutation({
    mutationFn: () => bankStatementsApi.close(id as string),
    onSuccess: async () => {
      await invalidateStatement();
      notify('صورت‌حساب بسته شد.');
    },
    onError: (error) => notify({ message: error instanceof Error ? error.message : 'بستن با خطا مواجه شد.', severity: 'error' }),
  });

  const reopenMutation = useMutation({
    mutationFn: () => bankStatementsApi.reopen(id as string),
    onSuccess: async () => {
      await invalidateStatement();
      notify('صورت‌حساب بازگشایی شد.');
    },
    onError: (error) => notify({ message: error instanceof Error ? error.message : 'بازگشایی با خطا مواجه شد.', severity: 'error' }),
  });

  const autoMatchMutation = useMutation({
    mutationFn: () => bankStatementsApi.autoMatch(id as string),
    onSuccess: async (result) => {
      await invalidateStatement();
      notify(`تطبیق خودکار: ${result.matchedCount} ردیف تطبیق یافت، ${result.unmatchedCount} ردیف تطبیق‌نیافته باقی ماند.`);
    },
    onError: (error) => notify({ message: error instanceof Error ? error.message : 'تطبیق خودکار با خطا مواجه شد.', severity: 'error' }),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => bankStatementsApi.import(id as string, file),
    onSuccess: async (result) => {
      await invalidateStatement();
      setImportError(null);
      notify(`${result.importedCount} ردیف از فایل وارد شد.`);
    },
    onError: (error) => setImportError(error),
  });

  const unmatchMutation = useMutation({
    mutationFn: (line: BankStatementLineDto) => bankStatementsApi.unmatchLine(id as string, line.id),
    onSuccess: async () => {
      await invalidateStatement();
      notify('تطبیق ردیف لغو شد.');
      setPendingUnmatch(null);
    },
    onError: (error) => {
      notify({ message: error instanceof Error ? error.message : 'لغو تطبیق با خطا مواجه شد.', severity: 'error' });
      setPendingUnmatch(null);
    },
  });

  const unresolveMutation = useMutation({
    mutationFn: (line: BankStatementLineDto) => bankStatementsApi.unresolveLine(id as string, line.id),
    onSuccess: async () => {
      await invalidateStatement();
      notify('رفع ردیف برگردانده شد.');
      setPendingUnresolve(null);
    },
    onError: (error) => {
      notify({ message: error instanceof Error ? error.message : 'برگرداندن با خطا مواجه شد.', severity: 'error' });
      setPendingUnresolve(null);
    },
  });

  const deleteLineMutation = useMutation({
    mutationFn: (line: BankStatementLineDto) => bankStatementsApi.removeLine(id as string, line.id),
    onSuccess: async () => {
      await invalidateStatement();
      notify('ردیف حذف شد.');
      setPendingDeleteLine(null);
    },
    onError: (error) => {
      notify({ message: error instanceof Error ? error.message : 'حذف با خطا مواجه شد.', severity: 'error' });
      setPendingDeleteLine(null);
    },
  });

  function handleFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    importMutation.mutate(file);
  }

  const bookOnlyColumns: DataTableColumn<BankStatementBookLineDto>[] = [
    { key: 'voucherNumber', header: 'شمارهٔ سند', render: (row) => <MonoCode value={row.voucherNumber} /> },
    { key: 'voucherDate', header: 'تاریخ سند', render: (row) => formatLegacyJalaliDate(row.voucherDate) },
    { key: 'debit', header: 'بدهکار', align: 'end', render: (row) => (row.debit ? formatThousands(row.debit) : '—') },
    { key: 'credit', header: 'بستانکار', align: 'end', render: (row) => (row.credit ? formatThousands(row.credit) : '—') },
    { key: 'description', header: 'شرح', render: (row) => row.description ?? '—' },
    { key: 'sourceBankReference', header: 'مرجع بانک سند', render: (row) => row.sourceBankReference ?? '—' },
  ];

  if (statementQuery.isLoading) {
    return <FormLoadingSkeleton />;
  }

  if (statementQuery.isError) {
    return <ErrorBanner error={statementQuery.error} />;
  }

  if (!statement) return null;

  const open = isBankStatementOpen(statement.state);

  return (
    <section>
      <PageHeader
        eyebrow="تنخواه و خزانه‌داری"
        icon={<RuleOutlinedIcon />}
        accentColor="secondary"
        title={`صورت‌حساب ${statement.code}`}
        description={`${bankAccountLabel(bankAccountQuery.data)} — ${formatLegacyJalaliDate(statement.fromDate)} تا ${formatLegacyJalaliDate(statement.toDate)} — منبع: ${getBankStatementSourceLabel(statement.source)}`}
        actions={<Chip color={getBankStatementStateColor(statement.state)} label={getBankStatementStateLabel(statement.state)} />}
      />

      <BankStatementKpiTiles summary={statement.summary} isLoading={statementQuery.isLoading} />

      <Paper
        variant="outlined"
        sx={{ p: 1.5, mb: 2, borderRadius: 2, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}
      >
        <Button
          variant="outlined"
          startIcon={autoMatchMutation.isPending ? <CircularProgress size={16} /> : <SyncOutlinedIcon fontSize="small" />}
          disabled={!open || autoMatchMutation.isPending}
          onClick={() => autoMatchMutation.mutate()}
        >
          تطبیق خودکار
        </Button>
        {open && (
          <Button
            variant="outlined"
            startIcon={<AddOutlinedIcon fontSize="small" />}
            onClick={() => {
              setEditingLine(null);
              setLineDialogOpen(true);
            }}
          >
            افزودن ردیف
          </Button>
        )}
        <input ref={fileInputRef} type="file" hidden onChange={handleFileChosen} />
        <Button
          variant="outlined"
          startIcon={importMutation.isPending ? <CircularProgress size={16} /> : <UploadFileOutlinedIcon fontSize="small" />}
          disabled={!open || importMutation.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          بارگذاری فایل دیسکت
        </Button>

        <Box sx={{ flexGrow: 1 }} />

        {open ? (
          <Button
            variant="outlined"
            color="warning"
            startIcon={closeMutation.isPending ? <CircularProgress size={16} /> : <LockOutlinedIcon fontSize="small" />}
            disabled={closeMutation.isPending}
            onClick={() => closeMutation.mutate()}
          >
            بستن
          </Button>
        ) : (
          <Button
            variant="outlined"
            color="info"
            startIcon={reopenMutation.isPending ? <CircularProgress size={16} /> : <LockOpenOutlinedIcon fontSize="small" />}
            disabled={reopenMutation.isPending}
            onClick={() => reopenMutation.mutate()}
          >
            بازگشایی
          </Button>
        )}
      </Paper>

      {importError !== null && <ErrorBanner error={importError} />}

      <BankStatementLinesTable
        rows={statement.lines}
        isLoading={statementQuery.isLoading}
        statementOpen={open}
        onManualMatch={setManualMatchTarget}
        onBankFeeVoucher={setBankFeeTarget}
        onLinkReceipt={setLinkReceiptTarget}
        onIgnore={setIgnoreTarget}
        onUnmatch={setPendingUnmatch}
        onUnresolve={setPendingUnresolve}
        onEdit={(line) => {
          setEditingLine(line);
          setLineDialogOpen(true);
        }}
        onDelete={setPendingDeleteLine}
      />

      {statement.bookOnly.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2.5, mt: 3, borderRadius: 2 }}>
          <Stack spacing={0.5} sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              فقط در دفتر
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ردیف‌های دفتری در بازهٔ این صورت‌حساب که هنوز در صورت‌حساب بانک تطبیق نیافته‌اند.
            </Typography>
          </Stack>
          <DataTable columns={bookOnlyColumns} rows={statement.bookOnly} getRowKey={(row) => row.voucherDetailId} isLoading={false} />
        </Paper>
      )}

      <Stack sx={{ mt: 3 }}>
        <Button variant="text" onClick={() => navigate('/treasury/khazaneh/bank-reconciliation')} sx={{ alignSelf: 'flex-start' }}>
          بازگشت به فهرست
        </Button>
      </Stack>

      <BankStatementLineFormDialog
        open={lineDialogOpen}
        onClose={() => setLineDialogOpen(false)}
        statementId={id as string}
        line={editingLine}
      />

      <BankStatementManualMatchDialog
        open={manualMatchTarget !== null}
        onClose={() => setManualMatchTarget(null)}
        statementId={id as string}
        line={manualMatchTarget}
      />

      <BankStatementResolveDialogs
        statementId={id as string}
        bankFeeTarget={bankFeeTarget}
        onCloseBankFee={() => setBankFeeTarget(null)}
        linkReceiptTarget={linkReceiptTarget}
        onCloseLinkReceipt={() => setLinkReceiptTarget(null)}
        ignoreTarget={ignoreTarget}
        onCloseIgnore={() => setIgnoreTarget(null)}
      />

      <ConfirmDialog
        open={pendingUnmatch !== null}
        title="لغو تطبیق ردیف"
        description="این ردیف به وضعیت «تطبیق‌نیافته» برمی‌گردد. ادامه می‌دهید؟"
        confirmLabel="لغو تطبیق"
        confirmColor="primary"
        pending={unmatchMutation.isPending}
        onCancel={() => setPendingUnmatch(null)}
        onConfirm={() => pendingUnmatch && unmatchMutation.mutate(pendingUnmatch)}
      />

      <ConfirmDialog
        open={pendingUnresolve !== null}
        title="برگرداندن رفع ردیف"
        description="این ردیف به وضعیت «تطبیق‌نیافته» برمی‌گردد؛ اگر سند کارمزد موقت صادر شده باشد حذف نرم می‌شود. ادامه می‌دهید؟"
        confirmLabel="برگرداندن"
        confirmColor="primary"
        pending={unresolveMutation.isPending}
        onCancel={() => setPendingUnresolve(null)}
        onConfirm={() => pendingUnresolve && unresolveMutation.mutate(pendingUnresolve)}
      />

      <ConfirmDialog
        open={pendingDeleteLine !== null}
        title="حذف ردیف"
        description="این ردیف صورت‌حساب حذف می‌شود. ادامه می‌دهید؟"
        pending={deleteLineMutation.isPending}
        onCancel={() => setPendingDeleteLine(null)}
        onConfirm={() => pendingDeleteLine && deleteLineMutation.mutate(pendingDeleteLine)}
      />
    </section>
  );
}
