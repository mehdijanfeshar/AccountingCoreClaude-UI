import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import { ErrorBanner } from '../../components/ErrorBanner';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { formatThousands, toPersianDigits } from '../../lib/format/numbers';
import { changeVoucherState } from '../vouchers/api';
import { myVouchersApi } from './api';
import { RETURN_REASON_LABELS, relativeTimeFa } from './roleView';
import { ReplyDialog } from './ReplyDialog';
import { FromHistoryChip, isHistoryExecution } from './HistorySuggestions';
import type { MyVoucherItem, MyVoucherStatus } from './types';

const STATUS_TITLE: Record<MyVoucherStatus, string> = {
  returned: 'سندهای برگشت‌خورده',
  pending: 'سندهای در انتظار بررسی',
  reviewed: 'سندهای بررسی‌شده',
};

/**
 * نوار «سندهای من» بالای خانهٔ حسابیار (GET operations/mine): برگشت‌خورده (با پیام حسابدار، کهربایی)،
 * در انتظار بررسی، بررسی‌شده. کلیک روی هر کارت فهرست همان وضعیت را باز می‌کند.
 */
export function MyVouchersStrip({ financialYear }: { financialYear: string }) {
  const [openStatus, setOpenStatus] = useState<MyVoucherStatus | null>(null);
  const mine = useQuery({
    queryKey: ['operations-mine', financialYear],
    queryFn: () => myVouchersApi.mine(financialYear),
    enabled: Boolean(financialYear),
    retry: false,
  });

  if (mine.isLoading) return <CircularProgress size={20} sx={{ display: 'block', mx: 'auto', my: 2 }} />;
  // سرور قدیمی یا خطا: نوار فقط پنهان می‌شود؛ خانهٔ حسابیار کار می‌کند.
  if (mine.isError || !mine.data) return null;
  const { counts, latestReturn, oldestPendingAtUtc } = mine.data;
  if (counts.returned + counts.pending + counts.reviewed === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        هنوز سندی با حسابیار ثبت نکرده‌اید؛ سندهای شما و وضعیت بررسی‌شان اینجا دیده می‌شود.
      </Typography>
    );
  }

  return (
    <Box sx={{ mb: 2.5 }} component="section" aria-label="سندهای من">
      <Typography variant="h3" component="h2" sx={{ mb: 1 }}>سندهای من</Typography>
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, md: 4 }}>
          <StripCard
            highlight={counts.returned > 0}
            icon={<ReplayOutlinedIcon color={counts.returned > 0 ? 'warning' : 'disabled'} />}
            title={`${toPersianDigits(counts.returned)} سند برگشت‌خورده`}
            onClick={() => setOpenStatus('returned')}
          >
            {latestReturn?.message ? (
              <Typography variant="caption" sx={{ color: 'warning.dark' }}>
                حسابدار نوشته: «{latestReturn.message}»
              </Typography>
            ) : (
              <Typography variant="caption" color="text.secondary">
                {counts.returned > 0 ? 'برای اصلاح و ارسال دوباره بزنید' : 'سند برگشتی ندارید'}
              </Typography>
            )}
          </StripCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <StripCard
            icon={<ScheduleOutlinedIcon color="primary" />}
            title={`${toPersianDigits(counts.pending)} سند در انتظار بررسی`}
            onClick={() => setOpenStatus('pending')}
          >
            <Typography variant="caption" color="text.secondary">
              {oldestPendingAtUtc ? `قدیمی‌ترین: ${relativeTimeFa(oldestPendingAtUtc)}` : 'سندی در صف نیست'}
            </Typography>
          </StripCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <StripCard
            icon={<TaskAltOutlinedIcon color="success" />}
            title={`${toPersianDigits(counts.reviewed)} سند بررسی‌شده`}
            onClick={() => setOpenStatus('reviewed')}
          >
            <Typography variant="caption" color="text.secondary">در سال مالی {toPersianDigits(financialYear)}</Typography>
          </StripCard>
        </Grid>
      </Grid>
      {openStatus && <MyVouchersDialog status={openStatus} financialYear={financialYear} onClose={() => setOpenStatus(null)} />}
    </Box>
  );
}

function StripCard({ icon, title, children, onClick, highlight }: { icon: ReactNode; title: string; children: ReactNode; onClick: () => void; highlight?: boolean }) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2.5,
        height: '100%',
        ...(highlight && { borderColor: 'warning.main', backgroundColor: 'rgba(237, 108, 2, 0.06)' }),
      }}
    >
      <CardActionArea onClick={onClick} sx={{ p: 1.75, minHeight: 64, height: '100%' }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
          {icon}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body1" sx={{ fontWeight: 700 }}>{title}</Typography>
            {children}
          </Box>
        </Stack>
      </CardActionArea>
    </Card>
  );
}

