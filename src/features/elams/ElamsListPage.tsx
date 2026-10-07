import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import DoneAllOutlinedIcon from '@mui/icons-material/DoneAllOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import PostAddOutlinedIcon from '@mui/icons-material/PostAddOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { JalaliDateField } from '../../components/JalaliDateField';
import { MonoCode } from '../../components/MonoCode';
import { Pagination } from '../../components/Pagination';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { useSession } from '../../lib/session/SessionContext';
import { toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import {
  ELAM_CASE_OPTIONS,
  ELAM_KIND,
  REVENUE_TYPE_OPTIONS,
  WEB_STAT_META,
  elamsApi,
  type ElamCartableItemDto,
  type ElamKind,
} from './api';

const PAGE_SIZE = 20;

export function jalali(value: string | null): string {
  if (!value) return '—';
  if (value.length !== 8) return toPersianDigits(value);
  return toPersianDigits(`${value.slice(0, 4)}/${value.slice(4, 6)}/${value.slice(6, 8)}`);
}

export function amount(value: number): string {
  return toPersianDigits(value.toLocaleString('en-US'));
}

type PendingAction = { kind: 'voucher' | 'first' | 'final' | 'delete'; row: ElamCartableItemDto } | null;

const ACTION_TEXT: Record<'voucher' | 'first' | 'final' | 'delete', { title: string; body: (r: ElamCartableItemDto) => string }> = {
  voucher: { title: 'صدور سند', body: (r) => `برای اعلامیهٔ ${toPersianDigits(r.serialNo ?? '')} سند موقت صادر شود؟` },
  first: { title: 'تأیید اولیه', body: (r) => `اعلامیهٔ ${toPersianDigits(r.serialNo ?? '')} تأیید اولیه شود؟` },
  final: {
    title: 'تأیید نهایی و ارسال',
    body: (r) =>
      r.kind === ELAM_KIND.Sent
        ? `با تأیید نهایی، اعلامیهٔ رسیده و سند آن خودکار در واحد ${r.counterVahedName ?? r.counterVahedCode ?? ''} ساخته می‌شود و دیگر قابل برگشت نیست.`
        : 'اعلامیه به سامانهٔ سبا (درآمد) ارسال می‌شود و دیگر قابل برگشت نیست.',
  },
  delete: { title: 'حذف اعلامیه', body: (r) => `اعلامیهٔ ${toPersianDigits(r.serialNo ?? '')} با همهٔ ردیف‌هایش حذف شود؟` },
};

/** اسناد اعلامیه — کارتابل صادره / رسیده / درآمد، با صدور سند و گردش تأیید. */
export function ElamsListPage() {
  const navigate = useNavigate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { financialYear, isConfigured } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const kind = (Number(searchParams.get('kind')) || ELAM_KIND.Sent) as ElamKind;

  const emptyDraft = { serialFrom: '', serialTo: '', dateFrom: '', dateTo: '', dabirNo: '', counterVahedCode: '' };
  const [draft, setDraft] = useState(emptyDraft);
  const [applied, setApplied] = useState(emptyDraft);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [pending, setPending] = useState<PendingAction>(null);

  const units = useQuery({ queryKey: ['elam-units'], queryFn: elamsApi.units, enabled: isConfigured });

  const list = useQuery({
    queryKey: ['elams', financialYear, kind, pageNumber, pageSize, applied],
    queryFn: () =>
      elamsApi.cartable({
        year: financialYear,
        kind,
        pageNumber,
        pageSize,
        serialFrom: toLatinDigits(applied.serialFrom) || undefined,
        serialTo: toLatinDigits(applied.serialTo) || undefined,
        dateFrom: applied.dateFrom || undefined,
        dateTo: applied.dateTo || undefined,
        dabirNo: toLatinDigits(applied.dabirNo) || undefined,
        counterVahedCode: applied.counterVahedCode || undefined,
      }),
    enabled: isConfigured && !!financialYear,
  });

  const action = useMutation({
    mutationFn: async (p: NonNullable<PendingAction>) => {
      switch (p.kind) {
        case 'voucher': {
          const r = await elamsApi.issueVoucher(p.row.id);
          return `سند شمارهٔ ${toPersianDigits(r.docNum)} صادر شد.`;
        }
        case 'first':
          await elamsApi.confirmFirst(p.row.id);
          return 'تأیید اولیه انجام شد.';
        case 'final':
          await elamsApi.confirmFinal(p.row.id);
          return p.row.kind === ELAM_KIND.Revenue
            ? 'اعلامیه به سامانهٔ سبا (درآمد) ارسال شد.'
            : 'اعلامیه ارسال شد و در واحد گیرنده ثبت شد.';
        case 'delete':
          await elamsApi.remove(p.row.id);
          return 'اعلامیه حذف شد.';
      }
    },
    onSuccess: async (message) => {
      await queryClient.invalidateQueries({ queryKey: ['elams'] });
      notify(message);
      setPending(null);
    },
  });

  function changeKind(next: ElamKind) {
    setSearchParams({ kind: String(next) });
    setPageNumber(1);
    setDraft(emptyDraft);
    setApplied(emptyDraft);
  }

  const s = (r: ElamCartableItemDto) => r.webStat ?? 0;
  const canVoucher = (r: ElamCartableItemDto) => !r.voucherHeadId && (s(r) === 5 || s(r) === 1 || s(r) === 9);
  const canFirst = (r: ElamCartableItemDto) => s(r) === 6 || s(r) === 2;
  const canFinal = (r: ElamCartableItemDto) => s(r) === 7 || s(r) === 3;
  const canDelete = (r: ElamCartableItemDto) => !r.voucherHeadId && (s(r) === 5 || s(r) === 1);

  const columns: DataTableColumn<ElamCartableItemDto>[] = [
    { key: 'serial', header: 'سریال', render: (r) => <MonoCode value={r.serialNo} /> },
    { key: 'date', header: 'تاریخ', render: (r) => jalali(r.date) },
    {
      key: 'counter',
      header: kind === ELAM_KIND.Received ? 'واحد فرستنده' : kind === ELAM_KIND.Revenue ? 'واحد شعبه' : 'واحد گیرنده',
      render: (r) => (r.counterVahedCode ? `${toPersianDigits(r.counterVahedCode)} — ${r.counterVahedName ?? ''}` : '—'),
    },
    kind === ELAM_KIND.Revenue
      ? {
          key: 'type',
          header: 'نوع درآمد',
          render: (r) => REVENUE_TYPE_OPTIONS.find((o) => o.value === r.revenueType)?.label ?? '—',
        }
      : {
          key: 'case',
          header: 'ماهیت',
          render: (r) => ELAM_CASE_OPTIONS.find((o) => o.value === r.case)?.label ?? '—',
        },
    { key: 'desc', header: 'شرح', render: (r) => r.description ?? '—' },
    { key: 'amount', header: 'مبلغ', align: 'end', render: (r) => amount(r.amount) },
    {
      key: 'state',
      header: 'وضعیت',
      render: (r) => {
        const m = WEB_STAT_META[s(r)];
        return m ? <Chip size="small" color={m.color} label={m.label} /> : '—';
      },
    },
    { key: 'dabir', header: 'شمارهٔ دبیرخانه', render: (r) => toPersianDigits(r.dabirNo ?? '—') },
    {
      key: 'voucher',
      header: 'سند',
      render: (r) =>
        r.voucherHeadId ? (
          <Button size="small" onClick={() => navigate(`/operation/vouchers/${r.voucherHeadId}/view`)}>
            {toPersianDigits(r.voucherNumber ?? '')} · {jalali(r.voucherDate)}
          </Button>
        ) : (
          '—'
        ),
    },
    {
      key: 'act',
      header: 'عملیات',
      align: 'end',
      render: (r) => (
        <Stack direction="row" spacing={0.25} sx={{ justifyContent: 'flex-end' }}>
          <Tooltip title={canDelete(r) ? 'ویرایش' : 'نمایش'}>
            <IconButton size="small" color="primary" onClick={() => navigate(`/operation/elams/${r.id}`)}>
              <VisibilityOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {canVoucher(r) && (
            <Tooltip title="صدور سند">
              <IconButton size="small" color="info" onClick={() => setPending({ kind: 'voucher', row: r })}>
                <ReceiptLongOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {canFirst(r) && (
            <Tooltip title="تأیید اولیه">
              <IconButton size="small" color="success" onClick={() => setPending({ kind: 'first', row: r })}>
                <CheckOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {canFinal(r) && (
            <Tooltip title="تأیید نهایی و ارسال">
              <IconButton size="small" color="success" onClick={() => setPending({ kind: 'final', row: r })}>
                <DoneAllOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {canDelete(r) && (
            <Tooltip title="حذف">
              <IconButton size="small" color="error" onClick={() => setPending({ kind: 'delete', row: r })}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      ),
    },
  ];

  return (
    <section>
      <PageHeader
        eyebrow="عملیات"
        icon={<CampaignOutlinedIcon />}
        title="اسناد اعلامیه"
        description={`اعلامیه‌های صادره، رسیده و درآمد واحد جاری در سال ${toPersianDigits(financialYear || '—')}.`}
        actions={
          kind !== ELAM_KIND.Received && (
            <Button
              variant="contained"
              startIcon={<AddOutlinedIcon />}
              onClick={() => navigate(`/operation/elams/new?kind=${kind}`)}
            >
              {kind === ELAM_KIND.Revenue ? 'اعلامیهٔ درآمد جدید' : 'اعلامیهٔ جدید'}
            </Button>
          )
        }
      />

      <Tabs value={kind} onChange={(_, v) => changeKind(v)} sx={{ mb: 2 }}>
        <Tab value={ELAM_KIND.Sent} label="سایر اعلامیه‌ها — صادره" />
        <Tab value={ELAM_KIND.Received} label="سایر اعلامیه‌ها — رسیده" />
        <Tab value={ELAM_KIND.Revenue} label="اعلامیهٔ درآمد" />
      </Tabs>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <TextField size="small" label="از سریال" value={draft.serialFrom} onChange={(e) => setDraft({ ...draft, serialFrom: e.target.value })} />
          <TextField size="small" label="تا سریال" value={draft.serialTo} onChange={(e) => setDraft({ ...draft, serialTo: e.target.value })} />
          <JalaliDateField size="small" label="از تاریخ" value={draft.dateFrom} onChange={(v) => setDraft({ ...draft, dateFrom: v })} />
          <JalaliDateField size="small" label="تا تاریخ" value={draft.dateTo} onChange={(v) => setDraft({ ...draft, dateTo: v })} />
          <TextField size="small" label="شمارهٔ دبیرخانه" value={draft.dabirNo} onChange={(e) => setDraft({ ...draft, dabirNo: e.target.value })} />
          <TextField
            select
            size="small"
            label="واحد طرف"
            value={draft.counterVahedCode}
            onChange={(e) => setDraft({ ...draft, counterVahedCode: e.target.value })}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">همه</MenuItem>
            {(units.data ?? []).map((u) => (
              <MenuItem key={u.vahedCode} value={u.vahedCode}>
                {toPersianDigits(u.vahedCode)} — {u.vahedName}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            startIcon={<PostAddOutlinedIcon />}
            onClick={() => {
              setPageNumber(1);
              setApplied(draft);
            }}
          >
            اعمال فیلتر
          </Button>
          <Button
            onClick={() => {
              setDraft(emptyDraft);
              setApplied(emptyDraft);
              setPageNumber(1);
            }}
          >
            پاک کردن
          </Button>
        </Stack>
      </Paper>

      {list.isError && <ErrorBanner error={list.error} />}
      {action.isError && <ErrorBanner error={action.error} />}

      <DataTable
        pageable={false}
        columns={columns}
        rows={list.data?.items ?? []}
        getRowKey={(r) => r.id}
        isLoading={list.isLoading}
        emptyMessage={
          kind === ELAM_KIND.Received
            ? 'اعلامیهٔ رسیده‌ای برای این واحد نیست. اعلامیه‌های رسیده با تأیید نهایی واحد فرستنده خودکار اینجا می‌آیند.'
            : 'اعلامیه‌ای ثبت نشده است.'
        }
      />
      <Pagination
        pageNumber={pageNumber}
        pageSize={pageSize}
        totalCount={list.data?.totalCount ?? 0}
        onPageChange={setPageNumber}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPageNumber(1);
        }}
      />

      <ConfirmDialog
        open={pending !== null}
        title={pending ? ACTION_TEXT[pending.kind].title : ''}
        description={pending ? ACTION_TEXT[pending.kind].body(pending.row) : undefined}
        pending={action.isPending}
        onCancel={() => {
          setPending(null);
          action.reset();
        }}
        onConfirm={() => pending && action.mutate(pending)}
      />
    </section>
  );
}
