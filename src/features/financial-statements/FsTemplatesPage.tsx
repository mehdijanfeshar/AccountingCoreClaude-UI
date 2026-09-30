import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import FileCopyOutlinedIcon from '@mui/icons-material/FileCopyOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorBanner } from '../../components/ErrorBanner';
import { MonoCode } from '../../components/MonoCode';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { useSession } from '../../lib/session/SessionContext';
import { toPersianDigits } from '../../lib/format/numbers';
import {
  FS_FRAMEWORK_OPTIONS,
  FS_STATEMENT_TYPE_OPTIONS,
  FS_STATEMENT_TYPE_NOTE,
  FS_VERSION_STATE,
  FS_VERSION_STATE_META,
  labelOf,
  type FsFrameworkValue,
  type FsTemplateDto,
} from '../../types/fsTemplate';
import { fsTemplatesApi } from './api';
import { NewFsTemplateDialog } from './NewFsTemplateDialog';
import { EditFsTemplateDialog } from "./EditFsTemplateDialog";

/**
 * قالب‌های صورت‌های مالی (بخش ۴۵-الف) — فهرست قالب‌های هر مجموعه با وضعیت نسخه‌ها. ویرایش ردیف‌ها
 * در صفحهٔ نسخه (`/fs/template-versions/:versionId`) انجام می‌شود؛ فقط نسخهٔ پیش‌نویس قابل ویرایش است.
 */
