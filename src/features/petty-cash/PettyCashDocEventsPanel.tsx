import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import { ErrorBanner } from '../../components/ErrorBanner';
import { formatPersianDateTime } from '../../lib/format/dates';
import { pettyCashDocEventsApi } from './api';
import { getPettyCashDocActionLabel } from './pettyCashDocAction';
import { getPettyCashStateColor, getPettyCashStateLabel } from './pettyCashDocState';
import { getReturnReasonLabels } from './pettyCashReturnReason';
import type { PettyCashDocEventDto } from '../../types/pettyCash';

/** کلید مشترک React Query — `ExpenseDocFormPage` هم از همین برای بنر سند برگشتی استفاده می‌کند. */
export function pettyCashDocEventsQueryKey(expenseDocId: string) {
  return ['petty-cash-doc-events', expenseDocId] as const;
}

export function usePettyCashDocEvents(expenseDocId: string | undefined) {
  return useQuery({
    queryKey: pettyCashDocEventsQueryKey(expenseDocId ?? ''),
    queryFn: () => pettyCashDocEventsApi.list(expenseDocId as string),
    enabled: Boolean(expenseDocId),
  });
}

interface PettyCashDocEventsPanelProps {
  expenseDocId: string;
}

/**
 * «گردش عملیات» — ص ۱۲ پاورپوینت. تاریخچهٔ اقدامات یک صورت‌هزینه، جدیدترین رویداد بالا (سرور
 * صعودی برمی‌گرداند؛ ترتیب نمایش فقط سمت کلاینت معکوس می‌شود — همان قرارداد «جدیدترین بالا»ی بقیهٔ
 * کارتابل‌های این ماژول).
 */
export function PettyCashDocEventsPanel({ expenseDocId }: PettyCashDocEventsPanelProps) {
  const eventsQuery = usePettyCashDocEvents(expenseDocId);
  const events = useMemo(() => [...(eventsQuery.data ?? [])].reverse(), [eventsQuery.data]);

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <HistoryOutlinedIcon fontSize="small" color="action" />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          تاریخچهٔ اقدامات
        </Typography>
      </Stack>

      {eventsQuery.isError && <ErrorBanner error={eventsQuery.error} />}

      {eventsQuery.isLoading && (
        <Typography variant="body2" color="text.secondary">
          در حال بارگذاری تاریخچه…
        </Typography>
      )}

      {!eventsQuery.isLoading && !eventsQuery.isError && events.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          هنوز رویدادی ثبت نشده است.
        </Typography>
      )}

      {events.length > 0 && (
        <Box
          component="ol"
          sx={{
            listStyle: 'none',
            m: 0,
            p: 0,
            borderInlineStart: '2px solid',
            borderColor: 'divider',
          }}
        >
          {events.map((event) => (
            <PettyCashDocEventItem key={event.id} event={event} />
          ))}
        </Box>
      )}
    </Stack>
  );
}

function PettyCashDocEventItem({ event }: { event: PettyCashDocEventDto }) {
  const returnReasonLabels = getReturnReasonLabels(event.returnReasons);
  // پالت MUI برای رنگ Chip «default» گروه `theme.palette.default` ندارد (رفتار ویژهٔ خودِ Chip
  // است) — برای نقطهٔ خط‌زمانی باید جداگانه به یک رنگ واقعی پالت (`text.disabled`) نگاشت شود.
  const stateColor = getPettyCashStateColor(event.toState);
  const dotColor = stateColor === 'default' ? 'text.disabled' : `${stateColor}.main`;

  return (
    <Box
      component="li"
      sx={{
        position: 'relative',
        pb: 2.5,
        ps: 2.5,
        '&::before': {
          content: '""',
          position: 'absolute',
          insetInlineStart: -7,
          top: 4,
          width: 12,
          height: 12,
          borderRadius: '50%',
          bgcolor: dotColor,
          border: '2px solid',
          borderColor: 'background.paper',
        },
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {getPettyCashDocActionLabel(event.action)}
        </Typography>
        {event.toState != null && (
          <Chip size="small" color={getPettyCashStateColor(event.toState)} label={getPettyCashStateLabel(event.toState)} />
        )}
        <Typography variant="caption" color="text.secondary">
          {formatPersianDateTime(event.createdDate)}
        </Typography>
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        کاربر: {event.userId}
        {event.clientIp ? ` — IP: ${event.clientIp}` : ''}
      </Typography>

      {returnReasonLabels.length > 0 && (
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', mt: 0.75 }}>
          {returnReasonLabels.map((label) => (
            <Chip key={label} size="small" variant="outlined" color="warning" label={label} />
          ))}
        </Stack>
      )}

      {event.note && (
        <Typography variant="body2" sx={{ mt: 0.75, whiteSpace: 'pre-wrap' }}>
          {event.note}
        </Typography>
      )}
    </Box>
  );
}
