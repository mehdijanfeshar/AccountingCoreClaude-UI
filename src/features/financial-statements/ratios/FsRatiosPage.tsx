import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FunctionsOutlinedIcon from '@mui/icons-material/FunctionsOutlined';
import PlaylistAddOutlinedIcon from '@mui/icons-material/PlaylistAddOutlined';
import { PageHeader } from '../../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../../components/DataTable';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { useNotify } from '../../../lib/notifications/NotificationProvider';
import { useSession } from '../../../lib/session/SessionContext';
import { toLatinDigits, toPersianDigits } from '../../../lib/format/numbers';
import { FS_FRAMEWORK_OPTIONS, labelOf, type FsFrameworkValue } from '../../../types/fsTemplate';
import { FS_RATIO_FORMAT_OPTIONS, type FsRatioDto } from '../../../types/fsRatio';
import { fsRatiosApi } from '../api';

interface Form {
  code: string;
  titleFa: string;
  num: string;
  den: string;
  format: number;
  orderNo: string;
  isActive: boolean;
  shared: boolean;
}

const EMPTY: Form = { code: '', titleFa: '', num: '', den: '', format: 1, orderNo: '10', isActive: true, shared: false };

/**
 * ح-۸ — تعریف نسبت‌های مالی (سند منبع §۱۲-۳): صورت و مخرج با زبان فرمول قالب، فقط
 * <code>STMT(قالب, ردیف)</code>، عدد و عملگرها؛ روی مبلغ نمایشی (ماهیت بستانکار مثبت). مالکیت مثل قواعد کنترل.
 */
