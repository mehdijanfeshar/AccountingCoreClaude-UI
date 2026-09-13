import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Autocomplete from '@mui/material/Autocomplete';
import Chip from '@mui/material/Chip';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import DriveFileRenameOutlineOutlinedIcon from '@mui/icons-material/DriveFileRenameOutlineOutlined';
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { Pagination } from '../../components/Pagination';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FormDialog } from '../../components/FormDialog';
import { FormSectionLabel } from '../../components/FormSectionLabel';
import { TriStateToggle, type TriStateValue } from '../../components/TriStateToggle';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { ApiError } from '../../lib/api/apiError';
import { toLatinDigits } from '../../lib/format/numbers';
import { tafsilGroupsApi } from '../tafsil-groups/api';
import { tafsilisApi } from './api';
import {
  emptyTafsiliFormValues,
  tafsiliDtoToFormValues,
  tafsiliFormSchema,
  tafsiliFormValuesToPayload,
  type TafsiliFormValues,
} from './schema';
import type { TafsiliDto } from '../../types/tafsiliMaster';
import type { TafsilGroupDto } from '../../types/tafsilGroup';

const PAGE_SIZE = 20;

export function TafsilisTab() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [pageNumber, setPageNumber] = useState(1);
  const [filter, setFilter] = useState('');
  const [editingRow, setEditingRow] = useState<TafsiliDto | 'new' | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TafsiliDto | null>(null);

  const query = useQuery({
    queryKey: ['tafsilis', pageNumber, PAGE_SIZE],
    queryFn: () => tafsilisApi.list({ pageNumber, pageSize: PAGE_SIZE }),
    placeholderData: (previous) => previous,
  });

  const tafsilGroupsQuery = useQuery({
    queryKey: ['tafsil-groups-lookup'],
    queryFn: () => tafsilGroupsApi.list({ pageNumber: 1, pageSize: 200 }),
  });
  const tafsilGroupOptions = tafsilGroupsQuery.data?.items ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tafsilisApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tafsilis'] });
      notify('تفصیلی حذف شد.');
      setPendingDelete(null);
    },
    onError: (error) => {
      notify({ message: error instanceof Error ? error.message : 'حذف با خطا مواجه شد.', severity: 'error' });
    },
  });

  const rows = useMemo(() => {
    const items = query.data?.items ?? [];
    if (!filter.trim()) return items;
    const needle = filter.trim().toLowerCase();
    return items.filter(
      (row) =>
        (row.tafsiliCode ?? '').toLowerCase().includes(needle) ||
        (row.tafsiliName ?? '').toLowerCase().includes(needle),
    );
  }, [query.data, filter]);

  const groupNameById = useMemo(() => {
    const map = new Map<string, string>();
    tafsilGroupOptions.forEach((g) => map.set(g.id, g.tafsilGroupName ?? g.tafsilGroupCode ?? g.id));
    return map;
  }, [tafsilGroupOptions]);

  const columns: DataTableColumn<TafsiliDto>[] = [
    { key: 'tafsiliCode', header: 'کد تفصیلی', render: (row) => row.tafsiliCode ?? '—' },
    { key: 'tafsiliName', header: 'عنوان تفصیلی', render: (row) => row.tafsiliName ?? '—' },
    {
      key: 'tafsilGroups',
      header: 'گروه‌های تفصیلی',
      render: (row) =>
        row.tafsilGroupIds.length === 0 ? (
          '—'
        ) : (
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {row.tafsilGroupIds.map((id) => (
              <Chip key={id} size="small" label={groupNameById.get(id) ?? id} />
            ))}
          </Stack>
        ),
    },
    {
      key: 'action',
      header: 'عملیات',
      render: (row) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="ویرایش">
            <IconButton size="small" onClick={() => setEditingRow(row)}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="حذف">
            <IconButton size="small" color="error" onClick={() => setPendingDelete(row)}>
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
        eyebrow="اطلاعات پایه"
        icon={<CategoryOutlinedIcon />}
        title="تفصیلی"
        description="فهرست حساب‌های تفصیلی (TB_TAFSILI)"
        actions={
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => setEditingRow('new')}>
            افزودن تفصیلی
          </Button>
        }
      />

      <Box sx={{ mb: 2, maxWidth: 320 }}>
        <TextField
          fullWidth
          size="small"
          label="جستجو در همین صفحه"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlinedIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      {query.isError && <ErrorBanner error={query.error} />}

      {!query.isError && (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.id}
            isLoading={query.isLoading}
            emptyMessage="هیچ تفصیلی‌ای یافت نشد."
          />
          {query.data && (
            <Pagination
              pageNumber={query.data.pageNumber}
              pageSize={query.data.pageSize}
              totalCount={query.data.totalCount}
              onPageChange={setPageNumber}
            />
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف تفصیلی"
        description={pendingDelete ? `آیا از حذف «${pendingDelete.tafsiliName ?? pendingDelete.tafsiliCode}» مطمئن هستید؟` : undefined}
        pending={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />

      {editingRow !== null && (
        <TafsiliFormDialog
          key={editingRow === 'new' ? 'new' : editingRow.id}
          existing={editingRow === 'new' ? null : editingRow}
          tafsilGroupOptions={tafsilGroupOptions}
          onClose={() => setEditingRow(null)}
        />
      )}
    </section>
  );
}

interface TafsiliFormDialogProps {
  existing: TafsiliDto | null;
  tafsilGroupOptions: TafsilGroupDto[];
  onClose: () => void;
}

function TafsiliFormDialog({ existing, tafsilGroupOptions, onClose }: TafsiliFormDialogProps) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<unknown>(null);
  const isEdit = existing !== null;

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TafsiliFormValues>({
    resolver: zodResolver(tafsiliFormSchema),
    defaultValues: existing ? tafsiliDtoToFormValues(existing) : emptyTafsiliFormValues,
  });

  const createMutation = useMutation({
    mutationFn: (values: TafsiliFormValues) => tafsilisApi.create(tafsiliFormValuesToPayload(values)),
  });
  const updateMutation = useMutation({
    mutationFn: (values: TafsiliFormValues) => tafsilisApi.update(existing!.id, tafsiliFormValuesToPayload(values)),
  });
  const pending = isEdit ? updateMutation.isPending : createMutation.isPending;

  async function onSubmit(values: TafsiliFormValues) {
    setSubmitError(null);
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(values);
      } else {
        await createMutation.mutateAsync(values);
      }
      await queryClient.invalidateQueries({ queryKey: ['tafsilis'] });
      notify(isEdit ? 'تفصیلی ویرایش شد.' : 'تفصیلی جدید ذخیره شد.');
      onClose();
    } catch (err) {
      setSubmitError(err);
    }
  }

  const duplicateMessage =
    submitError instanceof ApiError && submitError.status === 409 ? 'کد تفصیلی تکراری است.' : null;

  return (
    <FormDialog
      open
      onClose={onClose}
      icon={<CategoryOutlinedIcon />}
      title={isEdit ? 'ویرایش تفصیلی' : 'تفصیلی جدید'}
      subtitle="حساب تفصیلی و گروه‌های تفصیلی مرتبط با آن را وارد کنید."
      onSubmit={handleSubmit(onSubmit)}
      actions={
        <>
          <Button variant="text" onClick={onClose} disabled={pending}>
            انصراف
          </Button>
          <Button type="submit" variant="contained" startIcon={<SaveOutlinedIcon />} disabled={pending}>
            {pending ? 'در حال ذخیره...' : 'ذخیره'}
          </Button>
        </>
      }
    >
      {duplicateMessage ? (
        <ErrorBanner error={new Error(duplicateMessage)} />
      ) : (
        submitError !== null && <ErrorBanner error={submitError} />
      )}
      <Grid container spacing={3}>
        <Grid size={12}>
          <FormSectionLabel label="اطلاعات اصلی" />
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                {...register('tafsiliCode', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
                label="کد تفصیلی"
                fullWidth
                required
                slotProps={{
                  htmlInput: { maxLength: 15 },
                  input: { startAdornment: <InputAdornment position="start"><TagOutlinedIcon fontSize="small" color="action" /></InputAdornment> },
                }}
                error={!!errors.tafsiliCode}
                helperText={errors.tafsiliCode?.message}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField
                {...register('tafsiliName')}
                label="عنوان تفصیلی"
                fullWidth
                required
                slotProps={{
                  htmlInput: { maxLength: 200 },
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <DriveFileRenameOutlineOutlinedIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                  },
                }}
                error={!!errors.tafsiliName}
                helperText={errors.tafsiliName?.message}
              />
            </Grid>

            <Grid size={12}>
              <TextField
                {...register('tafsilDesc')}
                label="توضیحات"
                fullWidth
                multiline
                minRows={2}
                slotProps={{
                  htmlInput: { maxLength: 200 },
                  input: { startAdornment: <InputAdornment position="start"><NotesOutlinedIcon fontSize="small" color="action" /></InputAdornment> },
                }}
                error={!!errors.tafsilDesc}
                helperText={errors.tafsilDesc?.message}
              />
            </Grid>

            <Grid size={12}>
              <FormSectionLabel label="دسته‌بندی" />
            </Grid>

            <Grid size={12}>
              <Controller
                control={control}
                name="tafsilGroupIds"
                render={({ field }) => (
                  <Autocomplete
                    multiple
                    options={tafsilGroupOptions}
                    getOptionLabel={(option) => `${option.tafsilGroupCode ?? ''} - ${option.tafsilGroupName ?? ''}`}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    value={tafsilGroupOptions.filter((g) => field.value.includes(g.id))}
                    onChange={(_event, selected) =>
                      field.onChange(selected.map((s) => s.id))
                    }
                    renderInput={(params) => <TextField {...params} label="گروه‌های تفصیلی" />}
                  />
                )}
              />
            </Grid>

            <Grid size={12}>
              <FormSectionLabel
                label="ویژگی‌های تکمیلی"
                caption="معنای دقیق این ستون‌ها هنوز در بک‌اند تأیید نشده — فعلاً به‌صورت سه‌حالته (بله/خیر/تعیین‌نشده) نمایش داده می‌شوند."
              />
            </Grid>

            <Grid size={12}>
              <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: 'action.hover' }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Controller
                      control={control}
                      name="isActive"
                      render={({ field }) => (
                        <TriStateToggle
                          label="IsActive (فعال)"
                          value={field.value as TriStateValue}
                          onChange={field.onChange}
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Controller
                      control={control}
                      name="personType"
                      render={({ field }) => (
                        <TriStateToggle
                          label="PersonType"
                          value={field.value as TriStateValue}
                          onChange={field.onChange}
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Controller
                      control={control}
                      name="owner"
                      render={({ field }) => (
                        <TriStateToggle
                          label="Owner"
                          value={field.value as TriStateValue}
                          onChange={field.onChange}
                          helperText="کامنت بک‌اند: 2=setad 1=vahed"
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <Controller
                      control={control}
                      name="vahedType"
                      render={({ field }) => (
                        <TriStateToggle
                          label="VahedType"
                          value={field.value as TriStateValue}
                          onChange={field.onChange}
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </Box>
            </Grid>
          </Grid>
    </FormDialog>
  );
}
