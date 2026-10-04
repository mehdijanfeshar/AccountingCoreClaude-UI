import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ErrorBanner } from '../../components/ErrorBanner';
import { MonoCode } from '../../components/MonoCode';
import { toPersianDigits } from '../../lib/format/numbers';
import type {
  FsAccountMappingDto,
  FsFrameworkValue,
  FsMappingApplyItemResult,
  FsMappingApplyResultDto,
  FsMappingAssignment,
} from '../../types/fsTemplate';
import { fsTemplatesApi } from './api';
import { onlyChanges, readMappingFile } from './mappingExcel';

const STATUS_META: Record<FsMappingApplyItemResult['status'], { label: string; color: 'success' | 'default' | 'error' }> = {
  applied: { label: 'اعمال می‌شود', color: 'success' },
  unchanged: { label: 'بدون تغییر', color: 'default' },
  error: { label: 'خطا', color: 'error' },
};

interface Props {
  framework: FsFrameworkValue;
  year: number;
  current: FsAccountMappingDto[];
  /** پیشنهادهای آماده؛ `null` = حالت ورود از فایل Excel. */
  initialItems: FsMappingAssignment[] | null;
  onClose: () => void;
  onApplied: (count: number) => void;
}

/**
 * بخش ۴۵-و — ورود نگاشت از Excel یا اعمال پیشنهادهای خودکار. همیشه اول «آزمایشی» (`dryRun`) به سرور می‌رود
 * تا نتیجهٔ هر سطر دیده شود؛ «اعمال» فقط سطرهای بی‌خطا را می‌فرستد. تغییر روی پیش‌نویس قالب‌هاست.
 */
export function FsMappingApplyDialog({ framework, year, current, initialItems, onClose, onApplied }: Props) {
  const [items, setItems] = useState<FsMappingAssignment[]>(initialItems ?? []);
  const [fileInfo, setFileInfo] = useState<{ name: string; total: number } | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<FsMappingApplyResultDto | null>(null);

  const dryRun = useMutation({
    mutationFn: (list: FsMappingAssignment[]) => fsTemplatesApi.applyAccountMapping({ framework, year, items: list, dryRun: true }),
    onSuccess: setPreview,
  });

  const apply = useMutation({
    mutationFn: (list: FsMappingAssignment[]) => fsTemplatesApi.applyAccountMapping({ framework, year, items: list, dryRun: false }),
    onSuccess: (res) => onApplied(res.appliedCount),
  });

  useEffect(() => {
    if (initialItems && initialItems.length > 0) dryRun.mutate(initialItems);
    // فقط یک بار هنگام باز شدن.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onFile(file: File) {
    setReadError(null);
    setPreview(null);
    try {
      const all = await readMappingFile(file);
      const changed = onlyChanges(all, current);
      setFileInfo({ name: file.name, total: all.length });
      setItems(changed);
      if (changed.length > 0) dryRun.mutate(changed);
    } catch {
      setReadError('فایل خوانده نشد. یک فایل xlsx با ستون‌های «کد معین»، «کد قالب» و «کد ردیف» بدهید.');
    }
  }

  const ready = useMemo(
    () => (preview?.items ?? []).filter((i) => i.status === 'applied').map(({ accCode, templateCode, rowCode }) => ({ accCode, templateCode, rowCode })),
    [preview],
  );

  const columns: DataTableColumn<FsMappingApplyItemResult>[] = [
    { key: 'acc', header: 'معین', width: 90, render: (i) => <MonoCode value={i.accCode} /> },
    { key: 'target', header: 'قالب / ردیف', render: (i) => `${i.templateCode} / ${i.rowCode}` },
    {
      key: 'status',
      header: 'نتیجه',
      width: 110,
      render: (i) => <Chip size="small" color={STATUS_META[i.status].color} label={STATUS_META[i.status].label} />,
    },
    { key: 'message', header: 'توضیح', render: (i) => i.message ?? '' },
  ];

  return (
    <Dialog open onClose={apply.isPending ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>{initialItems ? 'اعمال پیشنهادهای نگاشت' : 'ورود نگاشت از Excel'}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          هر معین به ردیف مقصد افزوده و از ردیف‌های دیگرِ همان صورت برداشته می‌شود (ردیف‌های [D]/[C] دست نمی‌خورند).
          تغییر فقط روی <b>پیش‌نویس</b> قالب‌ها انجام می‌شود؛ پس از آن قالب را بررسی و فعال کنید.
        </Typography>

        {!initialItems && (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
            <Button component="label" variant="outlined" startIcon={<UploadFileOutlinedIcon />} disabled={dryRun.isPending}>
              انتخاب فایل
              <input
                hidden
                type="file"
                accept=".xlsx"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void onFile(f);
                }}
              />
            </Button>
            {fileInfo && (
              <Typography variant="body2" color="text.secondary">
                {fileInfo.name} — {toPersianDigits(fileInfo.total)} سطر، {toPersianDigits(items.length)} سطر با تغییر
              </Typography>
            )}
          </Stack>
        )}

        {readError && <Alert severity="error" sx={{ mb: 2 }}>{readError}</Alert>}
        {fileInfo && items.length === 0 && <Alert severity="info" sx={{ mb: 2 }}>فایل با نگاشت فعلی فرقی ندارد.</Alert>}
        {dryRun.isError && <ErrorBanner error={dryRun.error} />}
        {apply.isError && <ErrorBanner error={apply.error} />}

        {preview && (
          <>
            <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
              <Chip size="small" color="success" label={`آمادهٔ اعمال: ${toPersianDigits(preview.appliedCount)}`} />
              <Chip size="small" color="error" variant="outlined" label={`خطا: ${toPersianDigits(preview.errorCount)}`} />
            </Stack>
            <DataTable
              columns={columns}
              rows={[...preview.items].sort((a, b) => (a.status === 'error' ? -1 : 0) - (b.status === 'error' ? -1 : 0))}
              getRowKey={(i) => `${i.accCode}-${i.templateCode}-${i.rowCode}`}
              emptyMessage="سطری نیست."
            />
          </>
        )}
        {dryRun.isPending && <Typography variant="body2">در حال بررسی…</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={apply.isPending}>
          انصراف
        </Button>
        <Button variant="contained" disabled={ready.length === 0 || apply.isPending} onClick={() => apply.mutate(ready)}>
          {apply.isPending ? 'در حال اعمال…' : `اعمال ${toPersianDigits(ready.length)} سطر`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
