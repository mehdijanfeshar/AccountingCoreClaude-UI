import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import ArrowDownwardOutlinedIcon from '@mui/icons-material/ArrowDownwardOutlined';
import ArrowUpwardOutlinedIcon from '@mui/icons-material/ArrowUpwardOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined';
import RedoOutlinedIcon from '@mui/icons-material/RedoOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { PageHeader } from '../../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../../components/DataTable';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { useNotify } from '../../../lib/notifications/NotificationProvider';
import { useSession } from '../../../lib/session/SessionContext';
import { toLatinDigits, toPersianDigits } from '../../../lib/format/numbers';
import { FS_FRAMEWORK_OPTIONS, type FsFrameworkValue } from '../../../types/fsTemplate';
import { FS_NARRATIVE_ACTION, FS_NARRATIVE_STATE_META, type FsNarrativeDto } from '../../../types/fsNarrative';
import { fsNarrativesApi } from '../api';
import { FsNarrativeEditorDialog } from './FsNarrativeEditorDialog';

/**
 * ح-۶ — یادداشت‌های توضیحی متنی (سند منبع §۹ و §۱۲-۳): فهرست با وضعیت و پیشرفت کلی، ویرایشگر غنی با متغیر،
 * گردش ارسال/تأیید/برگشت، تاریخچهٔ نسخه با بازگردانی، و انتقال از سال قبل. یادداشت‌های واحد جاری.
 */