function MyVouchersDialog({ status, financialYear, onClose }: { status: MyVoucherStatus; financialYear: string; onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['operations-mine', financialYear, status],
    queryFn: () => myVouchersApi.mine(financialYear, status),
    retry: false,
  });
  // سند برگشتی در «یادداشت» است؛ پس از اصلاح دوباره «موقت» می‌شود تا به صف حسابدار برگردد.
  const resubmit = useMutation({
    mutationFn: (voucherId: string) => changeVoucherState([voucherId], 2),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operations-mine'] }),
  });
  const items = (list.data?.items ?? []).filter((i) => i.status === status);
  const [replyTo, setReplyTo] = useState<MyVoucherItem | null>(null);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" aria-labelledby="my-vouchers-title">
      <DialogTitle id="my-vouchers-title">{STATUS_TITLE[status]}</DialogTitle>
      <DialogContent dividers>
        {list.isLoading && <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', my: 2 }} />}
        {list.isError && <ErrorBanner error={list.error} />}
        {resubmit.isError && <ErrorBanner error={resubmit.error} />}
        {!list.isLoading && !list.isError && items.length === 0 && (
          <Typography variant="body2" color="text.secondary">سندی در این وضعیت نیست.</Typography>
        )}
        <Stack spacing={1.25}>
          {items.map((item) => (
            <VoucherRow
              key={item.executionId}
              item={item}
              resubmitting={resubmit.isPending && resubmit.variables === item.voucherId}
              onOpen={() => navigate(`/operation/vouchers/${item.voucherId}/view`)}
              onEdit={() => navigate(`/operation/vouchers/${item.voucherId}/edit`)}
              onResubmit={() => resubmit.mutate(item.voucherId)}
              onReply={() => setReplyTo(item)}
            />
          ))}
        </Stack>
      </DialogContent>
      <DialogActions><Button sx={{ minHeight: 44 }} onClick={onClose}>بستن</Button></DialogActions>
      {replyTo && <ReplyDialog executionId={replyTo.executionId} docNum={replyTo.docNum} onClose={() => setReplyTo(null)} />}
    </Dialog>
  );
}

function VoucherRow({ item, onOpen, onEdit, onResubmit, onReply, resubmitting }: {
  item: MyVoucherItem; onOpen: () => void; onEdit: () => void; onResubmit: () => void; onReply: () => void; resubmitting: boolean;
}) {
  const returned = item.status === 'returned';
  return (
    <Box sx={{ border: 1, borderColor: returned ? 'warning.main' : 'divider', borderRadius: 2, p: 1.5, bgcolor: returned ? 'rgba(237, 108, 2, 0.06)' : undefined }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
        <Typography variant="body1" sx={{ fontWeight: 700 }}>سند {toPersianDigits(item.docNum)}</Typography>
        <Typography variant="body2" color="text.secondary">{item.templateTitle ?? 'سند دستی'}</Typography>
        {isHistoryExecution(item.templateTitle, item.channel) && <FromHistoryChip />}
        <Box sx={{ flex: 1 }} />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{toPersianDigits(formatThousands(item.totalAmount))} ریال</Typography>
        <Chip size="small" variant="outlined" label={formatLegacyJalaliDate(item.date)} />
      </Stack>
      {item.plainText && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{item.plainText}</Typography>}
      {returned && (
        <Alert severity="warning" icon={<ReplayOutlinedIcon fontSize="inherit" />} sx={{ mt: 1 }}>
          <strong>{item.returnReasonCode ? RETURN_REASON_LABELS[item.returnReasonCode] ?? item.returnReasonCode : 'برگشت'}</strong>
          {item.returnMessage ? ` — ${item.returnMessage}` : ''}
          {item.returnedAtUtc ? ` (${relativeTimeFa(item.returnedAtUtc)})` : ''}
          <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
            سند را اصلاح کنید (در «یادداشت» است) و بعد «ارسال دوباره» را بزنید.
          </Typography>
        </Alert>
      )}
      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 1 }}>
        <Button size="small" variant="outlined" sx={{ minHeight: 44 }} onClick={onOpen}>باز کردن سند</Button>
        {returned && <Button size="small" variant="outlined" color="warning" sx={{ minHeight: 44 }} onClick={onEdit}>ویرایش سند</Button>}
        {returned && <Button size="small" variant="outlined" sx={{ minHeight: 44 }} onClick={onReply}>پاسخ به حسابدار</Button>}
        {returned && (
          <Button size="small" variant="contained" sx={{ minHeight: 44 }} disabled={resubmitting} onClick={onResubmit}>
            {resubmitting ? 'در حال ارسال…' : 'پیوست و ارسال دوباره'}
          </Button>
        )}
      </Stack>
    </Box>
  );
}
