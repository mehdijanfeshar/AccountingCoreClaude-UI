import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { formatPersianDateTime } from '../../lib/format/dates';
import { formatFileSize, toPersianDigits } from '../../lib/format/numbers';
import { voucherAttachmentsApi, VOUCHER_ATTACHMENT_MAX_BYTES, VOUCHER_ATTACHMENT_MAX_FILES } from './api';
import type { VoucherAttachment } from './types';

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.gif,.doc,.docx,.xls,.xlsx,.zip,.txt';

/** فقط UX — سقف واقعی سمت سرور است. */
function sizeError(file: File): string | null {
  return file.size > VOUCHER_ATTACHMENT_MAX_BYTES ? `حجم فایل «${file.name}» بیش از ۱۰ مگابایت است.` : null;
}

/**
 * انتخاب مدرک پیش از ثبت: فایل‌ها فقط در مرورگر نگه داشته می‌شوند و بلافاصله بعد از ساخته‌شدن سند روی همان سند
 * بارگذاری می‌شوند (سند پیش از ثبت شناسه ندارد).
 */
export function PendingAttachmentsPicker({ files, onChange, disabled }: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function chosen(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = '';
    const tooBig = picked.map(sizeError).find(Boolean) ?? null;
    const ok = picked.filter((f) => !sizeError(f));
    const next = [...files, ...ok].slice(0, VOUCHER_ATTACHMENT_MAX_FILES);
    setError(tooBig ?? (files.length + ok.length > VOUCHER_ATTACHMENT_MAX_FILES ? `حداکثر ${toPersianDigits(VOUCHER_ATTACHMENT_MAX_FILES)} پیوست.` : null));
    onChange(next);
  }

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
        <input ref={inputRef} type="file" accept={ACCEPT} multiple hidden onChange={chosen} />
        <Button
          size="small"
          variant="outlined"
          startIcon={<AttachFileOutlinedIcon fontSize="small" />}
          disabled={disabled || files.length >= VOUCHER_ATTACHMENT_MAX_FILES}
          onClick={() => inputRef.current?.click()}
          sx={{ minHeight: 40 }}
        >
          پیوست مدرک
        </Button>
        {files.map((f, i) => (
          <Chip
            key={`${f.name}-${i}`}
            label={`${f.name} (${formatFileSize(f.size)})`}
            onDelete={disabled ? undefined : () => onChange(files.filter((_, j) => j !== i))}
            size="small"
          />
        ))}
        {files.length === 0 && (
          <Typography variant="caption" color="text.secondary">فاکتور، رسید یا هر مدرکی که حسابدار باید ببیند.</Typography>
        )}
      </Stack>
      {error && <ErrorBanner error={new Error(error)} />}
    </Stack>
  );
}

/** بارگذاری پیوست‌های انتخاب‌شده روی سند تازه. خطای هر فایل جدا برمی‌گردد تا بقیه گم نشوند. */
export async function uploadPendingAttachments(voucherId: string, files: File[]): Promise<string[]> {
  const failed: string[] = [];
  for (const file of files) {
    try {
      await voucherAttachmentsApi.upload(voucherId, file);
    } catch {
      failed.push(file.name);
    }
  }
  return failed;
}

/**
 * پیوست‌های واقعی یک سند حسابیار. `canEdit` فقط UX است؛ سرور ثبت‌کننده و وضعیت «یادداشت/موقت» را خودش کنترل می‌کند.
 */
export function VoucherAttachmentsPanel({ voucherId, canEdit, title = 'مدارک پیوست' }: {
  voucherId: string;
  canEdit: boolean;
  title?: string;
}) {
  const notify = useNotify();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingDelete, setPendingDelete] = useState<VoucherAttachment | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const queryKey = ['voucher-attachments', voucherId];

  const list = useQuery({ queryKey, queryFn: () => voucherAttachmentsApi.list(voucherId), retry: false });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey });
    await qc.invalidateQueries({ queryKey: ['operations-reviews'] });
    await qc.invalidateQueries({ queryKey: ['operations-review-detail'] });
  };

  const upload = useMutation({
    mutationFn: (file: File) => voucherAttachmentsApi.upload(voucherId, file),
    onSuccess: async () => { await refresh(); notify('مدرک پیوست شد.'); },
    onError: (e) => notify({ message: e instanceof Error ? e.message : 'پیوست با خطا مواجه شد.', severity: 'error' }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => voucherAttachmentsApi.remove(voucherId, id),
    onSuccess: async () => { await refresh(); setPendingDelete(null); notify('پیوست حذف شد.'); },
    onError: (e) => notify({ message: e instanceof Error ? e.message : 'حذف پیوست با خطا مواجه شد.', severity: 'error' }),
  });

  function chosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const err = sizeError(file);
    setClientError(err);
    if (!err) upload.mutate(file);
  }

  async function download(a: VoucherAttachment) {
    setDownloadingId(a.id);
    try {
      await voucherAttachmentsApi.download(voucherId, a);
    } catch (e) {
      notify({ message: e instanceof Error ? e.message : 'دریافت فایل با خطا مواجه شد.', severity: 'error' });
    } finally {
      setDownloadingId(null);
    }
  }

  const items = list.data ?? [];

  return (
    <Stack spacing={1} sx={{ textAlign: 'start' }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>{title}</Typography>
        {canEdit && (
          <>
            <input ref={inputRef} type="file" accept={ACCEPT} hidden onChange={chosen} />
            <Button
              size="small"
              variant="outlined"
              startIcon={upload.isPending ? <CircularProgress size={16} /> : <AttachFileOutlinedIcon fontSize="small" />}
              disabled={upload.isPending || items.length >= VOUCHER_ATTACHMENT_MAX_FILES}
              onClick={() => inputRef.current?.click()}
            >
              {upload.isPending ? 'در حال بارگذاری…' : 'افزودن مدرک'}
            </Button>
          </>
        )}
      </Stack>

      {clientError && <ErrorBanner error={new Error(clientError)} />}
      {list.isError && <ErrorBanner error={list.error} />}
      {list.isLoading && <Typography variant="body2" color="text.secondary">در حال خواندن پیوست‌ها…</Typography>}
      {!list.isLoading && !list.isError && items.length === 0 && (
        <Typography variant="body2" color="text.secondary">مدرکی پیوست نشده است.</Typography>
      )}

      {items.length > 0 && (
        <List dense disablePadding>
          {items.map((a, i) => (
            <div key={a.id}>
              {i > 0 && <Divider component="li" />}
              <ListItem
                disableGutters
                secondaryAction={
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="دریافت">
                      <span>
                        <IconButton size="small" aria-label="دریافت" disabled={downloadingId === a.id} onClick={() => void download(a)}>
                          {downloadingId === a.id ? <CircularProgress size={16} /> : <DownloadOutlinedIcon fontSize="small" />}
                        </IconButton>
                      </span>
                    </Tooltip>
                    {canEdit && (
                      <Tooltip title="حذف">
                        <IconButton size="small" color="error" aria-label="حذف" onClick={() => setPendingDelete(a)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                }
              >
                <ListItemText
                  primary={a.title ? `${a.title} — ${a.fileName}` : a.fileName}
                  secondary={`${formatFileSize(a.size)} — ${formatPersianDateTime(a.createdAt)}`}
                />
              </ListItem>
            </div>
          ))}
        </List>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف پیوست"
        description={pendingDelete ? `پیوست «${pendingDelete.fileName}» حذف می‌شود. ادامه می‌دهید؟` : undefined}
        pending={remove.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
      />
    </Stack>
  );
}
