import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { JalaliDateField } from '../../components/JalaliDateField';
import { Pagination } from '../../components/Pagination';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { useSession } from '../../lib/session/SessionContext';
import { formatLegacyJalaliDate, formatPersianDateTime } from '../../lib/format/dates';
import { formatThousands, toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import { bankAccountsApi } from '../bank-accounts/api';
import {
  APPROVAL_ACTION_LABEL,
  APPROVAL_META,
  chequeBookApi,
  type ChequeApprovalState,
  type ChequeBookItemDto,
  type ChequeBookParams,
} from './api';

const PAGE_SIZE = 50;

/** زبانه‌ها: همه، صدور دستور پرداخت (صادرنشده/برگشتی)، کارتابل‌های تأیید، قابل چاپ. */
type View = 'all' | 'unissued' | 'accounting' | 'manager' | 'confirmed';

const VIEW_FILTER: Record<View, Partial<ChequeBookParams>> = {
  all: {},
  unissued: { onlyUnissued: true, canceled: false },
  accounting: { approvalState: 1 },
  manager: { approvalState: 2 },
  confirmed: { approvalState: 3 },
};

/**
 * دفتر چک — چک‌های به‌کاررفته در اسناد. دستور پرداخت و تاییدیه چک (کاغذی در سیستم قدیم) کارتابل
 * شده‌اند: صدور دستور پرداخت ⇐ تأیید رئیس حسابداری ⇐ تأیید مدیر واحد (تاییدیه) ⇐ چاپ چک.
 */
export function ChequeBookPage() {
  const navigate = useNavigate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { financialYear, isConfigured } = useSession();
  const [view, setView] = useState<View>('all');
  const empty = { bankAccountId: '', fromDate: '', toDate: '', canceled: '', printed: '', chequeNo: '', amount: '', description: '' };
  const [draft, setDraft] = useState(empty);
  const [applied, setApplied] = useState(empty);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<{ action: 1 | 2 | 4; ids: string[] } | null>(null);
  const [note, setNote] = useState('');
  const [history, setHistory] = useState<ChequeBookItemDto | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ChequeBookItemDto | null>(null);

  const accounts = useQuery({
    queryKey: ['bank-accounts', 'all'],
    queryFn: () => bankAccountsApi.list({ pageNumber: 1, pageSize: 200 }),
    enabled: isConfigured,
  });

  const params: ChequeBookParams = {
    year: financialYear,
    pageNumber: page,
    pageSize,
    bankAccountId: applied.bankAccountId || undefined,
    fromDate: applied.fromDate || undefined,
    toDate: applied.toDate || undefined,
    canceled: applied.canceled === '' ? undefined : applied.canceled === '1',
    printed: applied.printed === '' ? undefined : applied.printed === '1',
    chequeNo: toLatinDigits(applied.chequeNo.trim()) || undefined,
    amount: applied.amount ? Number(toLatinDigits(applied.amount).replace(/[^\d]/g, '')) : undefined,
    description: applied.description.trim() || undefined,
    ...VIEW_FILTER[view],
  };

  const list = useQuery({
    queryKey: ['cheque-book', params],
    queryFn: () => chequeBookApi.list(params),
    enabled: isConfigured && !!financialYear,
  });
  const rows = list.data?.items ?? [];

  const events = useQuery({
    queryKey: ['cheque-events', history?.checkId],
    queryFn: () => chequeBookApi.events(history!.checkId),
    enabled: !!history,
  });

  const approval = useMutation({
    mutationFn: (p: { action: 1 | 2 | 4; ids: string[]; note: string }) => chequeBookApi.approval(p.action, p.ids, p.note.trim() || null),
    onSuccess: async (n, p) => {
      await queryClient.invalidateQueries({ queryKey: ['cheque-book'] });
      notify(`${toPersianDigits(n)} چک — ${p.action === 1 ? 'دستور پرداخت صادر شد' : p.action === 2 ? 'تأیید شد' : 'برگشت داده شد'}.`);
      setPending(null);
      setNote('');
      setSelected(new Set());
    },
  });

  const cancel = useMutation({
    mutationFn: (r: ChequeBookItemDto) => chequeBookApi.setCanceled(r.checkId, !r.isCanceled),
    onSuccess: async (_, r) => {
      await queryClient.invalidateQueries({ queryKey: ['cheque-book'] });
      notify(r.isCanceled ? 'ابطال چک برگردانده شد.' : 'چک ابطال شد.');
      setCancelTarget(null);
    },
  });

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.checkId));
  const amount = (v: number) => toPersianDigits(formatThousands(v));

  const columns: DataTableColumn<ChequeBookItemDto>[] = [
    {
      key: 'sel',
      header: '',
      width: 40,
      render: (r) => <Checkbox size="small" checked={selected.has(r.checkId)} onChange={() => toggle(r.checkId)} />,
    },
    { key: 'no', header: 'شمارهٔ چک', render: (r) => toPersianDigits(r.chequeNo) },
    { key: 'date', header: 'سررسید', render: (r) => formatLegacyJalaliDate(r.chequeDate) },
    { key: 'pay', header: 'در وجه', render: (r) => r.payTo ?? <Typography variant="caption" color="error">وارد نشده</Typography> },
    { key: 'amount', header: 'مبلغ', align: 'end', render: (r) => amount(r.amount) },
    { key: 'desc', header: 'شرح چک / آرتیکل', render: (r) => r.paperDescription || r.lineDescription || '—' },
    { key: 'acc', header: 'حساب جاری', render: (r) => `${toPersianDigits(r.accountNumber ?? '')} ${r.bankName ?? ''}` },
    {
      key: 'voucher',
      header: 'سند',
      render: (r) => (
        <Button size="small" onClick={() => navigate(`/operation/vouchers/${r.voucherHeadId}/view`)}>
          {toPersianDigits(r.voucherNumber ?? '')} · {formatLegacyJalaliDate(r.voucherDate)}
        </Button>
      ),
    },
    {
      key: 'state',
      header: 'وضعیت',
      render: (r) => (
        <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {r.isCanceled && <Chip size="small" color="error" label="ابطال" />}
          {r.isPrinted && <Chip size="small" color="success" variant="outlined" label="چاپ شده" />}
          {r.approvalState ? (
            <Tooltip title={r.approvalNote ?? ''}>
              <Chip size="small" color={APPROVAL_META[r.approvalState].color} label={APPROVAL_META[r.approvalState].label} />
            </Tooltip>
          ) : (
            !r.isCanceled && <Chip size="small" variant="outlined" label="دستور پرداخت صادر نشده" />
          )}
        </Stack>
      ),
    },
    {
      key: 'act',
      header: 'عملیات',
      align: 'end',
      render: (r) => (
        <Stack direction="row" spacing={0.25} sx={{ justifyContent: 'flex-end' }}>
          {r.approvalState === 3 && !r.isCanceled && (
            <Tooltip title="چاپ چک">
              <IconButton size="small" color="primary" onClick={() => navigate(`/operation/cheque-book/${r.checkId}/print`)}>
                <PrintOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="تاریخچهٔ تأیید">
            <IconButton size="small" onClick={() => setHistory(r)}>
              <HistoryOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={r.isCanceled ? 'برگرداندن ابطال' : 'ابطال چک'}>
            <IconButton size="small" color={r.isCanceled ? 'warning' : 'error'} onClick={() => setCancelTarget(r)}>
              {r.isCanceled ? <UndoOutlinedIcon fontSize="small" /> : <BlockOutlinedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  const ids = [...selected];
  const actionTitle: Record<1 | 2 | 4, string> = { 1: 'صدور دستور پرداخت', 2: 'تأیید', 4: 'برگشت' };

  return (
    <section>
      <PageHeader
        eyebrow="عملیات"
        icon={<MenuBookOutlinedIcon />}
        title="دفتر چک"
        description={`چک‌های به‌کاررفته در اسناد سال ${toPersianDigits(financialYear || '—')} — دستور پرداخت، تأیید رئیس حسابداری، تاییدیهٔ مدیر واحد و چاپ چک.`}
      />

      <Tabs
        value={view}
        onChange={(_, v) => { setView(v); setPage(1); setSelected(new Set()); }}
        variant="scrollable"
        sx={{ mb: 2 }}
      >
        <Tab value="all" label="همهٔ چک‌ها" />
        <Tab value="unissued" label="صدور دستور پرداخت" />
        <Tab value="accounting" label="کارتابل رئیس حسابداری" />
        <Tab value="manager" label="کارتابل مدیر واحد" />
        <Tab value="confirmed" label="آمادهٔ چاپ" />
      </Tabs>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <TextField select size="small" label="حساب جاری" value={draft.bankAccountId}
            onChange={(e) => setDraft({ ...draft, bankAccountId: e.target.value })} sx={{ minWidth: 240 }}>
            <MenuItem value="">همه</MenuItem>
            {(accounts.data?.items ?? []).map((a) => (
              <MenuItem key={a.id} value={a.id}>{toPersianDigits(a.accountNumber ?? '')} — {a.accountHolder ?? ''}</MenuItem>
            ))}
          </TextField>
          <JalaliDateField size="small" label="سررسید از" value={draft.fromDate} onChange={(v) => setDraft({ ...draft, fromDate: v })} />
          <JalaliDateField size="small" label="سررسید تا" value={draft.toDate} onChange={(v) => setDraft({ ...draft, toDate: v })} />
          <TextField select size="small" label="وضعیت ابطال" value={draft.canceled} onChange={(e) => setDraft({ ...draft, canceled: e.target.value })} sx={{ minWidth: 140 }}>
            <MenuItem value="">همه</MenuItem>
            <MenuItem value="0">ابطال نشده</MenuItem>
            <MenuItem value="1">ابطال شده</MenuItem>
          </TextField>
          <TextField select size="small" label="وضعیت چاپ" value={draft.printed} onChange={(e) => setDraft({ ...draft, printed: e.target.value })} sx={{ minWidth: 140 }}>
            <MenuItem value="">همه</MenuItem>
            <MenuItem value="0">چاپ نشده</MenuItem>
            <MenuItem value="1">چاپ شده</MenuItem>
          </TextField>
          <TextField size="small" label="شمارهٔ چک" value={draft.chequeNo} onChange={(e) => setDraft({ ...draft, chequeNo: e.target.value })} />
          <TextField size="small" label="مبلغ چک" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
          <TextField size="small" label="شرح / در وجه" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          <Button variant="contained" onClick={() => { setApplied(draft); setPage(1); setSelected(new Set()); }}>اعمال فیلتر</Button>
          <Button onClick={() => { setDraft(empty); setApplied(empty); setPage(1); }}>پاک کردن</Button>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Checkbox
          size="small"
          checked={allSelected}
          indeterminate={!allSelected && rows.some((r) => selected.has(r.checkId))}
          onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.checkId)))}
        />
        <Typography variant="body2" sx={{ mr: 1 }}>{toPersianDigits(selected.size)} چک انتخاب شده</Typography>
        <Button variant="outlined" startIcon={<RequestQuoteOutlinedIcon />} disabled={ids.length === 0} onClick={() => setPending({ action: 1, ids })}>
          صدور دستور پرداخت
        </Button>
        <Button variant="outlined" color="success" startIcon={<CheckCircleOutlineIcon />} disabled={ids.length === 0} onClick={() => setPending({ action: 2, ids })}>
          تأیید (رئیس حسابداری / مدیر واحد)
        </Button>
        <Button variant="outlined" color="warning" startIcon={<ReplayOutlinedIcon />} disabled={ids.length === 0} onClick={() => setPending({ action: 4, ids })}>
          برگشت
        </Button>
      </Paper>

      {list.isError && <ErrorBanner error={list.error} />}
      {cancel.isError && <ErrorBanner error={cancel.error} />}
      <DataTable
        pageable={false}
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.checkId}
        isLoading={list.isLoading}
        emptyMessage="چکی با این شرایط در اسناد نیست."
      />
      <Pagination pageNumber={page} pageSize={pageSize} totalCount={list.data?.totalCount ?? 0} onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />

      <Dialog open={pending !== null} onClose={() => setPending(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{pending ? actionTitle[pending.action] : ''}</DialogTitle>
        <DialogContent>
          {approval.isError && <ErrorBanner error={approval.error} />}
          <Typography variant="body2" sx={{ mb: 2 }}>
            {pending?.action === 2
              ? `${toPersianDigits(pending.ids.length)} چک در مرحلهٔ جاری خود تأیید می‌شود (رئیس حسابداری یا مدیر واحد، بسته به نقش شما).`
              : `${toPersianDigits(pending?.ids.length ?? 0)} چک انتخاب شده است.`}
          </Typography>
          <TextField fullWidth multiline minRows={2} size="small" label={pending?.action === 4 ? 'علت برگشت (الزامی)' : 'توضیح (اختیاری)'}
            value={note} onChange={(e) => setNote(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setPending(null); approval.reset(); }}>انصراف</Button>
          <Button variant="contained" disabled={approval.isPending || (pending?.action === 4 && !note.trim())}
            onClick={() => pending && approval.mutate({ ...pending, note })}>
            ثبت
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={history !== null} onClose={() => setHistory(null)} maxWidth="sm" fullWidth>
        <DialogTitle>تاریخچهٔ چک {toPersianDigits(history?.chequeNo ?? '')}</DialogTitle>
        <DialogContent>
          {events.isError && <ErrorBanner error={events.error} />}
          {(events.data ?? []).length === 0 && !events.isLoading && <Typography color="text.secondary">هنوز اقدامی ثبت نشده است.</Typography>}
          <Stack spacing={1.5}>
            {(events.data ?? []).map((e, i) => (
              <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle2">{APPROVAL_ACTION_LABEL[e.action] ?? e.action}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {toPersianDigits(e.userId)} · {formatPersianDateTime(e.createdDate)} · {APPROVAL_META[e.toState as ChequeApprovalState]?.label}
                </Typography>
                {e.note && <Typography variant="body2" sx={{ mt: 0.5 }}>{e.note}</Typography>}
              </Paper>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistory(null)}>بستن</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={cancelTarget !== null}
        title={cancelTarget?.isCanceled ? 'برگرداندن ابطال' : 'ابطال چک'}
        description={cancelTarget ? `چک ${toPersianDigits(cancelTarget.chequeNo)} ${cancelTarget.isCanceled ? 'از حالت ابطال خارج' : 'ابطال'} شود؟` : undefined}
        pending={cancel.isPending}
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => cancelTarget && cancel.mutate(cancelTarget)}
      />
    </section>
  );
}
