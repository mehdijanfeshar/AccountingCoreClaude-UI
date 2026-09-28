import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { formatPersianDateTime } from '../../lib/format/dates';
import { formatFileSize } from '../../lib/format/numbers';
import { pettyCashAttachmentsApi, PETTY_CASH_ATTACHMENT_MAX_BYTES } from './api';
import type { PettyCashAttachmentDto } from '../../types/pettyCash';

interface PettyCashAttachmentsPanelProps {
  expenseDocId: string;
  /**
   * افزودن/حذف فقط وقتی نمایش داده می‌شود که سند در وضعیت پیش‌نویس/برگشتی **و** کاربر جاری همان
   * ثبت‌کنندهٔ سند باشد. این فقط UX است — قاعدهٔ واقعی سمت سرور اجرا می‌شود (۴۰۳/۴۰۹ روی خطا)، و
   * پیام آن خطا همیشه با `ErrorBanner` نشان داده می‌شود، حتی اگر این پرچم اشتباهاً «باز» بوده باشد.
   */
  canEdit: boolean;
}

/**
 * بخش ۲-ب — پنل پیوست‌های صورت‌هزینه. در `ExpenseDocFormPage` فقط وقتی سند از قبل ذخیره شده
 * (یعنی `id` داریم) نمایش داده می‌شود — پیوست به یک سند هنوز‌ساخته‌نشده معنا ندارد.
 */
export function PettyCashAttachmentsPanel({ expenseDocId, canEdit }: PettyCashAttachmentsPanelProps) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingDelete, setPendingDelete] = useState<PettyCashAttachmentDto | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  const queryKey = ['petty-cash-attachments', expenseDocId];

  const attachmentsQuery = useQuery({
    queryKey,
    queryFn: () => pettyCashAttachmentsApi.list(expenseDocId),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => pettyCashAttachmentsApi.upload(expenseDocId, file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      notify('پیوست افزوده شد.');
    },
    onError: (error) => {
      notify({ message: error instanceof Error ? error.message : 'افزودن پیوست با خطا مواجه شد.', severity: 'error' });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (attachmentId: string) => pettyCashAttachmentsApi.remove(expenseDocId, attachmentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      notify('پیوست حذف شد.');
      setPendingDelete(null);
    },
    onError: (error) => {
      notify({ message: error instanceof Error ? error.message : 'حذف پیوست با خطا مواجه شد.', severity: 'error' });
    },
  });

  function handleFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setClientError(null);
    // فقط UX — سقف واقعی سمت سرور (۴۰۰ فراتر از آن) اجرا می‌شود.
    if (file.size > PETTY_CASH_ATTACHMENT_MAX_BYTES) {
      setClientError(`حجم فایل «${file.name}» بیش از ۱۰ مگابایت است و پذیرفته نمی‌شود.`);
      return;
    }

    uploadMutation.mutate(file);
  }

  async function handleDownload(attachment: PettyCashAttachmentDto) {
    setDownloadingId(attachment.id);
    try {
      await pettyCashAttachmentsApi.download(expenseDocId, attachment.id, attachment.attachName);
    } catch (error) {
      notify({ message: error instanceof Error ? error.message : 'دانلود پیوست با خطا مواجه شد.', severity: 'error' });
    } finally {
      setDownloadingId(null);
    }
  }

  const attachments = attachmentsQuery.data ?? [];

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          پیوست‌ها
        </Typography>
        {canEdit && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              onChange={handleFileChosen}
            />
            <Button
              size="small"
              variant="outlined"
              startIcon={
                uploadMutation.isPending ? <CircularProgress size={16} /> : <AttachFileOutlinedIcon fontSize="small" />
              }
              disabled={uploadMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadMutation.isPending ? 'در حال آپلود…' : 'افزودن پیوست'}
            </Button>
          </>
        )}
      </Stack>

      {clientError && <ErrorBanner error={new Error(clientError)} />}
      {attachmentsQuery.isError && <ErrorBanner error={attachmentsQuery.error} />}

      {attachmentsQuery.isLoading && (
        <Typography variant="body2" color="text.secondary">
          در حال بارگذاری پیوست‌ها…
        </Typography>
      )}

      {!attachmentsQuery.isLoading && !attachmentsQuery.isError && attachments.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          هنوز پیوستی افزوده نشده است.
        </Typography>
      )}

      {attachments.length > 0 && (
        <List dense disablePadding>
          {attachments.map((attachment, index) => (
            <div key={attachment.id}>
              {index > 0 && <Divider component="li" />}
              <ListItem
                disableGutters
                secondaryAction={
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="دانلود">
                      <span>
                        <IconButton
                          size="small"
                          aria-label="دانلود"
                          disabled={downloadingId === attachment.id}
                          onClick={() => handleDownload(attachment)}
                        >
                          {downloadingId === attachment.id ? (
                            <CircularProgress size={16} />
                          ) : (
                            <DownloadOutlinedIcon fontSize="small" />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>
                    {canEdit && (
                      <Tooltip title="حذف">
                        <IconButton
                          size="small"
                          color="error"
                          aria-label="حذف"
                          onClick={() => setPendingDelete(attachment)}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                }
              >
                <ListItemText
                  primary={attachment.attachName}
                  secondary={`${formatFileSize(attachment.attachSize)} — ${formatPersianDateTime(attachment.createdDate)}`}
                />
              </ListItem>
            </div>
          ))}
        </List>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف پیوست"
        description={pendingDelete ? `پیوست «${pendingDelete.attachName}» حذف می‌شود. ادامه می‌دهید؟` : undefined}
        pending={removeMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && removeMutation.mutate(pendingDelete.id)}
      />
    </Stack>
  );
}