export function FsRatiosPage() {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { unitCode } = useSession();
  const [framework, setFramework] = useState<FsFrameworkValue>(1);
  const [editing, setEditing] = useState<FsRatioDto | 'new' | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [pendingDelete, setPendingDelete] = useState<FsRatioDto | null>(null);

  const listQuery = useQuery({ queryKey: ['fs-ratios', unitCode], queryFn: () => fsRatiosApi.list() });
  const rows = (listQuery.data ?? []).filter((r) => r.framework === framework);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['fs-ratios'] });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        titleFa: form.titleFa.trim(),
        numeratorExpr: form.num.trim(),
        denominatorExpr: form.den.trim() || null,
        format: form.format,
        orderNo: Number(form.orderNo) || 0,
        isActive: form.isActive,
      };
      return editing === 'new'
        ? fsRatiosApi.create({ ...payload, framework, shared: form.shared, code: form.code.trim() }).then(() => undefined)
        : fsRatiosApi.update((editing as FsRatioDto).id, payload);
    },
    onSuccess: async () => {
      setEditing(null);
      await invalidate();
      notify('نسبت ذخیره شد.');
    },
  });

  const remove = useMutation({
    mutationFn: (r: FsRatioDto) => fsRatiosApi.remove(r.id),
    onSuccess: async () => {
      setPendingDelete(null);
      await invalidate();
    },
  });

  const seed = useMutation({
    mutationFn: () => fsRatiosApi.seedDefaults(),
    onSuccess: async (codes) => {
      await invalidate();
      notify(codes.length ? `${toPersianDigits(codes.length)} نسبت پیش‌فرض ساخته شد.` : 'همهٔ نسبت‌های پیش‌فرض از قبل وجود دارند.');
    },
  });

  const columns: DataTableColumn<FsRatioDto>[] = [
    { key: 'code', header: 'کد', width: 70, render: (r) => r.code },
    { key: 'title', header: 'عنوان', render: (r) => r.titleFa },
    {
      key: 'expr',
      header: 'فرمول',
      render: (r) => (
        <Typography variant="caption" dir="ltr" sx={{ fontFamily: 'monospace', display: 'block', textAlign: 'left' }}>
          {r.denominatorExpr ? `(${r.numeratorExpr}) / (${r.denominatorExpr})` : r.numeratorExpr}
        </Typography>
      ),
    },
    { key: 'fmt', header: 'نمایش', width: 90, render: (r) => labelOf([...FS_RATIO_FORMAT_OPTIONS], r.format) },
    { key: 'owner', header: 'مالک', width: 100, render: (r) => (r.ownerVahedCode ? `واحد ${r.ownerVahedCode}` : 'مشترک') },
    {
      key: 'active',
      header: '',
      width: 80,
      render: (r) => <Chip size="small" variant="outlined" color={r.isActive ? 'success' : 'default'} label={r.isActive ? 'فعال' : 'غیرفعال'} />,
    },
    {
      key: 'act',
      header: '',
      align: 'end',
      render: (r) =>
        r.canEdit && (
          <Stack direction="row" spacing={0} sx={{ justifyContent: 'flex-end' }}>
            <Tooltip title="ویرایش">
              <IconButton
                size="small"
                color="primary"
                onClick={() => {
                  setForm({
                    code: r.code,
                    titleFa: r.titleFa,
                    num: r.numeratorExpr,
                    den: r.denominatorExpr ?? '',
                    format: r.format,
                    orderNo: String(r.orderNo),
                    isActive: r.isActive,
                    shared: r.ownerVahedCode === null,
                  });
                  save.reset();
                  setEditing(r);
                }}
              >
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="حذف">
              <IconButton size="small" color="error" onClick={() => setPendingDelete(r)}>
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
        icon={<FunctionsOutlinedIcon />}
        title="نسبت‌های مالی"
        description="نسبت‌هایی که در «تحلیل و نسبت‌ها» روی هر اجرا و در روند سال‌ها محاسبه می‌شوند. اگر واحد نسبتی با همان کد بسازد، جای نسبت مشترک را برای آن واحد می‌گیرد."
        actions={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<PlaylistAddOutlinedIcon />} disabled={seed.isPending} onClick={() => seed.mutate()}>
              نسبت‌های پیش‌فرض
            </Button>
            <Button
              variant="contained"
              startIcon={<AddOutlinedIcon />}
              onClick={() => {
                setForm({ ...EMPTY, orderNo: String((rows.length + 1) * 10) });
                save.reset();
                setEditing('new');
              }}
            >
              نسبت جدید
            </Button>
          </Stack>
        }
      />

      <Tabs value={framework} onChange={(_, v: FsFrameworkValue) => setFramework(v)} sx={{ mb: 2 }}>
        {FS_FRAMEWORK_OPTIONS.map((o) => (
          <Tab key={o.value} value={o.value} label={o.label} />
        ))}
      </Tabs>

      {listQuery.isError && <ErrorBanner error={listQuery.error} />}
      {(seed.error ?? remove.error) && <ErrorBanner error={seed.error ?? remove.error} />}

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        isLoading={listQuery.isLoading}
        emptyMessage="برای این مجموعه نسبتی تعریف نشده — «نسبت‌های پیش‌فرض» یا «نسبت جدید»."
      />

      <Dialog open={editing !== null} onClose={() => setEditing(null)} maxWidth="md" fullWidth>
        <DialogTitle>{editing === 'new' ? 'نسبت جدید' : 'ویرایش نسبت'}</DialogTitle>
        <DialogContent>
          {save.isError && <ErrorBanner error={save.error} />}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField
                label="کد"
                value={form.code}
                disabled={editing !== 'new'}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.slice(0, 20) }))}
                sx={{ width: 140 }}
                slotProps={{ htmlInput: { dir: 'ltr' } }}
              />
              <TextField label="عنوان" fullWidth value={form.titleFa} onChange={(e) => setForm((f) => ({ ...f, titleFa: e.target.value }))} />
            </Stack>
            <TextField
              label="صورت"
              placeholder="STMT(PENSION.CHANGES_IN_NET_ASSETS, C99)"
              value={form.num}
              onChange={(e) => setForm((f) => ({ ...f, num: e.target.value }))}
              slotProps={{ htmlInput: { dir: 'ltr', style: { fontFamily: 'monospace' } } }}
            />
            <TextField
              label="مخرج (اختیاری)"
              helperText="خالی = خود صورت نمایش داده می‌شود (مثلاً یک مبلغ کلیدی)"
              value={form.den}
              onChange={(e) => setForm((f) => ({ ...f, den: e.target.value }))}
              slotProps={{ htmlInput: { dir: 'ltr', style: { fontFamily: 'monospace' } } }}
            />
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <TextField select label="نمایش" value={form.format} onChange={(e) => setForm((f) => ({ ...f, format: Number(e.target.value) }))} sx={{ width: 160 }}>
                {FS_RATIO_FORMAT_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="ترتیب"
                value={toPersianDigits(form.orderNo)}
                onChange={(e) => setForm((f) => ({ ...f, orderNo: toLatinDigits(e.target.value).replace(/\D/g, '').slice(0, 4) }))}
                sx={{ width: 110 }}
              />
              <FormControlLabel
                control={<Checkbox checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />}
                label="فعال"
              />
              {editing === 'new' && (
                <FormControlLabel
                  control={<Checkbox checked={form.shared} onChange={(e) => setForm((f) => ({ ...f, shared: e.target.checked }))} />}
                  label="مشترک (فقط ستاد)"
                />
              )}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)} disabled={save.isPending}>
            انصراف
          </Button>
          <Button
            variant="contained"
            disabled={!form.code.trim() || !form.titleFa.trim() || !form.num.trim() || save.isPending}
            onClick={() => save.mutate()}
          >
            ذخیره
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف نسبت"
        description={pendingDelete ? `نسبت «${pendingDelete.titleFa}» حذف می‌شود.` : undefined}
        pending={remove.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete)}
      />
    </section>
  );
}