export function FsTemplatesPage() {
  const navigate = useNavigate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [framework, setFramework] = useState<FsFrameworkValue>(1);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<FsTemplateDto | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<FsTemplateDto | null>(null);

  // فهرست به واحد جاری بستگی دارد (قالب‌های اختصاصی اجداد/زیرمجموعه)، پس واحد در کلید کش است.
  const { unitCode } = useSession();
  const listQuery = useQuery({ queryKey: ['fs-templates', unitCode], queryFn: () => fsTemplatesApi.list() });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['fs-templates'] });

  const seedMutation = useMutation({
    mutationFn: () => fsTemplatesApi.seedDefaults(),
    onSuccess: async (codes) => {
      await invalidate();
      notify(codes.length ? `${toPersianDigits(codes.length)} قالب پیش‌فرض ساخته شد.` : 'همهٔ قالب‌های پیش‌فرض از قبل وجود دارند.');
    },
  });

  const newVersionMutation = useMutation({
    mutationFn: (t: FsTemplateDto) => fsTemplatesApi.createVersion(t.id, { sourceVersionId: null, description: null }),
    onSuccess: async (versionId) => {
      await invalidate();
      navigate(`/fs/template-versions/${versionId}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (t: FsTemplateDto) => fsTemplatesApi.remove(t.id),
    onSuccess: async () => {
      await invalidate();
      notify('قالب حذف شد.');
      setPendingDelete(null);
    },
  });

  const rows = (listQuery.data ?? []).filter((t) => t.framework === framework);
  const statementTemplates = (listQuery.data ?? []).filter((t) => t.statementType !== FS_STATEMENT_TYPE_NOTE);

  const columns: DataTableColumn<FsTemplateDto>[] = [
    { key: 'order', header: 'ترتیب', width: 70, render: (t) => toPersianDigits(t.orderNo) },
    { key: 'code', header: 'کد', render: (t) => <MonoCode value={t.code} /> },
    {
      key: 'title',
      header: 'عنوان',
      render: (t) => (
        <Stack>
          <Typography variant="body2">{t.titleFa}</Typography>
          <Typography variant="caption" color="text.secondary">
            {labelOf(FS_STATEMENT_TYPE_OPTIONS, t.statementType)}
            {t.statementType === FS_STATEMENT_TYPE_NOTE && (t.noteParentTemplateCode ? ` — ردیف  از ` : " — بدون ارتباط")}
          </Typography>
        </Stack>
      ),
    },
    {
      key: 'owner',
      header: 'مالک',
      render: (t) =>
        t.ownerVahedCode ? (
          <Chip size="small" variant="outlined" label={t.ownerVahedName ?? t.ownerVahedCode} />
        ) : (
          <Chip size="small" variant="outlined" color="primary" label="مشترک" />
        ),
    },
    {
      key: 'versions',
      header: 'نسخه‌ها',
      render: (t) =>
        t.versions.length === 0 ? (
          '—'
        ) : (
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {t.versions
              .filter((v) => v.state !== FS_VERSION_STATE.Retired)
              .map((v) => (
                <Chip
                  key={v.id}
                  size="small"
                  variant="outlined"
                  color={FS_VERSION_STATE_META[v.state].color}
                  label={
                    `نسخهٔ ${toPersianDigits(v.versionNo)} · ${FS_VERSION_STATE_META[v.state].label}` +
                    (v.effectiveFromYear ? ` از ${toPersianDigits(v.effectiveFromYear)}` : '') +
                    ` · ${toPersianDigits(v.rowCount)} ردیف`
                  }
                  onClick={() => navigate(`/fs/template-versions/${v.id}`)}
                />
              ))}
          </Stack>
        ),
    },
    {
      key: 'action',
      header: 'عملیات',
      align: 'end',
      render: (t) => {
        const draft = t.versions.find((v) => v.state === FS_VERSION_STATE.Draft);
        const latest = t.versions[0];
        const hasActive = t.versions.some((v) => v.state === FS_VERSION_STATE.Active);
        if (!t.canEdit) {
          return (
            <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
              {latest && (
                <Tooltip title={t.ownerVahedCode ? 'قالب واحد دیگر — فقط مشاهده' : 'قالب مشترک — فقط ستاد تغییر می‌دهد'}>
                  <IconButton size="small" onClick={() => navigate(`/fs/template-versions/${(draft ?? latest).id}`)}>
                    <VisibilityOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          );
        }
        return (
          <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
            {draft ? (
              <Tooltip title="ویرایش پیش‌نویس">
                <IconButton size="small" color="primary" onClick={() => navigate(`/fs/template-versions/${draft.id}`)}>
                  <EditNoteOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : (
              <>
                {latest && (
                  <Tooltip title="مشاهدهٔ آخرین نسخه">
                    <IconButton size="small" onClick={() => navigate(`/fs/template-versions/${latest.id}`)}>
                      <VisibilityOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="نسخهٔ پیش‌نویس جدید (کپی آخرین نسخه)">
                  <span>
                    <IconButton size="small" color="primary" disabled={newVersionMutation.isPending} onClick={() => newVersionMutation.mutate(t)}>
                      <FileCopyOutlinedIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </>
            )}
            <Tooltip title="ویرایش مشخصات">
              <IconButton size="small" onClick={() => setEditingTemplate(t)}>
                <SettingsOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={hasActive ? 'قالب دارای نسخهٔ فعال قابل حذف نیست' : 'حذف قالب'}>
              <span>
                <IconButton size="small" color="error" disabled={hasActive} onClick={() => setPendingDelete(t)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        );
      },
    },
  ];

  const mutationError = seedMutation.error ?? newVersionMutation.error ?? deleteMutation.error;

  return (
    <section>
      <PageHeader
        eyebrow="صورت‌های مالی"
        icon={<TableChartOutlinedIcon />}
        title="قالب صورت‌ها"
        description="ساختار ردیف‌های هر صورت مالی و حساب‌ها/فرمول‌های آن. فقط نسخهٔ پیش‌نویس قابل ویرایش است؛ نسخهٔ فعال قفل است."
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<AutoAwesomeOutlinedIcon />}
              disabled={seedMutation.isPending}
              onClick={() => seedMutation.mutate()}
            >
              قالب‌های پیش‌فرض
            </Button>
            <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => setCreating(true)}>
              قالب جدید
            </Button>
          </Stack>
        }
      />

      {listQuery.isError && <ErrorBanner error={listQuery.error} />}
      {mutationError && <ErrorBanner error={mutationError} />}

      <Tabs value={framework} onChange={(_, v: FsFrameworkValue) => setFramework(v)} sx={{ mb: 2 }}>
        {FS_FRAMEWORK_OPTIONS.map((o) => (
          <Tab key={o.value} value={o.value} label={o.label} />
        ))}
      </Tabs>

      {!listQuery.isError && (
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(t) => t.id}
          isLoading={listQuery.isLoading}
          emptyMessage="هنوز قالبی برای این مجموعه تعریف نشده است."
          emptyHint="با «قالب‌های پیش‌فرض» قالب‌های طرح بیمه‌ای و واحد تجاری به‌صورت پیش‌نویس ساخته می‌شوند."
        />
      )}

      {creating && (
        <NewFsTemplateDialog
          defaultFramework={framework}
          statementTemplates={statementTemplates}
          onClose={() => setCreating(false)}
          onCreated={async (versionId) => {
            setCreating(false);
            await invalidate();
            navigate(`/fs/template-versions/${versionId}`);
          }}
        />
      )}

      {editingTemplate && (
        <EditFsTemplateDialog
          template={editingTemplate}
          statementTemplates={statementTemplates}
          onClose={() => setEditingTemplate(null)}
          onSaved={async () => {
            setEditingTemplate(null);
            await invalidate();
            notify("مشخصات قالب ذخیره شد.");
          }}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف قالب"
        description={pendingDelete ? `قالب «${pendingDelete.titleFa}» و همهٔ نسخه‌های پیش‌نویس آن حذف می‌شود. ادامه می‌دهید؟` : undefined}
        pending={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete)}
      />
    </section>
  );
}