export function FsNarrativesPage() {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { financialYear, unitCode } = useSession();
  const [framework, setFramework] = useState<FsFrameworkValue>(1);
  const [year, setYear] = useState(financialYear || '');
  const [editing, setEditing] = useState<{ narrative: FsNarrativeDto | null; content?: string | null; readOnly: boolean } | null>(null);
  const [returning, setReturning] = useState<FsNarrativeDto | null>(null);
  const [comment, setComment] = useState('');
  const [pendingDelete, setPendingDelete] = useState<FsNarrativeDto | null>(null);
  const [history, setHistory] = useState<FsNarrativeDto | null>(null);

  const yearValid = /^1[34]\d{2}$/.test(year);
  const key = ['fs-narratives', unitCode, framework, year];
  const listQuery = useQuery({ queryKey: key, queryFn: () => fsNarrativesApi.list(framework, year), enabled: yearValid });
  const rows = listQuery.data ?? [];
  const approved = rows.filter((n) => n.state === 3).length;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['fs-narratives'] });

  const versionsQuery = useQuery({
    queryKey: ['fs-narrative-versions', history?.id],
    queryFn: () => fsNarrativesApi.versions(history!.id),
    enabled: !!history,
  });

  const transition = useMutation({
    mutationFn: ({ n, action, c }: { n: FsNarrativeDto; action: number; c: string | null }) => fsNarrativesApi.transition(n.id, action, c),
    onSuccess: async () => {
      setReturning(null);
      setComment('');
      await refresh();
    },
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => fsNarrativesApi.reorder(framework, year, ids),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: (n: FsNarrativeDto) => fsNarrativesApi.remove(n.id),
    onSuccess: async () => {
      setPendingDelete(null);
      await refresh();
      notify('یادداشت حذف شد.');
    },
  });

  const rollForward = useMutation({
    mutationFn: () => fsNarrativesApi.rollForward(framework, year),
    onSuccess: async (count) => {
      await refresh();
      notify(`${toPersianDigits(count)} یادداشت از سال ${toPersianDigits(Number(year) - 1)} منتقل شد.`);
    },
  });

  const move = (index: number, delta: number) => {
    const ids = rows.map((r) => r.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate(ids);
  };

  const editable = (n: FsNarrativeDto) => n.state === 1 || n.state === 4;

  const columns: DataTableColumn<FsNarrativeDto>[] = [
    { key: 'no', header: '#', width: 50, render: (n) => toPersianDigits(rows.indexOf(n) + 1) },
    {
      key: 'title',
      header: 'عنوان',
      render: (n) => (
        <Stack>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {n.titleFa}
          </Typography>
          {n.reviewComment && (
            <Typography variant="caption" color="warning.main">
              برگشت: {n.reviewComment}
            </Typography>
          )}
        </Stack>
      ),
    },
    { key: 'linked', header: 'همراه یادداشت', render: (n) => n.linkedTemplateCode ?? <em>مستقل</em> },
    { key: 'resp', header: 'مسئول', render: (n) => n.responsibleUserId ?? '—' },
    {
      key: 'state',
      header: 'وضعیت',
      render: (n) => <Chip size="small" color={FS_NARRATIVE_STATE_META[n.state].color} label={FS_NARRATIVE_STATE_META[n.state].label} />,
    },
    {
      key: 'ver',
      header: 'نسخه',
      render: (n) => `${toPersianDigits(n.versionNo)} · ${n.lastEditedBy}`,
    },
    {
      key: 'act',
      header: 'عملیات',
      align: 'end',
      render: (n) => {
        const i = rows.indexOf(n);
        return (
          <Stack direction="row" spacing={0} sx={{ justifyContent: 'flex-end' }}>
            <IconButton size="small" aria-label="بالا" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)}>
              <ArrowUpwardOutlinedIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" aria-label="پایین" disabled={i === rows.length - 1 || reorder.isPending} onClick={() => move(i, 1)}>
              <ArrowDownwardOutlinedIcon fontSize="small" />
            </IconButton>
            <Tooltip title={editable(n) ? 'ویرایش' : 'مشاهده'}>
              <IconButton size="small" color="primary" onClick={() => setEditing({ narrative: n, readOnly: !editable(n) })}>
                {editable(n) ? <EditOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            {editable(n) && (
              <Tooltip title="ارسال برای بازبینی">
                <IconButton size="small" disabled={transition.isPending} onClick={() => transition.mutate({ n, action: FS_NARRATIVE_ACTION.Submit, c: null })}>
                  <SendOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {n.state === 2 && (
              <Tooltip title="تأیید">
                <IconButton
                  size="small"
                  color="success"
                  disabled={transition.isPending}
                  onClick={() => transition.mutate({ n, action: FS_NARRATIVE_ACTION.Approve, c: null })}
                >
                  <TaskAltOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {(n.state === 2 || n.state === 3) && (
              <Tooltip title="برگشت برای اصلاح">
                <IconButton size="small" color="warning" onClick={() => setReturning(n)}>
                  <UndoOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="تاریخچهٔ نسخه‌ها">
              <IconButton size="small" onClick={() => setHistory(n)}>
                <HistoryOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {editable(n) && (
              <Tooltip title="حذف">
                <IconButton size="small" color="error" onClick={() => setPendingDelete(n)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        );
      },
    },
  ];

  return (
    <section>
      <PageHeader
        eyebrow="صورت‌های مالی"
        icon={<NotesOutlinedIcon />}
        title="یادداشت‌های توضیحی"
        description="متن یادداشت‌ها با متغیرهایی که هنگام نمایش صورت از اعداد همان اجرا مقدار می‌گیرند. با انتشار صورت‌ها متن ثابت می‌شود."
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<RedoOutlinedIcon />}
              disabled={!yearValid || rows.length > 0 || rollForward.isPending}
              onClick={() => rollForward.mutate()}
            >
              انتقال از سال قبل
            </Button>
            <Button variant="contained" startIcon={<AddOutlinedIcon />} disabled={!yearValid} onClick={() => setEditing({ narrative: null, readOnly: false })}>
              یادداشت تازه
            </Button>
          </Stack>
        }
      />

      <Tabs value={framework} onChange={(_, v: FsFrameworkValue) => setFramework(v)} sx={{ mb: 2 }}>
        {FS_FRAMEWORK_OPTIONS.map((o) => (
          <Tab key={o.value} value={o.value} label={o.label} />
        ))}
      </Tabs>

      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
          <TextField
            size="small"
            label="سال مالی"
            value={toPersianDigits(year)}
            onChange={(e) => setYear(toLatinDigits(e.target.value).replace(/\D/g, '').slice(0, 4))}
            sx={{ width: 110 }}
          />
          <Stack sx={{ flex: 1, minWidth: 200 }}>
            <Typography variant="caption" color="text.secondary">
              پیشرفت: {toPersianDigits(approved)} از {toPersianDigits(rows.length)} یادداشت تأییدشده
            </Typography>
            <LinearProgress variant="determinate" value={rows.length ? (approved / rows.length) * 100 : 0} sx={{ mt: 0.5, borderRadius: 1 }} />
          </Stack>
        </Stack>
      </Paper>

      {listQuery.isError && <ErrorBanner error={listQuery.error} />}
      {(transition.error ?? reorder.error ?? rollForward.error ?? remove.error) && !returning && !pendingDelete && (
        <ErrorBanner error={transition.error ?? reorder.error ?? rollForward.error ?? remove.error} />
      )}

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(n) => n.id}
        isLoading={listQuery.isLoading && yearValid}
        emptyMessage="هنوز یادداشت توضیحی ثبت نشده — «یادداشت تازه» یا «انتقال از سال قبل»."
      />

      {editing && (
        <FsNarrativeEditorDialog
          framework={framework}
          year={year}
          narrative={editing.narrative}
          initialContent={editing.content}
          readOnly={editing.readOnly}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
            notify('یادداشت ذخیره شد.');
          }}
        />
      )}

      <Dialog open={returning !== null} onClose={() => setReturning(null)} maxWidth="sm" fullWidth>
        <DialogTitle>برگشت برای اصلاح</DialogTitle>
        <DialogContent>
          {transition.isError && <ErrorBanner error={transition.error} />}
          <TextField autoFocus fullWidth multiline minRows={3} label="دلیل" value={comment} onChange={(e) => setComment(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReturning(null)}>انصراف</Button>
          <Button
            variant="contained"
            color="warning"
            disabled={!comment.trim() || transition.isPending}
            onClick={() => returning && transition.mutate({ n: returning, action: FS_NARRATIVE_ACTION.Return, c: comment.trim() })}
          >
            برگشت
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={history !== null} onClose={() => setHistory(null)} maxWidth="sm" fullWidth>
        <DialogTitle>تاریخچهٔ «{history?.titleFa}»</DialogTitle>
        <DialogContent>
          {versionsQuery.isError && <ErrorBanner error={versionsQuery.error} />}
          <DataTable
            columns={[
              { key: 'v', header: 'نسخه', width: 60, render: (v) => toPersianDigits(v.versionNo) },
              { key: 'd', header: 'زمان', render: (v) => toPersianDigits(new Date(v.createdDate).toLocaleString('fa-IR')) },
              { key: 'u', header: 'کاربر', render: (v) => v.addUserId },
              {
                key: 'a',
                header: '',
                align: 'end',
                render: (v) =>
                  history && (
                    <Button
                      size="small"
                      onClick={() => {
                        const n = history;
                        setHistory(null);
                        setEditing({ narrative: n, content: v.contentJson, readOnly: !editable(n) });
                      }}
                    >
                      {history && editable(history) ? 'بازگردانی' : 'مشاهده'}
                    </Button>
                  ),
              },
            ]}
            rows={versionsQuery.data ?? []}
            getRowKey={(v) => String(v.versionNo)}
            isLoading={versionsQuery.isLoading}
            emptyMessage="نسخه‌ای نیست."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistory(null)}>بستن</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف یادداشت"
        description={pendingDelete ? `یادداشت «${pendingDelete.titleFa}» حذف می‌شود.` : undefined}
        pending={remove.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete)}
      />
    </section>
  );
}
