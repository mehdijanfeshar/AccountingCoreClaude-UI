import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import NavigateBeforeOutlinedIcon from '@mui/icons-material/NavigateBeforeOutlined';
import NavigateNextOutlinedIcon from '@mui/icons-material/NavigateNextOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import { ErrorBanner } from '../../components/ErrorBanner';
import { toPersianDigits } from '../../lib/format/numbers';
import { pettyCashAttachmentsApi } from './api';

interface PettyCashAttachmentPreviewProps {
  expenseDocId: string;
}

function isPreviewable(contentType: string | null): boolean {
  if (!contentType) return false;
  return contentType.startsWith('image/') || contentType === 'application/pdf';
}

/**
 * صفحهٔ بررسی (ص ۷) — پیش‌نمایش inline پیوست‌های تصویری/PDF، بدون کلیک/دانلود جداگانه. از همان
 * کلید React Query لیست پیوست‌ها استفاده می‌کند (`PettyCashAttachmentsPanel`) — دو رندر همزمان
 * درخواست تکراری نمی‌فرستند.
 */
export function PettyCashAttachmentPreview({ expenseDocId }: PettyCashAttachmentPreviewProps) {
  const [index, setIndex] = useState(0);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [previewContentType, setPreviewContentType] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const attachmentsQuery = useQuery({
    queryKey: ['petty-cash-attachments', expenseDocId],
    queryFn: () => pettyCashAttachmentsApi.list(expenseDocId),
  });

  const previewable = (attachmentsQuery.data ?? []).filter((a) => isPreviewable(a.contentType));
  const current = previewable[index] ?? null;

  useEffect(() => {
    setIndex(0);
  }, [expenseDocId]);

  useEffect(() => {
    let cancelled = false;
    setObjectUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    setLoadError(null);
    if (!current) return;

    setLoading(true);
    pettyCashAttachmentsApi
      .getBlob(expenseDocId, current.id)
      .then(({ blob, contentType }) => {
        if (cancelled) return;
        setObjectUrl(URL.createObjectURL(blob));
        setPreviewContentType(contentType ?? current.contentType);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // eslint-disable-next-line consistent-return
    return () => {
      cancelled = true;
    };
    // فقط با تغییر پیوست جاری دوباره اجرا شود؛ آزادسازی URL قبلی داخل خودِ این افکت انجام می‌شود.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, expenseDocId]);

  // آزادسازی نهایی هنگام unmount کامل کامپوننت.
  useEffect(() => {
    return () => {
      setObjectUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return null;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (attachmentsQuery.isLoading) {
    return (
      <Typography variant="body2" color="text.secondary">
        در حال بارگذاری پیوست‌ها…
      </Typography>
    );
  }

  if (attachmentsQuery.isError) {
    return <ErrorBanner error={attachmentsQuery.error} />;
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <ImageOutlinedIcon fontSize="small" color="action" />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          پیش‌نمایش پیوست
        </Typography>
      </Stack>

      {previewable.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          پیش‌نمایشی موجود نیست (فقط تصویر/PDF قابل پیش‌نمایش‌اند).
        </Typography>
      )}

      {loadError !== null && <ErrorBanner error={loadError} />}

      {current && (
        <>
          {loading && (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                در حال بارگذاری پیش‌نمایش…
              </Typography>
            </Stack>
          )}

          {!loading && objectUrl && previewContentType?.startsWith('image/') && (
            <img
              src={objectUrl}
              alt={current.attachName}
              style={{ maxWidth: '100%', borderRadius: 8, display: 'block' }}
            />
          )}

          {!loading && objectUrl && previewContentType === 'application/pdf' && (
            <object data={objectUrl} type="application/pdf" width="100%" height={420} aria-label={current.attachName}>
              <Typography variant="body2" color="text.secondary">
                نمایشگر PDF در دسترس نیست.
              </Typography>
            </object>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {current.attachName}
          </Typography>

          {previewable.length > 1 && (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'center' }}>
              <IconButton
                size="small"
                aria-label="پیوست قبلی"
                disabled={index === 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              >
                <NavigateNextOutlinedIcon fontSize="small" />
              </IconButton>
              <Typography variant="caption" color="text.secondary">
                {toPersianDigits(index + 1)} از {toPersianDigits(previewable.length)}
              </Typography>
              <IconButton
                size="small"
                aria-label="پیوست بعدی"
                disabled={index === previewable.length - 1}
                onClick={() => setIndex((i) => Math.min(previewable.length - 1, i + 1))}
              >
                <NavigateBeforeOutlinedIcon fontSize="small" />
              </IconButton>
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}
