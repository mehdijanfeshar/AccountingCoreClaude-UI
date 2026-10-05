import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LinkOffOutlinedIcon from '@mui/icons-material/LinkOffOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { JalaliDateField } from '../../components/JalaliDateField';
import { StatTiles, type StatTile } from '../../components/StatTiles';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { useSession } from '../../lib/session/SessionContext';
import { formatThousands, normalizeNumericInput, toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { PERSIAN_MONTHS } from '../../types/fsRun';
import { bankAccountsApi } from '../bank-accounts/api';
import { CHECK_RECEIPT_TYPE_OPTIONS, bankCardsApi, type BankCardRowDto, type CheckReceiptType } from './api';

export function money(value: number): string {
  return value ? toPersianDigits(formatThousands(value)) : '—';
}

interface RowForm {
  id: string | null;
  date: string;
  number: string;
  type: CheckReceiptType;
  isDeposit: boolean;
  amount: string;
}

/** کارت حساب جاری — ردیف‌های بانک یک حساب در یک ماه، دیسکت، مغایرت‌گیری و صورت مغایرت. */
export function BankCardPage() {
  const navigate = useNavigate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { financialYear, isConfigured } = useSession();
  const [params, setParams] = useSearchParams();
  const accountId = params.get('account') ?? '';
  const month = params.get('month') ?? '';
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<RowForm | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BankCardRowDto | null>(null);
  const [pendingUnreconcile, setPendingUnreconcile] = useState<BankCardRowDto | null>(null);

  const accounts = useQuery({
    queryKey: ['bank-accounts', 'all'],
    queryFn: () => bankAccountsApi.list({ pageNumber: 1, pageSize: 200 }),
    enabled: isConfigured,
  });

  const ready = !!accountId && !!month && !!financialYear;
  const card = useQuery({
    queryKey: ['bank-card', accountId, financialYear, month],
    queryFn: () => bankCardsApi.get(accountId, financialYear, month),
    enabled: ready,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['bank-card'] });

  const importDisk = useMutation({
    mutationFn: (file: File) => bankCardsApi.importDisk(accountId, financialYear, month, file),
    onSuccess: async (r) => {
      await refresh();
      notify(`${toPersianDigits(r.imported)} ردیف وارد شد${r.skipped ? `، ${toPersianDigits(r.skipped)} ردیف تکراری کنار گذاشته شد` : ''}.`);
    },
  });
  const reconcile = useMutation({
    mutationFn: () => bankCardsApi.reconcile(accountId, financialYear, month),
    onSuccess: async (r) => {
      await refresh();
      notify(`${toPersianDigits(r.matched)} ردیف مغایرت‌گیری شد؛ ${toPersianDigits(r.remaining)} ردیف باز ماند.`);
    },
  });
  const save = useMutation({
    mutationFn: (f: RowForm) => {
      const body = {
        year: financialYear,
        bankAccountId: accountId,
        date: f.date,
        number: toLatinDigits(f.number.trim()) || null,
        type: f.type,
        isDeposit: f.isDeposit,
        amount: Number(f.amount) || 0,
      };
      return f.id ? bankCardsApi.updateRow(f.id, body) : bankCardsApi.createRow(body).then(() => undefined);
    },
    onSuccess: async () => {
      await refresh();
      notify('ردیف ذخیره شد.');
      setForm(null);
    },
  });
  const remove = useMutation({
    mutationFn: (r: BankCardRowDto) => bankCardsApi.deleteRow(r.id),
    onSuccess: async () => {
      await refresh();
      notify('ردیف حذف شد.');
      setPendingDelete(null);
    },
  });
  const unreconcile = useMutation({
    mutationFn: (r: BankCardRowDto) => bankCardsApi.unreconcileRow(r.id),
    onSuccess: async () => {
      await refresh();
      notify('مغایرت‌گیری ردیف برگردانده شد.');
      setPendingUnreconcile(null);
    },
  });

  function select(next: { account?: string; month?: string }) {
    const p = new URLSearchParams(params);
    if (next.account !== undefined) p.set('account', next.account);
    if (next.month !== undefined) p.set('month', next.month);
    setParams(p);
  }

  const rows = card.data?.rows ?? [];
  const tiles: StatTile[] = card.data
    ? [
        { key: 'n', label: 'تعداد ردیف', value: rows.length, tone: 'primary' },
        { key: 'd', label: 'جمع دریافت (واریز)', value: money(card.data.totalDeposit), tone: 'info' },
        { key: 'w', label: 'جمع پرداخت (برداشت)', value: money(card.data.totalWithdrawal), tone: 'warning' },
        {
          key: 'r',
          label: 'مغایرت‌گیری‌شده',
          value: `${toPersianDigits(card.data.reconciledCount)} از ${toPersianDigits(rows.length)}`,
          tone: card.data.reconciledCount === rows.length ? 'success' : 'error',
        },
      ]
    : [];

  const typeLabel = (t: CheckReceiptType | null) => CHECK_RECEIPT_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? '—';

  const columns: DataTableColumn<BankCardRowDto>[] = [
    { key: 'date', header: 'تاریخ', width: 110, render: (r) => formatLegacyJalaliDate(r.date) },
    { key: 'no', header: 'شمارهٔ چک / فیش', render: (r) => toPersianDigits(r.number ?? '—') },
    { key: 'type', header: 'نوع اوراق بانکی', render: (r) => typeLabel(r.type) },
    { key: 'dep', header: 'دریافت', align: 'end', render: (r) => money(r.deposit) },
    { key: 'wd', header: 'پرداخت', align: 'end', render: (r) => money(r.withdrawal) },
    {
      key: 'st',
      header: 'مغایرت‌گیری',
      render: (r) =>
        r.isReconciled ? (
          <Chip size="small" color="success" label="تطبیق با دفتر" />
        ) : (
          <Chip size="small" variant="outlined" color="warning" label="باز" />
        ),
    },
    {
      key: 'act',
      header: 'عملیات',
      align: 'end',
      render: (r) => (
        <Stack direction="row" spacing={0.25} sx={{ justifyContent: 'flex-end' }}>
          {r.isReconciled ? (
            <Tooltip title="برگرداندن مغایرت‌گیری">
              <IconButton size="small" color="warning" onClick={() => setPendingUnreconcile(r)}>
                <LinkOffOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <>
              <Tooltip title="ویرایش">
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() =>
                    setForm({
                      id: r.id,
                      date: r.date ?? '',
                      number: r.number ?? '',
                      type: r.type ?? 2,
                      isDeposit: r.deposit > 0,
                      amount: String(r.deposit || r.withdrawal),
                    })
                  }
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="حذف">
                <IconButton size="small" color="error" onClick={() => setPendingDelete(r)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Stack>
      ),
    },
  ];

  const error = importDisk.error ?? reconcile.error ?? remove.error ?? unreconcile.error;

  return (
    <section>
      <PageHeader
        eyebrow="عملیات"
        icon={<AccountBalanceOutlinedIcon />}
        title="کارت حساب جاری"
        description={`ردیف‌های صورت‌حساب بانک هر حساب جاری در هر ماه سال ${toPersianDigits(financialYear || '—')} — ورود دستی یا دیسکت بانک، و مغایرت‌گیری با چک و فیش‌های دفتر.`}
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} useFlexGap sx={{ flexWrap: 'wrap', alignItems: { md: 'center' } }}>
          <TextField
            select
            size="small"
            label="حساب جاری"
            value={accountId}
            onChange={(e) => select({ account: e.target.value })}
            sx={{ minWidth: 280 }}
          >
            {(accounts.data?.items ?? []).map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {toPersianDigits(a.accountNumber ?? '')} — {a.accountHolder ?? ''}
              </MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="ماه" value={month} onChange={(e) => select({ month: e.target.value })} sx={{ minWidth: 140 }}>
            {PERSIAN_MONTHS.map((m, i) => {
              const v = String(i + 1).padStart(2, '0');
              return (
                <MenuItem key={v} value={v}>
                  {m}
                </MenuItem>
              );
            })}
          </TextField>
          {ready && (
            <>
              <Button
                variant="outlined"
                startIcon={<AddOutlinedIcon />}
                onClick={() => setForm({ id: null, date: `${financialYear}${month}01`, number: '', type: 2, isDeposit: false, amount: '' })}
              >
                ردیف جدید
              </Button>
              <input
                ref={fileRef}
                type="file"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) importDisk.mutate(f);
                }}
              />
              <Button
                variant="outlined"
                startIcon={importDisk.isPending ? <CircularProgress size={16} /> : <UploadFileOutlinedIcon />}
                disabled={importDisk.isPending}
                onClick={() => fileRef.current?.click()}
              >
                دیسکت بانک (STM001)
              </Button>
              <Button
                variant="contained"
                startIcon={reconcile.isPending ? <CircularProgress size={16} /> : <SyncOutlinedIcon />}
                disabled={reconcile.isPending || rows.length === 0}
                onClick={() => reconcile.mutate()}
              >
                مغایرت‌گیری
              </Button>
              <Button
                variant="outlined"
                startIcon={<PrintOutlinedIcon />}
                onClick={() => navigate(`/operation/bank-card/reconciliation?account=${accountId}&month=${month}`)}
              >
                صورت مغایرت
              </Button>
            </>
          )}
        </Stack>
      </Paper>

      {!ready && <Typography color="text.secondary">حساب جاری و ماه را انتخاب کنید.</Typography>}
      {card.isError && <ErrorBanner error={card.error} />}
      {error && <ErrorBanner error={error} />}
      {ready && card.data && <StatTiles tiles={tiles} />}
      {ready && (
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.id}
          isLoading={card.isLoading}
          emptyMessage="برای این حساب و ماه ردیفی ثبت نشده است. دیسکت بانک را وارد کنید یا ردیف جدید بزنید."
        />
      )}

      <Dialog open={form !== null} onClose={() => setForm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{form?.id ? 'ویرایش ردیف' : 'ردیف جدید'}</DialogTitle>
        <DialogContent>
          {form && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              {save.isError && <ErrorBanner error={save.error} />}
              <JalaliDateField label="تاریخ رسید" required size="small" fullWidth value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
              <TextField select size="small" label="نوع اوراق بانکی" value={form.type} onChange={(e) => setForm({ ...form, type: Number(e.target.value) as CheckReceiptType })}>
                {CHECK_RECEIPT_TYPE_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField size="small" label="شمارهٔ چک / فیش" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value.slice(0, 8) })} />
              <RadioGroup row value={form.isDeposit ? 'd' : 'w'} onChange={(e) => setForm({ ...form, isDeposit: e.target.value === 'd' })}>
                <FormControlLabel value="d" control={<Radio />} label="دریافت" />
                <FormControlLabel value="w" control={<Radio />} label="پرداخت" />
              </RadioGroup>
              <TextField
                size="small"
                label="مبلغ"
                required
                value={form.amount ? toPersianDigits(formatThousands(form.amount)) : ''}
                onChange={(e) => setForm({ ...form, amount: normalizeNumericInput(e.target.value).replace(/[.-]/g, '') })}
                slotProps={{ htmlInput: { inputMode: 'numeric', dir: 'ltr' } }}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setForm(null)}>انصراف</Button>
          <Button variant="contained" disabled={save.isPending} onClick={() => form && save.mutate(form)}>
            ثبت
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف ردیف"
        description="این ردیف کارت حساب حذف شود؟"
        pending={remove.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete)}
      />
      <ConfirmDialog
        open={pendingUnreconcile !== null}
        title="برگرداندن مغایرت‌گیری"
        description="اتصال این ردیف به چک/فیش دفتر برداشته و تاریخ وصول آن پاک می‌شود. ادامه می‌دهید؟"
        pending={unreconcile.isPending}
        onCancel={() => setPendingUnreconcile(null)}
        onConfirm={() => pendingUnreconcile && unreconcile.mutate(pendingUnreconcile)}
      />
    </section>
  );
}
