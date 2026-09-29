import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { toLatinDigits } from '../../lib/format/numbers';
import { meApi } from '../../lib/api/meApi';
import { treasuryRolesApi } from './api';
import { TREASURY_ROLE_OPTIONS, getTreasuryRoleLabel } from './treasuryPaymentRequestState';
import { buildEmptyTreasuryRoleFormValues, treasuryRoleFormSchema, type TreasuryRoleFormValues } from './schema';
import type { TreasuryRoleDto } from '../../types/treasury';

/**
 * نقش‌های خزانه (`TB_TR_ROLE`) — خزانه‌داری بخش ۴-الف. فهرستی کاملاً جدا از `TB_PC_REVIEWER`
 * تنخواه؛ یک کاربر می‌تواند بیش از یک نقش در همان واحد داشته باشد. ایجاد فقط برای نقش
 * FinanceManager مجاز است — با استثنای bootstrap: اگر واحد هیچ FinanceManager فعالی ندارد، هر
 * کاربر احرازشدهٔ واحد می‌تواند اولین نقش را ثبت کند؛ خطای واقعی سرور (۴۰۳) همان‌طور که هست نمایش
 * داده می‌شود.
 */
export function TreasuryRolesPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<TreasuryRoleDto | null>(null);

  const rolesQuery = useQuery({ queryKey: ['treasury-roles'], queryFn: () => treasuryRolesApi.list() });
  const currentUserQuery = useQuery({ queryKey: ['me'], queryFn: () => meApi.getCurrentUser() });

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<TreasuryRoleFormValues>({
    resolver: zodResolver(treasuryRoleFormSchema),
    defaultValues: buildEmptyTreasuryRoleFormValues(),
  });

  const saveMutation = useMutation({
    mutationFn: (values: TreasuryRoleFormValues) =>
      treasuryRolesApi.create({
        userId: values.userId.trim(),
        userName: values.userName?.trim() ? values.userName.trim() : null,
        role: values.role,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['treasury-roles'] });
      notify('نقش خزانه افزوده شد.');
      reset(buildEmptyTreasuryRoleFormValues());
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (role: TreasuryRoleDto) => treasuryRolesApi.remove(role.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['treasury-roles'] });
      notify('نقش خزانه حذف شد.');
      setPendingDelete(null);
    },
  });

  function onSubmit(values: TreasuryRoleFormValues) {
    saveMutation.mutate(values);
  }

  const columns: DataTableColumn<TreasuryRoleDto>[] = [
    { key: 'userId', header: 'کد کاربری', render: (row) => row.userId },
    { key: 'userName', header: 'نام', render: (row) => row.userName ?? '—' },
    { key: 'role', header: 'نقش', render: (row) => getTreasuryRoleLabel(row.role) },
    {
      key: 'action',
      header: 'عملیات',
      render: (row) => (
        <Tooltip title="حذف">
          <IconButton size="small" color="error" aria-label="حذف" onClick={() => setPendingDelete(row)}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <section>
      <PageHeader
        eyebrow="تنخواه و خزانه‌داری"
        icon={<GroupsOutlinedIcon />}
        accentColor="secondary"
        title="نقش‌های خزانه"
        description="مدیر واحد، مدیر مالی، مدیرعامل، حسابدار ارشد و خزانه‌دار — فهرستی جدا از نقش‌های تنخواه."
      />

      {rolesQuery.isError && <ErrorBanner error={rolesQuery.error} />}
      {saveMutation.isError && <ErrorBanner error={saveMutation.error} />}

      {!rolesQuery.isError && (
        <DataTable
          columns={columns}
          rows={rolesQuery.data ?? []}
          getRowKey={(row) => row.id}
          isLoading={rolesQuery.isLoading}
          emptyMessage="هنوز نقشی برای این واحد تعریف نشده است."
        />
      )}

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mt: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          افزودن نقش جدید
        </Typography>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                {...register('userId', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
                label="کد کاربری"
                fullWidth
                slotProps={{
                  htmlInput: { maxLength: 10 },
                  input: { startAdornment: <BadgeOutlinedIcon fontSize="small" color="action" sx={{ ml: 1 }} /> },
                }}
                error={!!errors.userId}
                helperText={errors.userId?.message}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <TextField
                    select
                    fullWidth
                    required
                    label="نقش"
                    value={field.value}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    error={!!errors.role}
                    helperText={errors.role?.message}
                  >
                    {TREASURY_ROLE_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                {...register('userName')}
                label="نام (اختیاری)"
                fullWidth
                slotProps={{ htmlInput: { maxLength: 200 } }}
                error={!!errors.userName}
                helperText={errors.userName?.message}
              />
            </Grid>
            <Grid size={12}>
              <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Tooltip title={currentUserQuery.data ? '' : 'در حال بارگذاری کاربر جاری…'}>
                  <span>
                    <Button
                      size="small"
                      variant="text"
                      startIcon={<HowToRegOutlinedIcon fontSize="small" />}
                      disabled={!currentUserQuery.data}
                      onClick={() => {
                        if (!currentUserQuery.data) return;
                        setValue('userId', currentUserQuery.data.userId, { shouldValidate: true, shouldDirty: true });
                      }}
                    >
                      افزودن خودم
                    </Button>
                  </span>
                </Tooltip>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={saveMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <PersonAddOutlinedIcon fontSize="small" />}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? 'در حال ذخیره…' : 'افزودن'}
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </form>
      </Paper>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف نقش خزانه"
        description={
          pendingDelete
            ? `نقش «${getTreasuryRoleLabel(pendingDelete.role)}» برای «${pendingDelete.userName || pendingDelete.userId}» حذف می‌شود. ادامه می‌دهید؟`
            : undefined
        }
        pending={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete)}
      />
    </section>
  );
}
