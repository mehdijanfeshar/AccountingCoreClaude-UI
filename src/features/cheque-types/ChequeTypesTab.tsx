import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { useSession } from '../../lib/session/SessionContext';
import { toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import { apiClient } from '../../lib/api/client';
import { ChequeLayoutDialog } from './ChequeLayoutDialog';

/**
 * تنظیمات محیطی چک — `TB_CHECK_TYPE` (`api/cheque-types`)، معادل `base-cheque-setting` سیستم قدیم:
 * عنوان، طول و عرض برگ چک، حاشیهٔ بالا و چپ چاپگر (میلی‌متر) و تصویر چک.
 *
 * ⚠️ «ویرایش» در بک‌اند جایگزینی کامل است، پس فرم همهٔ فیلدهای دریافتی (مختصات چاپ تاریخ، مبلغ و …)
 * را دست‌نخورده برمی‌گرداند و فقط همین پنج فیلد و تصویر را عوض می‌کند؛ مختصات در «جای فیلدها» (`ChequeLayoutDialog`).
 * طول/عرض ۰ تا ۹۹۹ (NUMBER(3))؛ حاشیه‌ها می‌توانند منفی باشند (عین سیستم قدیم، ۹۹۹- تا ۹۹۹).
 */

type ChequeTypeDto = Record<string, unknown> & {
  id: string;
  chequeTypeTitle: string | null;
  chequeWidth: number | null;
  chequeHeight: number | null;
  chequeImage: string | null;
  printerMargineTop: number | null;
  printerMargineLeft: number | null;
  year: string;
};

interface PagedResult<T> {
  items: T[];
  totalCount: number;
}

interface FormState {
  id: string | null;
  title: string;
  height: string;
  width: string;
  top: string;
  left: string;
  image: string | null;
}

const SERVER_ONLY = ['id', 'vahedCode', 'createdDate', 'updatedDate', 'addUserId', 'changeUserId', 'isDeleted'];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const api = {
  list: () => apiClient.get<PagedResult<ChequeTypeDto>>('/cheque-types', { params: { pageNumber: 1, pageSize: 200 } }).then((r) => r.data),
  get: (id: string) => apiClient.get<ChequeTypeDto>(`/cheque-types/${id}`).then((r) => r.data),
  create: (body: Record<string, unknown>) => apiClient.post('/cheque-types', body).then(() => undefined),
  update: (id: string, body: Record<string, unknown>) => apiClient.post(`/cheque-types/${id}/update`, body).then(() => undefined),
  remove: (id: string) => apiClient.post(`/cheque-types/${id}/delete`).then(() => undefined),
};

function toByte(value: string): number | null {
  const v = toLatinDigits(value).trim();
  return v === '' ? null : Number(v);
}

function byteError(value: string, required: boolean): string | undefined {
  const v = toLatinDigits(value).trim();
  if (v === '') return required ? 'الزامی است.' : undefined;
  if (!/^\d+$/.test(v)) return 'فقط عدد صحیح مثبت.';
  if (Number(v) > 999) return 'حداکثر ۹۹۹ میلی‌متر.';
  return undefined;
}

function marginError(value: string): string | undefined {
  const v = toLatinDigits(value).trim();
  if (v === '') return 'الزامی است.';
  if (!/^-?\d+$/.test(v)) return 'فقط عدد صحیح (منفی هم مجاز است).';
  if (Math.abs(Number(v)) > 999) return 'بین ۹۹۹- و ۹۹۹ میلی‌متر.';
  return undefined;
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ChequeTypesTab() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { financialYear } = useSession();
  const [form, setForm] = useState<FormState | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ChequeTypeDto | null>(null);
  const [preview, setPreview] = useState<ChequeTypeDto | null>(null);
  const [layoutTarget, setLayoutTarget] = useState<ChequeTypeDto | null>(null);

  const list = useQuery({ queryKey: ['cheque-types', 'settings'], queryFn: api.list });

  const save = useMutation({
    mutationFn: async (f: FormState) => {
      const edited = {
        chequeTypeTitle: f.title.trim(),
        chequeHeight: toByte(f.height),
        chequeWidth: toByte(f.width),
        printerMargineTop: toByte(f.top),
        printerMargineLeft: toByte(f.left),
        chequeImage: f.image,
      };
      if (!f.id) return api.create({ ...edited, year: financialYear });
      // جایگزینی کامل: بقیهٔ فیلدها (مختصات چاپ) از نسخهٔ فعلی.
      const current = await api.get(f.id);
      const rest = Object.fromEntries(Object.entries(current).filter(([k]) => !SERVER_ONLY.includes(k)));
      return api.update(f.id, { ...rest, ...edited });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cheque-types'] });
      notify('تنظیمات چک ذخیره شد.');
      setForm(null);
    },
  });

  const remove = useMutation({
    mutationFn: (row: ChequeTypeDto) => api.remove(row.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cheque-types'] });
      notify('تنظیمات چک حذف شد.');
      setPendingDelete(null);
    },
  });

  async function openEdit(row: ChequeTypeDto) {
    setLoadingEdit(true);
    try {
      const d = await api.get(row.id);
      setForm({
        id: d.id,
        title: d.chequeTypeTitle ?? '',
        height: d.chequeHeight?.toString() ?? '',
        width: d.chequeWidth?.toString() ?? '',
        top: d.printerMargineTop?.toString() ?? '',
        left: d.printerMargineLeft?.toString() ?? '',
        image: d.chequeImage,
      });
    } catch (error) {
      notify({ message: error instanceof Error ? error.message : 'دریافت تنظیمات با خطا مواجه شد.', severity: 'error' });
    } finally {
      setLoadingEdit(false);
    }
  }

  async function openLayout(row: ChequeTypeDto) {
    setLoadingEdit(true);
    try {
      setLayoutTarget(await api.get(row.id));
    } catch (error) {
      notify({ message: error instanceof Error ? error.message : 'دریافت تنظیمات با خطا مواجه شد.', severity: 'error' });
    } finally {
      setLoadingEdit(false);
    }
  }

  async function pickImage(file: File | undefined) {
    if (!file || !form) return;
    if (!file.type.startsWith('image/')) {
      notify({ message: 'فقط فایل تصویر قابل بارگذاری است.', severity: 'error' });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      notify({ message: 'حجم تصویر حداکثر ۲ مگابایت است.', severity: 'error' });
      return;
    }
    setForm({ ...form, image: await readAsBase64(file) });
  }

  const mm = (v: number | null) => (v == null ? '—' : `${toPersianDigits(v)} م‌م`);

  const columns: DataTableColumn<ChequeTypeDto>[] = [
    { key: 'title', header: 'عنوان دسته‌چک', render: (r) => r.chequeTypeTitle ?? '—' },
    { key: 'h', header: 'طول چک', render: (r) => mm(r.chequeHeight) },
    { key: 'w', header: 'عرض چک', render: (r) => mm(r.chequeWidth) },
    { key: 'l', header: 'حاشیهٔ چپ', render: (r) => mm(r.printerMargineLeft) },
    { key: 't', header: 'حاشیهٔ بالا', render: (r) => mm(r.printerMargineTop) },
    {
      key: 'img',
      header: 'تصویر چک',
      render: (r) =>
        r.chequeImage ? (
          <Button size="small" startIcon={<ImageOutlinedIcon fontSize="small" />} onClick={() => setPreview(r)}>
            نمایش
          </Button>
        ) : (
          <Chip size="small" variant="outlined" label="ندارد" />
        ),
    },
    {
      key: 'act',
      header: 'عملیات',
      align: 'end',
      render: (r) => (
        <Stack direction="row" spacing={0.25} sx={{ justifyContent: 'flex-end' }}>
          <Tooltip title="ویرایش">
            <span>
              <IconButton size="small" color="primary" disabled={loadingEdit} onClick={() => openEdit(r)}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="جای فیلدها روی چک">
            <span>
              <IconButton size="small" color="primary" disabled={loadingEdit} onClick={() => openLayout(r)}>
                <SpaceDashboardOutlinedIcon fontSize="small" />
              </IconButton>
            </span>
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

  const errors = form
    ? {
        title: form.title.trim() === '' ? 'الزامی است.' : form.title.trim().length > 25 ? 'حداکثر ۲۵ کاراکتر.' : undefined,
        height: byteError(form.height, true),
        width: byteError(form.width, true),
        top: marginError(form.top),
        left: marginError(form.left),
      }
    : null;
  const hasErrors = errors ? Object.values(errors).some(Boolean) : false;

  return (
    <Box>
      <Stack direction="row" sx={{ mb: 2, justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          اندازهٔ برگ چک و حاشیهٔ چاپگر برای چاپ چک هر نوع دسته‌چک (میلی‌متر).
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddOutlinedIcon />}
          onClick={() => setForm({ id: null, title: '', height: '', width: '', top: '0', left: '0', image: null })}
        >
          افزودن محیط چک جدید
        </Button>
      </Stack>

      {list.isError && <ErrorBanner error={list.error} />}
      {remove.isError && <ErrorBanner error={remove.error} />}
      <DataTable
        columns={columns}
        rows={list.data?.items ?? []}
        getRowKey={(r) => r.id}
        isLoading={list.isLoading}
        emptyMessage="هنوز تنظیمات چکی تعریف نشده است."
      />

      <Dialog open={form !== null} onClose={() => setForm(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{form?.id ? 'ویرایش تنظیمات چک' : 'افزودن محیط چک جدید'}</DialogTitle>
        <DialogContent>
          {form && errors && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              {save.isError && <ErrorBanner error={save.error} />}
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField fullWidth size="small" required label="عنوان" value={form.title}
                    error={!!errors.title} helperText={errors.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField fullWidth size="small" required label="طول برگ چک" placeholder="میلی‌متر" value={form.height}
                    error={!!errors.height} helperText={errors.height}
                    onChange={(e) => setForm({ ...form, height: e.target.value })} slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric' } }} />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField fullWidth size="small" required label="عرض برگ چک" placeholder="میلی‌متر" value={form.width}
                    error={!!errors.width} helperText={errors.width}
                    onChange={(e) => setForm({ ...form, width: e.target.value })} slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric' } }} />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField fullWidth size="small" required label="حاشیهٔ بالا" placeholder="میلی‌متر" value={form.top}
                    error={!!errors.top} helperText={errors.top}
                    onChange={(e) => setForm({ ...form, top: e.target.value })} slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric' } }} />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField fullWidth size="small" required label="حاشیهٔ چپ" placeholder="میلی‌متر" value={form.left}
                    error={!!errors.left} helperText={errors.left}
                    onChange={(e) => setForm({ ...form, left: e.target.value })} slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric' } }} />
                </Grid>
              </Grid>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Button component="label" variant="outlined" startIcon={<ImageOutlinedIcon />}>
                  آپلود تصویر چک
                  <input hidden type="file" accept="image/*" onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ''; }} />
                </Button>
                {form.image && (
                  <Button color="error" onClick={() => setForm({ ...form, image: null })}>
                    حذف تصویر
                  </Button>
                )}
              </Stack>
              {form.image && (
                <Box component="img" src={`data:image/*;base64,${form.image}`} alt="تصویر چک"
                  sx={{ maxWidth: '100%', border: 1, borderColor: 'divider', borderRadius: 1 }} />
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setForm(null)}>انصراف</Button>
          <Button variant="contained" disabled={hasErrors || save.isPending} onClick={() => form && save.mutate(form)}>
            {form?.id ? 'ثبت ویرایش' : 'ثبت'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={preview !== null} onClose={() => setPreview(null)} maxWidth="md">
        <DialogTitle>تصویر چک — {preview?.chequeTypeTitle}</DialogTitle>
        <DialogContent>
          {preview?.chequeImage && (
            <Box component="img" src={`data:image/*;base64,${preview.chequeImage}`} alt="تصویر چک" sx={{ maxWidth: '100%' }} />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreview(null)}>بستن</Button>
        </DialogActions>
      </Dialog>

      <ChequeLayoutDialog chequeType={layoutTarget} onClose={() => setLayoutTarget(null)} />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف تنظیمات چک"
        description={pendingDelete ? `تنظیمات «${pendingDelete.chequeTypeTitle ?? ''}» حذف شود؟` : undefined}
        pending={remove.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete)}
      />
    </Box>
  );
}
