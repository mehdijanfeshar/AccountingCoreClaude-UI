import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { useSession } from '../../lib/session/SessionContext';
import { toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import {
  FS_PERIOD_ACTION,
  FS_PERIOD_ACTION_LABEL,
  FS_PERIOD_STATE_META,
  FS_RUN_STATE,
  FS_RUN_STATE_META,
  type FsPeriodUnitDto,
} from '../../types/fsRun';
import { fsPeriodsApi } from './api';

/** مراحل خط لولهٔ سند منبع §۱۲-۳ که از دادهٔ موجود قابل محاسبه‌اند. */
const PIPELINE = [
  { key: 'open', label: 'باز' },
  { key: 'prepared', label: 'صورت تهیه‌شده' },
  { key: 'review', label: 'در بازبینی/تأیید' },
  { key: 'closed', label: 'بستهٔ موقت' },
  { key: 'locked', label: 'قفل' },
  { key: 'published', label: 'منتشرشده' },
] as const;

const REASON_ACTIONS = new Set<number>([FS_PERIOD_ACTION.Reopen, FS_PERIOD_ACTION.RequestReopen, FS_PERIOD_ACTION.RejectReopen]);

/**
 * ح-۵ — «بستن دوره و گردش تأیید» (سند منبع §۱۱ و §۱۲-۳): واحد جاری و زیرواحدهای مستقیمش (برای ستاد =
 * ادارات کل) با وضعیت دورهٔ سال، آخرین اجرای صورت‌ها و نتیجهٔ کنترل‌ها. بستن ← قفل؛ بازگشایی دورهٔ قفل با
 * درخواست و تأیید ستاد. فقط برای صورت‌هاست (انتشار بدون قفل ممکن نیست — V-11)؛ ثبت سند را نمی‌بندد.
 */
export function FsPeriodClosePage() {
  const navigate = useNavigate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { financialYear, unitCode } = useSession();
  const [year, setYear] = useState(financialYear || '');
  const [pending, setPending] = useState<{ unit: FsPeriodUnitDto; action: number } | null>(null);
  const [reason, setReason] = useState('');
  const [logUnit, setLogUnit] = useState<FsPeriodUnitDto | null>(null);

  const yearValid = /^1[34]\d{2}$/.test(year);
  const boardQuery = useQuery({
    queryKey: ['fs-periods', unitCode, year],
    queryFn: () => fsPeriodsApi.board(year),
    enabled: yearValid,
  });
  const board = boardQuery.data;
  // ح-۹ — کلیک روی کاشی داشبورد ⇒ ?unit=کد: فقط همان واحد.
  const [searchParams, setSearchParams] = useSearchParams();
  const unitFilter = searchParams.get('unit');
  const units = useMemo(() => (board?.units ?? []).filter((u) => !unitFilter || u.vahedCode === unitFilter), [board, unitFilter]);

  const logQuery = useQuery({
    queryKey: ['fs-period-log', logUnit?.vahedCode, year],
    queryFn: () => fsPeriodsApi.log(logUnit!.vahedCode, year),
    enabled: !!logUnit,
  });

  const transition = useMutation({
    mutationFn: ({ unit, action }: { unit: FsPeriodUnitDto; action: number }) =>
      fsPeriodsApi.transition(unit.vahedCode, year, action, reason.trim() || null),
    onSuccess: async (_, v) => {
      setPending(null);
      setReason('');
      await queryClient.invalidateQueries({ queryKey: ['fs-periods'] });
      notify(`${FS_PERIOD_ACTION_LABEL[v.action]} برای واحد ${v.unit.vahedCode} انجام شد.`);
    },
  });

  const stageOf = (u: FsPeriodUnitDto): (typeof PIPELINE)[number]['key'] => {
    const effectiveLocked = u.state === 3 || !!u.lockedVia;
    if (u.latestRun?.state === FS_RUN_STATE.Published) return 'published';
    if (effectiveLocked) return 'locked';
    if (u.state === 2) return 'closed';
    if (u.latestRun && (u.latestRun.state === FS_RUN_STATE.InReview || u.latestRun.state === FS_RUN_STATE.Approved)) return 'review';
    if (u.latestRun) return 'prepared';
    return 'open';
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const u of units) c[stageOf(u)] = (c[stageOf(u)] ?? 0) + 1;
    return c;
  }, [units]);

  const act = (unit: FsPeriodUnitDto, action: number) => {
    transition.reset();
    setReason('');
    if (REASON_ACTIONS.has(action) || action === FS_PERIOD_ACTION.Lock || action === FS_PERIOD_ACTION.ApproveReopen) {
      setPending({ unit, action });
    } else {
      transition.mutate({ unit, action });
    }
  };

  const actionsFor = (u: FsPeriodUnitDto) => {
    const list: { action: number; color?: 'warning' | 'success' | 'error' }[] = [];
    if (u.state === 1) list.push({ action: FS_PERIOD_ACTION.Close });
    if (u.state === 2) list.push({ action: FS_PERIOD_ACTION.Lock, color: 'success' }, { action: FS_PERIOD_ACTION.Reopen, color: 'warning' });
    if (u.state === 3 && !u.reopenRequested) list.push({ action: FS_PERIOD_ACTION.RequestReopen, color: 'warning' });
    if (u.state === 3 && u.reopenRequested && board?.isHeadquarters)
      list.push({ action: FS_PERIOD_ACTION.ApproveReopen, color: 'success' }, { action: FS_PERIOD_ACTION.RejectReopen, color: 'error' });
    return list;
  };

  const columns: DataTableColumn<FsPeriodUnitDto>[] = [
    {
      key: 'unit',
      header: 'واحد',
      render: (u) => (
        <Typography variant="body2" sx={{ fontWeight: u.isSelf ? 700 : 400 }}>
          {toPersianDigits(u.vahedCode)} — {u.vahedName ?? ''}
          {u.isSelf ? ' (کل)' : ''}
        </Typography>
      ),
    },
    {
      key: 'state',
      header: 'وضعیت دوره',
      render: (u) => (
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
          <Chip size="small" color={FS_PERIOD_STATE_META[u.state].color} label={FS_PERIOD_STATE_META[u.state].label} />
          {u.lockedVia && <Chip size="small" variant="outlined" color="success" label={`قفل از طریق ${toPersianDigits(u.lockedVia)}`} />}
          {u.reopenRequested && (
            <Chip size="small" color="warning" variant="outlined" label={`درخواست بازگشایی (${u.reopenRequestedBy})`} title={u.reopenReason ?? ''} />
          )}
        </Stack>
      ),
    },
    {
      key: 'run',
      header: 'آخرین صورت',
      render: (u) =>
        u.latestRun ? (
          <Button size="small" onClick={() => navigate(`/fs/runs/${u.latestRun!.runId}`)}>
            اجرای {toPersianDigits(u.latestRun.runNo)} · {FS_RUN_STATE_META[u.latestRun.state]?.label ?? ''}
          </Button>
        ) : (
          <Typography variant="caption" color="text.secondary">
            تهیه نشده
          </Typography>
        ),
    },
    {
      key: 'checks',
      header: 'کنترل‌ها',
      render: (u) =>
        u.latestRun ? (
          u.latestRun.blockingFailed > 0 ? (
            <Chip size="small" color="error" variant="outlined" label={`${toPersianDigits(u.latestRun.blockingFailed)} مسدودکننده`} />
          ) : (
            <Chip size="small" color="success" variant="outlined" label="بدون خطای مسدودکننده" />
          )
        ) : (
          '—'
        ),
    },
    {
      key: 'act',
      header: 'اقدام',
      align: 'end',
      render: (u) => (
        <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end', flexWrap: 'wrap', gap: 0.5 }}>
          {actionsFor(u).map((a) => (
            <Button
              key={a.action}
              size="small"
              variant="outlined"
              color={a.color ?? 'primary'}
              disabled={transition.isPending}
              onClick={() => act(u, a.action)}
            >
              {FS_PERIOD_ACTION_LABEL[a.action]}
            </Button>
          ))}
          <Button size="small" startIcon={<HistoryOutlinedIcon />} onClick={() => setLogUnit(u)}>
            تاریخچه
          </Button>
        </Stack>
      ),
    },
  ];

  const pendingNeedsReason = pending && REASON_ACTIONS.has(pending.action);

  return (
    <section>
      <PageHeader
        eyebrow="صورت‌های مالی"
        icon={<EventAvailableOutlinedIcon />}
        title="بستن دوره"
        description="وضعیت دورهٔ سال برای واحد جاری و زیرواحدهای آن. انتشار صورت‌ها فقط وقتی ممکن است که دورهٔ همهٔ واحدهای دامنه قفل باشد (کنترل V-11). این قفل ثبت سند را نمی‌بندد."
      />

      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
          <TextField
            size="small"
            label="سال مالی"
            value={toPersianDigits(year)}
            onChange={(e) => setYear(toLatinDigits(e.target.value).replace(/\D/g, '').slice(0, 4))}
            sx={{ width: 110 }}
          />
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
            {PIPELINE.map((p, i) => (
              <Stack key={p.key} direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                {i > 0 && <Box component="span" aria-hidden sx={{ color: 'text.disabled' }}>←</Box>}
                <Chip size="small" variant={counts[p.key] ? 'filled' : 'outlined'} label={`${p.label}: ${toPersianDigits(counts[p.key] ?? 0)}`} />
              </Stack>
            ))}
          </Stack>
        </Stack>
      </Paper>

      {unitFilter && (
        <Chip
          sx={{ mb: 2 }}
          label={`فقط واحد ${toPersianDigits(unitFilter)}`}
          onDelete={() => setSearchParams({})}
        />
      )}
      {board && !board.isHeadquarters && (
        <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
          بازگشایی دورهٔ قفل‌شده با «درخواست بازگشایی» و تأیید ستاد انجام می‌شود.
        </Alert>
      )}
      {boardQuery.isError && <ErrorBanner error={boardQuery.error} />}
      {transition.isError && !pending && <ErrorBanner error={transition.error} />}

      <DataTable
        columns={columns}
        rows={units}
        getRowKey={(u) => u.vahedCode}
        isLoading={boardQuery.isLoading && yearValid}
        emptyMessage="واحدی برای نمایش نیست."
      />

      <Dialog open={pending !== null} onClose={() => setPending(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {pending ? `${FS_PERIOD_ACTION_LABEL[pending.action]} — واحد ${toPersianDigits(pending.unit.vahedCode)}، سال ${toPersianDigits(year)}` : ''}
        </DialogTitle>
        <DialogContent>
          {transition.isError && <ErrorBanner error={transition.error} />}
          {pending?.action === FS_PERIOD_ACTION.Lock && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              پس از قفل، بازگشایی فقط با درخواست و تأیید ستاد ممکن است. قفل این واحد زیرواحدهایش را هم قفل‌شده حساب می‌کند.
            </Typography>
          )}
          {pending?.action === FS_PERIOD_ACTION.ApproveReopen && (
            <Typography variant="body2" sx={{ mb: 2 }}>
              دلیل درخواست: {pending.unit.reopenReason ?? '—'} · دوره به «بستهٔ موقت» برمی‌گردد.
            </Typography>
          )}
          {(pendingNeedsReason || pending?.action === FS_PERIOD_ACTION.ApproveReopen) && (
            <TextField
              autoFocus
              fullWidth
              multiline
              minRows={3}
              label={pendingNeedsReason ? 'دلیل' : 'توضیح (اختیاری)'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 1000 } }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPending(null)} disabled={transition.isPending}>
            انصراف
          </Button>
          <Button
            variant="contained"
            disabled={transition.isPending || (!!pendingNeedsReason && !reason.trim())}
            onClick={() => pending && transition.mutate(pending)}
          >
            {pending ? FS_PERIOD_ACTION_LABEL[pending.action] : ''}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={logUnit !== null} onClose={() => setLogUnit(null)} maxWidth="md" fullWidth>
        <DialogTitle>تاریخچهٔ دورهٔ واحد {logUnit ? toPersianDigits(logUnit.vahedCode) : ''}</DialogTitle>
        <DialogContent>
          {logQuery.isError && <ErrorBanner error={logQuery.error} />}
          <DataTable
            columns={[
              { key: 'd', header: 'زمان', render: (l) => toPersianDigits(new Date(l.createdDate).toLocaleString('fa-IR')) },
              { key: 'a', header: 'اقدام', render: (l) => FS_PERIOD_ACTION_LABEL[l.action] ?? l.action },
              { key: 's', header: 'وضعیت', render: (l) => `${FS_PERIOD_STATE_META[l.fromState].label} ← ${FS_PERIOD_STATE_META[l.toState].label}` },
              { key: 'u', header: 'کاربر', render: (l) => l.userId },
              { key: 'r', header: 'دلیل', render: (l) => l.reason ?? '—' },
            ]}
            rows={logQuery.data ?? []}
            getRowKey={(l) => `${l.createdDate}-${l.action}`}
            isLoading={logQuery.isLoading}
            emptyMessage="هنوز اقدامی ثبت نشده است."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogUnit(null)}>بستن</Button>
        </DialogActions>
      </Dialog>
    </section>
  );
}
