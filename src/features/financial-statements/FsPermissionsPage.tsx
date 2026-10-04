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
import FormGroup from '@mui/material/FormGroup';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { useSession } from '../../lib/session/SessionContext';
import { toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import { FS_OPERATIONS, type FsPermissionDto } from '../../types/fsAccess';
import { fsPermissionsApi } from './api';

interface Form {
  userId: string;
  userName: string;
  unitCode: string;
  includeSub: boolean;
  operations: number;
}

/**
 * ط-۲ — دسترسی سه‌بُعدی صورت‌های مالی (سند منبع §۱۴): برای هر کد کاربری، واحد (با یا بدون زیرمجموعه) و
 * عملیات مجاز. تا وقتی هیچ ردیفی تعریف نشده همه مثل قبل مجازند؛ اولین ردیف باید «مدیریت دسترسی» خودتان باشد.
 */
export function FsPermissionsPage() {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { unitCode } = useSession();
  const [editing, setEditing] = useState<FsPermissionDto | 'new' | null>(null);
  const [form, setForm] = useState<Form>({ userId: '', userName: '', unitCode: unitCode ?? '', includeSub: true, operations: 1 });
  const [pendingDelete, setPendingDelete] = useState<FsPermissionDto | null>(null);

  const listQuery = useQuery({ queryKey: ['fs-permissions', unitCode], queryFn: () => fsPermissionsApi.list() });
  const rows = listQuery.data ?? [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['fs-permissions'] });

  const save = useMutation({
    mutationFn: () =>
      fsPermissionsApi.save(editing === 'new' ? null : (editing as FsPermissionDto).id, {
        userId: toLatinDigits(form.userId).trim(),
        userName: form.userName.trim() || null,
        unitCode: toLatinDigits(form.unitCode).trim(),
        includeSub: form.includeSub,
        operations: form.operations,
      }),
    onSuccess: async () => {
      setEditing(null);
      await invalidate();
      notify('دسترسی ذخیره شد.');
    },
  });

  const remove = useMutation({
    mutationFn: (p: FsPermissionDto) => fsPermissionsApi.remove(p.id),
    onSuccess: async () => {
      setPendingDelete(null);
      await invalidate();
    },
  });

  const opsLabel = (ops: number) =>
    ops & 128 ? ['همه (مدیریت دسترسی)'] : FS_OPERATIONS.filter((o) => ops & o.bit).map((o) => o.label);

  const columns: DataTableColumn<FsPermissionDto>[] = [
    { key: 'user', header: 'کاربر', render: (p) => `${p.userId}${p.userName ? ` — ${p.userName}` : ''}` },
    { key: 'unit', header: 'واحد', render: (p) => `${toPersianDigits(p.vahedCode)}${p.includeSub ? ' و زیرمجموعه' : ''}` },
    {
      key: 'ops',
      header: 'عملیات',
      render: (p) => (
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
          {opsLabel(p.operations).map((l) => (
            <Chip key={l} size="small" variant="outlined" label={l} />
          ))}
        </Stack>
      ),
    },
    {
      key: 'act',
      header: '',
      align: 'end',
      render: (p) => (
        <Stack direction="row" spacing={0} sx={{ justifyContent: 'flex-end' }}>
          <Tooltip title="ویرایش">
            <IconButton
              size="small"
              color="primary"
              onClick={() => {
                setForm({ userId: p.userId, userName: p.userName ?? '', unitCode: p.vahedCode, includeSub: p.includeSub, operations: p.operations });
                save.reset();
                setEditing(p);
              }}
            >
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="حذف">
            <IconButton size="small" color="error" onClick={() => setPendingDelete(p)}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <section>
      <PageHeader
        eyebrow="صورت‌های مالی"
        icon={<AdminPanelSettingsOutlinedIcon />}
        title="دسترسی صورت‌های مالی"
        description="چه کسی، روی کدام واحد، چه کاری در صورت‌های مالی انجام دهد. تفکیک وظایف (تهیه‌کننده ≠ تأییدکننده، ویرایشگر قالب ≠ فعال‌کننده) جدا از این جدول اجرا می‌شود."
        actions={
          <Button
            variant="contained"
            startIcon={<AddOutlinedIcon />}
            onClick={() => {
              setForm({ userId: '', userName: '', unitCode: unitCode ?? '', includeSub: true, operations: rows.length === 0 ? 255 : 1 });
              save.reset();
              setEditing('new');
            }}
          >
            دسترسی جدید
          </Button>
        }
      />

      {rows.length === 0 && !listQuery.isLoading && (
        <Alert severity="info" sx={{ mb: 2 }}>
          هنوز دسترسی تعریف نشده و همهٔ کاربران مثل قبل مجازند. اولین ردیف باید «مدیریت دسترسی» برای کد کاربری خود شما باشد؛ از آن به بعد هر کاربر
          فقط کارهای تعریف‌شده را می‌تواند انجام دهد.
        </Alert>
      )}
      {(listQuery.error ?? remove.error) && <ErrorBanner error={listQuery.error ?? remove.error} />}

      <DataTable columns={columns} rows={rows} getRowKey={(p) => p.id} isLoading={listQuery.isLoading} emptyMessage="دسترسی‌ای تعریف نشده است." />

      <Dialog open={editing !== null} onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing === 'new' ? 'دسترسی جدید' : 'ویرایش دسترسی'}</DialogTitle>
        <DialogContent>
          {save.isError && <ErrorBanner error={save.error} />}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField label="کد کاربری" required value={form.userId} onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value.slice(0, 10) }))} />
              <TextField label="نام (اختیاری)" fullWidth value={form.userName} onChange={(e) => setForm((f) => ({ ...f, userName: e.target.value }))} />
            </Stack>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <TextField
                label="کد واحد"
                required
                value={toPersianDigits(form.unitCode)}
                onChange={(e) => setForm((f) => ({ ...f, unitCode: toLatinDigits(e.target.value).slice(0, 4) }))}
                sx={{ width: 140 }}
              />
              <FormControlLabel
                control={<Checkbox checked={form.includeSub} onChange={(e) => setForm((f) => ({ ...f, includeSub: e.target.checked }))} />}
                label="با زیرمجموعه‌ها"
              />
            </Stack>
            <FormGroup>
              {FS_OPERATIONS.map((o) => (
                <FormControlLabel
                  key={o.bit}
                  control={
                    <Checkbox
                      checked={(form.operations & o.bit) !== 0}
                      onChange={(e) => setForm((f) => ({ ...f, operations: e.target.checked ? f.operations | o.bit : f.operations & ~o.bit }))}
                    />
                  }
                  label={o.label}
                />
              ))}
            </FormGroup>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)} disabled={save.isPending}>
            انصراف
          </Button>
          <Button
            variant="contained"
            disabled={!form.userId.trim() || !form.unitCode.trim() || form.operations === 0 || save.isPending}
            onClick={() => save.mutate()}
          >
            ذخیره
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف دسترسی"
        description={pendingDelete ? `دسترسی ${pendingDelete.userId} روی واحد ${pendingDelete.vahedCode} حذف می‌شود.` : undefined}
        pending={remove.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete)}
      />
    </section>
  );
}
