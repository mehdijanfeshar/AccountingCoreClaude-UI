import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LinearScaleOutlinedIcon from '@mui/icons-material/LinearScaleOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { useSession } from '../../lib/session/SessionContext';
import { toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import { FS_FRAMEWORK_OPTIONS, type FsFrameworkValue } from '../../types/fsTemplate';
import type { FsApprovalStepDto } from '../../types/fsRun';
import { fsApprovalStepsApi } from './api';

interface Form {
  stepNo: string;
  titleFa: string;
  approvers: string;
  isActive: boolean;
  shared: boolean;
}

/**
 * ح-۴ — مراحل گردش تأیید صورت‌ها (سند منبع §۱۱: تهیه‌کننده ← بازبین ← مدیرکل ← معاون). هر مرحله فهرست کد
 * کاربری مجاز دارد (خالی = هر کاربری جز تهیه‌کننده و تأییدکنندگان قبلی). برای یک اجرا زنجیرهٔ نزدیک‌ترین
 * مالک به‌کار می‌رود: اختصاصی واحد، وگرنه والد، وگرنه مشترک. بدون مرحله، تأیید تک‌مرحله‌ای است.
 */
export function FsApprovalStepsPage() {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { unitCode } = useSession();
  const [framework, setFramework] = useState<FsFrameworkValue>(1);
  const [editing, setEditing] = useState<FsApprovalStepDto | 'new' | null>(null);
  const [form, setForm] = useState<Form>({ stepNo: '1', titleFa: '', approvers: '', isActive: true, shared: false });
  const [pendingDelete, setPendingDelete] = useState<FsApprovalStepDto | null>(null);

  const listQuery = useQuery({ queryKey: ['fs-approval-steps', unitCode], queryFn: () => fsApprovalStepsApi.list() });
  const rows = (listQuery.data ?? []).filter((s) => s.framework === framework);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['fs-approval-steps'] });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        stepNo: Number(form.stepNo),
        titleFa: form.titleFa.trim(),
        approverUserIds: toLatinDigits(form.approvers).trim() || null,
        isActive: form.isActive,
      };
      return editing === 'new'
        ? fsApprovalStepsApi.create({ ...payload, framework, shared: form.shared }).then(() => undefined)
        : fsApprovalStepsApi.update((editing as FsApprovalStepDto).id, payload);
    },
    onSuccess: async () => {
      setEditing(null);
      await invalidate();
      notify('مرحله ذخیره شد.');
    },
  });

  const remove = useMutation({
    mutationFn: (s: FsApprovalStepDto) => fsApprovalStepsApi.remove(s.id),
    onSuccess: async () => {
      setPendingDelete(null);
      await invalidate();
      notify('مرحله حذف شد.');
    },
  });

  const openNew = () => {
    const next = rows.filter((r) => r.ownerVahedCode === unitCode).reduce((m, r) => Math.max(m, r.stepNo), 0) + 1;
    setForm({ stepNo: String(next), titleFa: '', approvers: '', isActive: true, shared: false });
    save.reset();
    setEditing('new');
  };

  const openEdit = (s: FsApprovalStepDto) => {
    setForm({ stepNo: String(s.stepNo), titleFa: s.titleFa, approvers: s.approverUserIds.join('، '), isActive: s.isActive, shared: s.ownerVahedCode === null });
    save.reset();
    setEditing(s);
  };

  const columns: DataTableColumn<FsApprovalStepDto>[] = [
    { key: 'no', header: 'مرحله', width: 70, render: (s) => toPersianDigits(s.stepNo) },
    { key: 'title', header: 'عنوان', render: (s) => s.titleFa },
    {
      key: 'approvers',
      header: 'تأییدکنندگان',
      render: (s) => (s.approverUserIds.length > 0 ? s.approverUserIds.join('، ') : <em>هر کاربر مجاز (جز تهیه‌کننده)</em>),
    },
    { key: 'owner', header: 'مالک', render: (s) => (s.ownerVahedCode ? `واحد ${s.ownerVahedCode}` : 'مشترک') },
    {
      key: 'active',
      header: 'وضعیت',
      width: 90,
      render: (s) => <Chip size="small" color={s.isActive ? 'success' : 'default'} variant="outlined" label={s.isActive ? 'فعال' : 'غیرفعال'} />,
    },
    {
      key: 'act',
      header: '',
      align: 'end',
      render: (s) =>
        s.canEdit && (
          <Stack direction="row" spacing={0} sx={{ justifyContent: 'flex-end' }}>
            <Tooltip title="ویرایش">
              <IconButton size="small" color="primary" onClick={() => openEdit(s)}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="حذف">
              <IconButton size="small" color="error" onClick={() => setPendingDelete(s)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ),
    },
  ];

  const stepValid = /^\d{1,2}$/.test(form.stepNo) && Number(form.stepNo) >= 1 && Number(form.stepNo) <= 20;

  return (
    <section>
      <PageHeader
        eyebrow="صورت‌های مالی"
        icon={<LinearScaleOutlinedIcon />}
        title="گردش تأیید صورت‌ها"
        description="مراحل تأیید پس از «ارسال برای بازبینی» — هر مرحله با فهرست کد کاربری مجاز. یک نفر دو مرحلهٔ یک اجرا را تأیید نمی‌کند."
        actions={
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openNew}>
            مرحلهٔ جدید
          </Button>
        }
      />

      <Tabs value={framework} onChange={(_, v: FsFrameworkValue) => setFramework(v)} sx={{ mb: 2 }}>
        {FS_FRAMEWORK_OPTIONS.map((o) => (
          <Tab key={o.value} value={o.value} label={o.label} />
        ))}
      </Tabs>

      <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
        برای هر اجرا مراحل نزدیک‌ترین مالک به‌کار می‌رود: مراحل اختصاصی واحد، وگرنه واحد بالادست، وگرنه مراحل مشترک. اگر هیچ
        مرحله‌ای تعریف نشود، یک تأیید ساده کافی است.
      </Alert>

      {listQuery.isError && <ErrorBanner error={listQuery.error} />}
      {remove.isError && <ErrorBanner error={remove.error} />}

      <DataTable
        columns={columns}
        rows={[...rows].sort((a, b) => (a.ownerVahedCode ?? '').localeCompare(b.ownerVahedCode ?? '') || a.stepNo - b.stepNo)}
        getRowKey={(s) => s.id}
        isLoading={listQuery.isLoading}
        emptyMessage="برای این مجموعه مرحله‌ای تعریف نشده — تأیید تک‌مرحله‌ای است."
      />

      <Dialog open={editing !== null} onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing === 'new' ? 'مرحلهٔ جدید' : 'ویرایش مرحله'}</DialogTitle>
        <DialogContent>
          {save.isError && <ErrorBanner error={save.error} />}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField
                label="شمارهٔ مرحله"
                value={toPersianDigits(form.stepNo)}
                onChange={(e) => setForm((f) => ({ ...f, stepNo: toLatinDigits(e.target.value).replace(/\D/g, '').slice(0, 2) }))}
                error={!stepValid}
                sx={{ width: 130 }}
              />
              <TextField
                label="عنوان مرحله"
                placeholder="مثلاً بازبینی رئیس ادارهٔ گزارشگری"
                value={form.titleFa}
                onChange={(e) => setForm((f) => ({ ...f, titleFa: e.target.value }))}
                fullWidth
                slotProps={{ htmlInput: { maxLength: 200 } }}
              />
            </Stack>
            <TextField
              label="کدهای کاربری تأییدکننده"
              helperText="با ویرگول جدا کنید؛ خالی = هر کاربری جز تهیه‌کننده و تأییدکنندگان مراحل قبل"
              value={form.approvers}
              onChange={(e) => setForm((f) => ({ ...f, approvers: e.target.value }))}
              fullWidth
            />
            <FormControlLabel
              control={<Checkbox checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />}
              label="فعال"
            />
            {editing === 'new' && (
              <FormControlLabel
                control={<Checkbox checked={form.shared} onChange={(e) => setForm((f) => ({ ...f, shared: e.target.checked }))} />}
                label="مشترک برای همهٔ واحدها (فقط ستاد)"
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)} disabled={save.isPending}>
            انصراف
          </Button>
          <Button variant="contained" disabled={!stepValid || !form.titleFa.trim() || save.isPending} onClick={() => save.mutate()}>
            ذخیره
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف مرحله"
        description={pendingDelete ? `مرحلهٔ «${pendingDelete.titleFa}» حذف می‌شود. اجراهای در بازبینی با زنجیرهٔ تازه ادامه می‌دهند.` : undefined}
        pending={remove.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete)}
      />
    </section>
  );
}
