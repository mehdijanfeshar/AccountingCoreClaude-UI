import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorBanner } from '../../components/ErrorBanner';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { toLatinDigits } from '../../lib/format/numbers';
import { pettyCashFundReviewersApi } from './api';
import { buildEmptyReviewerFormValues, reviewerFormSchema, type ReviewerFormValues } from './schema';
import type { PettyCashFundDto, PettyCashFundReviewerDto } from '../../types/pettyCash';

interface PettyCashReviewersDialogProps {
  fund: PettyCashFundDto | null;
  open: boolean;
  onClose: () => void;
}

/**
 * بخش ۲ — «بررسی‌کنندگان تنخواه» (`TB_PC_REVIEWER`، RBAC مخصوص این ماژول). لیست + فرم افزودن/ویرایش
 * در یک دیالوگ، هم‌الگوی `PettyCashFundFormDialog`.
 *
 * ویرایش یعنی «بازارسال همان `reviewerUserId` با نام جدید» نه یک شناسهٔ جدا — سرور کلید upsert را
 * روی جفت `(fundId, reviewerUserId)` می‌گیرد (`UpsertPettyCashFundReviewerCommandHandler`)، نه
 * `id`. به همین دلیل کلیک «ویرایش» فیلد کد کاربری را قفل می‌کند: تغییردادن آن یعنی ساخت یک
 * بررسی‌کنندهٔ کاملاً جدید، نه ویرایش همین ردیف.
 */
export function PettyCashReviewersDialog({ fund, open, onClose }: PettyCashReviewersDialogProps) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<PettyCashFundReviewerDto | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PettyCashFundReviewerDto | null>(null);

  const reviewersQuery = useQuery({
    queryKey: ['petty-cash-fund-reviewers', fund?.id],
    queryFn: () => pettyCashFundReviewersApi.list(fund!.id),
    enabled: open && fund !== null,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReviewerFormValues>({
    resolver: zodResolver(reviewerFormSchema),
    defaultValues: buildEmptyReviewerFormValues(),
  });

  useEffect(() => {
    if (!open) return;
    reset(
      editing
        ? { reviewerUserId: editing.reviewerUserId, reviewerName: editing.reviewerName ?? '' }
        : buildEmptyReviewerFormValues(),
    );
  }, [open, editing, reset]);

  // دیالوگ بسته می‌شود → حالت ویرایش/فرم پاک شود تا دفعهٔ بعد که برای یک تنخواهِ دیگر باز می‌شود خالی باشد.
  useEffect(() => {
    if (!open) setEditing(null);
  }, [open]);

  const saveMutation = useMutation({
    mutationFn: (values: ReviewerFormValues) =>
      pettyCashFundReviewersApi.upsert(fund!.id, {
        reviewerUserId: values.reviewerUserId.trim(),
        reviewerName: values.reviewerName?.trim() ? values.reviewerName.trim() : null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['petty-cash-fund-reviewers', fund?.id] });
      notify(editing ? 'بررسی‌کننده به‌روزرسانی شد.' : 'بررسی‌کننده افزوده شد.');
      setEditing(null);
      reset(buildEmptyReviewerFormValues());
    },
    onError: (error) => {
      notify({ message: error instanceof Error ? error.message : 'ذخیرهٔ بررسی‌کننده با خطا مواجه شد.', severity: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (reviewer: PettyCashFundReviewerDto) => pettyCashFundReviewersApi.remove(fund!.id, reviewer.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['petty-cash-fund-reviewers', fund?.id] });
      notify('بررسی‌کننده حذف شد.');
      setPendingDelete(null);
    },
    onError: (error) => {
      notify({ message: error instanceof Error ? error.message : 'حذف بررسی‌کننده با خطا مواجه شد.', severity: 'error' });
    },
  });

  function onSubmit(values: ReviewerFormValues) {
    saveMutation.mutate(values);
  }

  const columns: DataTableColumn<PettyCashFundReviewerDto>[] = [
    { key: 'reviewerUserId', header: 'کد کاربری', render: (row) => row.reviewerUserId },
    { key: 'reviewerName', header: 'نام', render: (row) => row.reviewerName ?? '—' },
    {
      key: 'action',
      header: 'عملیات',
      render: (row) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="ویرایش">
            <IconButton size="small" aria-label="ویرایش" onClick={() => setEditing(row)}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="حذف">
            <IconButton size="small" color="error" aria-label="حذف" onClick={() => setPendingDelete(row)}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>بررسی‌کنندگان تنخواه {fund?.name ? `«${fund.name}»` : ''}</DialogTitle>
      <DialogContent>
        {reviewersQuery.isError && <ErrorBanner error={reviewersQuery.error} />}

        {!reviewersQuery.isError && (
          <DataTable
            columns={columns}
            rows={reviewersQuery.data ?? []}
            getRowKey={(row) => row.id}
            isLoading={reviewersQuery.isLoading}
            skeletonRows={2}
            emptyMessage="هنوز بررسی‌کننده‌ای برای این تنخواه تعریف نشده است."
          />
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {editing ? `ویرایش «${editing.reviewerUserId}»` : 'افزودن بررسی‌کنندهٔ جدید'}
        </Typography>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                {...register('reviewerUserId', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
                label="کد کاربری"
                fullWidth
                disabled={editing !== null}
                slotProps={{
                  htmlInput: { maxLength: 50 },
                  input: {
                    startAdornment: <BadgeOutlinedIcon fontSize="small" color="action" sx={{ ml: 1 }} />,
                  },
                }}
                error={!!errors.reviewerUserId}
                helperText={
                  errors.reviewerUserId?.message ??
                  (editing ? 'کد کاربری قابل تغییر نیست؛ برای تغییر آن یک بررسی‌کنندهٔ جدید بسازید.' : undefined)
                }
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                {...register('reviewerName')}
                label="نام"
                fullWidth
                slotProps={{ htmlInput: { maxLength: 200 } }}
                error={!!errors.reviewerName}
                helperText={errors.reviewerName?.message}
              />
            </Grid>
            <Grid size={12}>
              <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                {editing && (
                  <Button
                    color="inherit"
                    onClick={() => {
                      setEditing(null);
                      reset(buildEmptyReviewerFormValues());
                    }}
                    disabled={saveMutation.isPending}
                  >
                    انصراف از ویرایش
                  </Button>
                )}
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={
                    saveMutation.isPending ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : editing ? (
                      <EditOutlinedIcon fontSize="small" />
                    ) : (
                      <PersonAddOutlinedIcon fontSize="small" />
                    )
                  }
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? 'در حال ذخیره…' : editing ? 'ذخیرهٔ تغییرات' : 'افزودن'}
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </form>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          بستن
        </Button>
      </DialogActions>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف بررسی‌کننده"
        description={
          pendingDelete
            ? `بررسی‌کنندهٔ «${pendingDelete.reviewerName || pendingDelete.reviewerUserId}» حذف می‌شود. ادامه می‌دهید؟`
            : undefined
        }
        pending={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete)}
      />
    </Dialog>
  );
}
