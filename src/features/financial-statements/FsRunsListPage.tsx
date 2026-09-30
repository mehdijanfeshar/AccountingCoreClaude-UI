import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { useSession } from '../../lib/session/SessionContext';
import { toPersianDigits } from '../../lib/format/numbers';
import { FS_FRAMEWORK_OPTIONS, labelOf } from '../../types/fsTemplate';
import { describePeriod, type FsRunSummaryDto } from '../../types/fsRun';
import { fsRunsApi } from './api';

/** اجراهای «تهیهٔ صورت‌های مالی» واحد جاری در سال جاری نشست (بخش ۴۵-ب). */
export function FsRunsListPage() {
  const navigate = useNavigate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { financialYear, unitCode } = useSession();
  const [pendingDelete, setPendingDelete] = useState<FsRunSummaryDto | null>(null);

  const listQuery = useQuery({
    queryKey: ['fs-runs', unitCode, financialYear],
    queryFn: () => fsRunsApi.list(financialYear || undefined),
  });

  const deleteMutation = useMutation({
    mutationFn: (r: FsRunSummaryDto) => fsRunsApi.remove(r.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['fs-runs'] });
      notify('اجرا حذف شد.');
      setPendingDelete(null);
    },
  });

  const columns: DataTableColumn<FsRunSummaryDto>[] = [
    { key: 'no', header: 'شماره', width: 70, render: (r) => toPersianDigits(r.runNo) },
    { key: 'fw', header: 'مجموعه', render: (r) => labelOf(FS_FRAMEWORK_OPTIONS, r.framework) },
    { key: 'period', header: 'دوره', render: (r) => describePeriod(r.year, r.toMonth, toPersianDigits) },
    {
      key: 'scope',
      header: 'دامنه',
      render: (r) => (r.includeSubUnits ? `ترکیبی (${toPersianDigits(r.unitCount)} واحد)` : 'جداگانه'),
    },
    {
      key: 'state',
      header: 'وضعیت',
      render: (r) => (
        <Stack direction="row" spacing={0.5}>
          <Chip size="small" color="warning" label="پیش‌نویس" />
          {r.usesDraft && <Chip size="small" variant="outlined" color="warning" label="آزمایشی" />}
        </Stack>
      ),
    },
    {
      key: 'created',
      header: 'تهیه',
      render: (r) => `${toPersianDigits(new Date(r.createdDate).toLocaleDateString('fa-IR'))} · ${r.addUserId}`,
    },
    {
      key: 'action',
      header: 'عملیات',
      align: 'end',
      render: (r) => (
        <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
          <Tooltip title="نمایش">
            <IconButton size="small" color="primary" onClick={() => navigate(`/fs/runs/${r.id}`)}>
              <VisibilityOutlinedIcon fontSize="small" />
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
        icon={<AssessmentOutlinedIcon />}
        title="صورت‌های مالی تهیه‌شده"
        description={`اجراهای واحد جاری در سال ${toPersianDigits(financialYear || '—')}. هر اجرا نتیجهٔ ثابت یک بار محاسبه است.`}
        actions={
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => navigate('/fs/runs/new')}>
            تهیهٔ صورت‌ها
          </Button>
        }
      />

      {listQuery.isError && <ErrorBanner error={listQuery.error} />}
      {deleteMutation.isError && <ErrorBanner error={deleteMutation.error} />}

      {!listQuery.isError && (
        <DataTable
          columns={columns}
          rows={listQuery.data ?? []}
          getRowKey={(r) => r.id}
          isLoading={listQuery.isLoading}
          emptyMessage="هنوز صورتی برای این واحد و سال تهیه نشده است."
          emptyAction={
            <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => navigate('/fs/runs/new')}>
              تهیهٔ اولین صورت‌ها
            </Button>
          }
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف اجرا"
        description={pendingDelete ? `اجرای شمارهٔ ${toPersianDigits(pendingDelete.runNo)} حذف می‌شود. ادامه می‌دهید؟` : undefined}
        pending={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete)}
      />
    </section>
  );
}
