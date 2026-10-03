import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import ArrowDownwardOutlinedIcon from '@mui/icons-material/ArrowDownwardOutlined';
import ArrowUpwardOutlinedIcon from '@mui/icons-material/ArrowUpwardOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import FileCopyOutlinedIcon from '@mui/icons-material/FileCopyOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorBanner } from '../../components/ErrorBanner';
import { MonoCode } from '../../components/MonoCode';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { useSession } from '../../lib/session/SessionContext';
import { toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import {
  FS_NORMAL_BALANCE_OPTIONS,
  FS_ROW_TYPE,
  FS_ROW_TYPE_OPTIONS,
  FS_VALUE_TYPE_OPTIONS,
  FS_VERSION_STATE,
  FS_VERSION_STATE_META,
  labelOf,
  type FsTemplateCheckResultDto,
  type FsTemplateRowDto,
} from '../../types/fsTemplate';
import { fsTemplatesApi, fsTemplateVersionsApi } from './api';
import { FsRowFormDialog } from './FsRowFormDialog';
import { FsTemplatePreviewDialog } from "./FsTemplatePreviewDialog";
import PreviewOutlinedIcon from "@mui/icons-material/PreviewOutlined";

function nextRowCode(rows: FsTemplateRowDto[]): string {
  const last = rows[rows.length - 1]?.code;
  const m = last?.match(/^([A-Za-z_]*)(\d+)$/);
  if (!m) return '';
  const next = String(Number(m[2]) + 1).padStart(m[2].length, '0');
  const candidate = m[1] + next;
  return rows.some((r) => r.code === candidate) ? '' : candidate;
}

/**
 * ویرایش یک نسخهٔ قالب صورت مالی (بخش ۴۵-الف): ردیف‌ها به ترتیب ارائه، افزودن/ویرایش/حذف/جابه‌جایی
 * (فقط پیش‌نویس)، «بررسی قالب» (ارجاع‌ها، دور، فیلدهای لازم) و فعال‌سازی از یک سال مالی.
 */
export function FsTemplateVersionPage() {
  const { versionId = '' } = useParams();
  const navigate = useNavigate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { financialYear } = useSession();
  const ownerLabel = (v: { ownerVahedCode: string | null }) => (v.ownerVahedCode ? `قالب اختصاصی واحد ${v.ownerVahedCode}` : 'قالب مشترک');

  const [editing, setEditing] = useState<FsTemplateRowDto | 'new' | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FsTemplateRowDto | null>(null);
  const [deletingVersion, setDeletingVersion] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [activateYear, setActivateYear] = useState('');
  const [check, setCheck] = useState<FsTemplateCheckResultDto | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { unitCode } = useSession();
  const queryKey = ['fs-template-version', versionId, unitCode];
  const versionQuery = useQuery({ queryKey, queryFn: () => fsTemplateVersionsApi.get(versionId), enabled: !!versionId });
  const version = versionQuery.data;
  const rows = useMemo(() => version?.rows ?? [], [version]);
  // «پیش‌نویس» فقط وقتی قابل ویرایش است که واحد جاری مالک باشد (مشترک = فقط ستاد).
  const canEdit = version?.canEdit ?? false;
  const isDraft = version?.state === FS_VERSION_STATE.Draft && canEdit;

  const depthById = useMemo(() => {
    const byId = new Map(rows.map((r) => [r.id, r]));
    const depth = new Map<string, number>();
    for (const r of rows) {
      let d = 0;
      for (let p = r.parentId; p && d < 10; p = byId.get(p)?.parentId ?? null) d++;
      depth.set(r.id, d);
    }
    return depth;
  }, [rows]);

  const issuesByRow = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of check?.issues ?? []) {
      if (i.rowCode) map.set(i.rowCode, Math.max(map.get(i.rowCode) ?? 0, i.severity));
    }
    return map;
  }, [check]);

  const refresh = async () => {
    setCheck(null);
    await queryClient.invalidateQueries({ queryKey });
    await queryClient.invalidateQueries({ queryKey: ['fs-templates'] });
  };

  const validateMutation = useMutation({
    mutationFn: () => fsTemplateVersionsApi.validate(versionId),
    onSuccess: (res) => setCheck(res),
  });

  const moveMutation = useMutation({
    mutationFn: (ids: string[]) => fsTemplateVersionsApi.reorderRows(versionId, ids),
    onSuccess: refresh,
  });

  const deleteRowMutation = useMutation({
    mutationFn: (r: FsTemplateRowDto) => fsTemplateVersionsApi.removeRow(versionId, r.id),
    onSuccess: async () => {
      setPendingDelete(null);
      await refresh();
      notify('ردیف حذف شد.');
    },
  });

  const activateMutation = useMutation({
    mutationFn: (year: number) => fsTemplateVersionsApi.activate(versionId, year),
    onSuccess: async () => {
      setActivateOpen(false);
      await refresh();
      notify('نسخه فعال شد و از این پس قابل تغییر نیست.');
    },
  });

  const newDraftMutation = useMutation({
    mutationFn: () => fsTemplatesApi.createVersion(version!.templateId, { sourceVersionId: versionId, description: null }),
    onSuccess: async (newId) => {
      await queryClient.invalidateQueries({ queryKey: ['fs-templates'] });
      navigate(`/fs/template-versions/${newId}`);
    },
  });

  const deleteVersionMutation = useMutation({
    mutationFn: () => fsTemplateVersionsApi.remove(versionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['fs-templates'] });
      notify('نسخهٔ پیش‌نویس حذف شد.');
      navigate('/fs/templates');
    },
  });

  function move(index: number, delta: number) {
    const ids = rows.map((r) => r.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    moveMutation.mutate(ids);
  }

  const columns: DataTableColumn<FsTemplateRowDto>[] = [
    {
      key: 'code',
      header: 'کد',
      width: 90,
      render: (r) => {
        const sev = issuesByRow.get(r.code);
        return (
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <MonoCode value={r.code} />
            {sev && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: sev === 2 ? 'error.main' : 'warning.main' }} />}
          </Stack>
        );
      },
    },
    {
      key: 'title',
      header: 'عنوان',
      render: (r) => (
        <Typography
          variant="body2"
          sx={{
            pr: (depthById.get(r.id) ?? 0) * 2,
            fontWeight: r.rowType === FS_ROW_TYPE.Header || r.format.bold ? 700 : 400,
            color: r.rowType === FS_ROW_TYPE.Blank ? 'text.disabled' : undefined,
          }}
        >
          {r.titleFa || (r.rowType === FS_ROW_TYPE.Blank ? '(ردیف خالی)' : '—')}
        </Typography>
      ),
    },
    { key: 'type', header: 'نوع', width: 90, render: (r) => labelOf(FS_ROW_TYPE_OPTIONS, r.rowType) },
    {
      key: 'content',
      header: 'حساب / فرمول',
      render: (r) =>
        r.selector || r.formula ? (
          <Typography variant="body2" dir="ltr" sx={{ fontFamily: 'monospace', textAlign: 'left' }}>
            {r.selector ?? r.formula}
          </Typography>
        ) : (
          '—'
        ),
    },
    {
      key: 'balance',
      header: 'ماهیت / مقدار',
      render: (r) =>
        r.normalBalance
          ? labelOf(FS_NORMAL_BALANCE_OPTIONS, r.normalBalance) + (r.valueType ? ` · ${labelOf(FS_VALUE_TYPE_OPTIONS, r.valueType)}` : '')
          : '—',
    },
    { key: 'note', header: 'یادداشت', width: 70, render: (r) => r.noteRef ?? '—' },
  ];

  if (isDraft) {
    columns.push({
      key: 'action',
      header: 'عملیات',
      align: 'end',
      render: (r) => {
        const index = rows.indexOf(r);
        return (
          <Stack direction="row" spacing={0} sx={{ justifyContent: 'flex-end' }}>
            <IconButton size="small" aria-label="بالا" disabled={index === 0 || moveMutation.isPending} onClick={() => move(index, -1)}>
              <ArrowUpwardOutlinedIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" aria-label="پایین" disabled={index === rows.length - 1 || moveMutation.isPending} onClick={() => move(index, 1)}>
              <ArrowDownwardOutlinedIcon fontSize="small" />
            </IconButton>
            <Tooltip title="ویرایش">
              <IconButton size="small" color="primary" onClick={() => setEditing(r)}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="حذف">
              <IconButton size="small" color="error" onClick={() => setPendingDelete(r)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        );
      },
    });
  }

  const mutationError =
    moveMutation.error ?? deleteRowMutation.error ?? newDraftMutation.error ?? deleteVersionMutation.error ?? validateMutation.error;

  const stateMeta = version ? FS_VERSION_STATE_META[version.state] : null;

  return (
    <section>
      <PageHeader
        eyebrow="صورت‌های مالی · قالب صورت‌ها"
        icon={<TableChartOutlinedIcon />}
        title={version?.templateTitleFa ?? 'نسخهٔ قالب'}
        description={
          version
            ? `${version.templateCode} · نسخهٔ ${toPersianDigits(version.versionNo)}` +
              (version.effectiveFromYear ? ` · معتبر از سال ${toPersianDigits(version.effectiveFromYear)}` : '')
            : undefined
        }
        actions={
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Button variant="text" startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate('/fs/templates')}>
              بازگشت
            </Button>
            <Button
              variant="outlined"
              startIcon={<FactCheckOutlinedIcon />}
              disabled={!version || validateMutation.isPending}
              onClick={() => validateMutation.mutate()}
            >
              بررسی قالب
            </Button>
            <Button
              variant="outlined"
              startIcon={<PreviewOutlinedIcon />}
              disabled={!version || rows.length === 0}
              onClick={() => setPreviewOpen(true)}
            >
              پیش‌نمایش
            </Button>
            {isDraft ? (
              <>
                <Button variant="outlined" startIcon={<AddOutlinedIcon />} onClick={() => setEditing('new')}>
                  افزودن ردیف
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<TaskAltOutlinedIcon />}
                  disabled={rows.length === 0}
                  onClick={() => {
                    setActivateYear(financialYear);
                    activateMutation.reset();
                    setActivateOpen(true);
                  }}
                >
                  فعال‌سازی
                </Button>
              </>
            ) : (
              version && canEdit && (
                <Button
                  variant="contained"
                  startIcon={<FileCopyOutlinedIcon />}
                  disabled={newDraftMutation.isPending}
                  onClick={() => newDraftMutation.mutate()}
                >
                  پیش‌نویس جدید از این نسخه
                </Button>
              )
            )}
          </Stack>
        }
      />

      {versionQuery.isError && <ErrorBanner error={versionQuery.error} />}
      {mutationError && <ErrorBanner error={mutationError} />}

      {version && stateMeta && (
        <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Chip size="small" color={stateMeta.color} label={stateMeta.label} icon={isDraft ? undefined : <LockOutlinedIcon />} />
            <Chip size="small" variant="outlined" label={ownerLabel(version)} />
            <Typography variant="body2" color="text.secondary">
              {toPersianDigits(rows.length)} ردیف
            </Typography>
            {version.description && (
              <Typography variant="body2" color="text.secondary">
                · {version.description}
              </Typography>
            )}
            {isDraft && (
              <Button size="small" color="error" sx={{ mr: 'auto' }} onClick={() => setDeletingVersion(true)}>
                حذف این پیش‌نویس
              </Button>
            )}
          </Stack>
          {!canEdit ? (
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              {version.ownerVahedCode
                ? 'این قالب مال واحد دیگری است و از این واحد فقط قابل مشاهده است.'
                : 'قالب مشترک را فقط ستاد مرکزی تغییر می‌دهد. برای تغییر در این واحد، یک قالب اختصاصی با همین کد بسازید.'}
            </Typography>
          ) : (
            !isDraft && (
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
                این نسخه قفل است تا صورت‌های سال‌های گذشته همیشه با همان قالب بازتولید شوند. برای تغییر، «پیش‌نویس جدید» بسازید.
              </Typography>
            )
          )}
        </Paper>
      )}

      {check && (
        <Alert
          severity={check.issues.length === 0 ? 'success' : check.isValid ? 'warning' : 'error'}
          sx={{ mb: 2 }}
          onClose={() => setCheck(null)}
        >
          {check.issues.length === 0 ? (
            'قالب هیچ خطا یا هشداری ندارد.'
          ) : (
            <>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                {check.isValid ? 'قالب قابل فعال‌سازی است، ولی هشدار دارد:' : 'پیش از فعال‌سازی این خطاها باید رفع شوند:'}
              </Typography>
              <Box component="ul" sx={{ m: 0, pr: 2.5 }}>
                {check.issues.map((i, idx) => (
                  <li key={idx}>
                    <Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>
                      {i.severity === 2 ? 'خطا' : 'هشدار'}
                      {i.rowCode ? ` — ${i.rowCode}` : ''}:
                    </Typography>{' '}
                    <Typography variant="body2" component="span">
                      {i.message}
                    </Typography>
                  </li>
                ))}
              </Box>
            </>
          )}
        </Alert>
      )}

      {!versionQuery.isError && (
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.id}
          isLoading={versionQuery.isLoading}
          skeletonRows={12}
          emptyMessage="این نسخه هنوز ردیفی ندارد."
          emptyAction={
            isDraft ? (
              <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => setEditing('new')}>
                افزودن اولین ردیف
              </Button>
            ) : undefined
          }
        />
      )}

      {editing !== null && version && (
        <FsRowFormDialog
          versionId={versionId}
          row={editing === 'new' ? null : editing}
          headerRows={rows.filter((r) => r.rowType === FS_ROW_TYPE.Header)}
          suggestedCode={editing === 'new' ? nextRowCode(rows) : ''}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            const wasNew = editing === 'new';
            setEditing(null);
            await refresh();
            notify(wasNew ? 'ردیف افزوده شد.' : 'ردیف ذخیره شد.');
          }}
        />
      )}

      <Dialog open={activateOpen} onClose={() => setActivateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>فعال‌سازی نسخهٔ {version ? toPersianDigits(version.versionNo) : ''}</DialogTitle>
        <DialogContent>
          {activateMutation.isError && <ErrorBanner error={activateMutation.error} />}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            قالب پیش از فعال‌سازی کامل بررسی می‌شود. پس از فعال‌سازی، این نسخه دیگر قابل تغییر نیست. اگر نسخهٔ فعال دیگری
            با همین سال شروع وجود داشته باشد، بازنشسته می‌شود.
          </Typography>
          <TextField
            label="معتبر از سال مالی"
            value={toPersianDigits(activateYear)}
            onChange={(e) => setActivateYear(toLatinDigits(e.target.value).replace(/\D/g, '').slice(0, 4))}
            fullWidth
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActivateOpen(false)} disabled={activateMutation.isPending}>
            انصراف
          </Button>
          <Button
            variant="contained"
            color="success"
            disabled={activateYear.length !== 4 || activateMutation.isPending}
            onClick={() => activateMutation.mutate(Number(activateYear))}
          >
            {activateMutation.isPending ? 'در حال فعال‌سازی...' : 'فعال‌سازی'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف ردیف"
        description={pendingDelete ? `ردیف «${pendingDelete.code} — ${pendingDelete.titleFa ?? ''}» حذف می‌شود. زیرمجموعه‌هایش بی‌والد می‌مانند.` : undefined}
        pending={deleteRowMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteRowMutation.mutate(pendingDelete)}
      />

      <ConfirmDialog
        open={deletingVersion}
        title="حذف نسخهٔ پیش‌نویس"
        description="این نسخهٔ پیش‌نویس و همهٔ ردیف‌هایش کنار گذاشته می‌شود. ادامه می‌دهید؟"
        pending={deleteVersionMutation.isPending}
        onCancel={() => setDeletingVersion(false)}
        onConfirm={() => deleteVersionMutation.mutate()}
      />
      {previewOpen && version && <FsTemplatePreviewDialog version={version} onClose={() => setPreviewOpen(false)} />}
    </section>
  );
}
