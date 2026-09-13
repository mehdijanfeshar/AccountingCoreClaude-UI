import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Autocomplete from '@mui/material/Autocomplete';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FormDialog } from '../../components/FormDialog';
import { AccountCodePickerDialog } from '../../components/AccountCodePickerDialog';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { levelTafsilsApi } from '../../lib/api/levelTafsilsApi';
import { tafsilGroupsApi } from '../tafsil-groups/api';
import { accountTafsilGroupLinksApi, type AccountTafsilGroupLinkWritePayload } from './api';
import type { AccountTafsilGroupLinkDto } from '../../types/accountTafsilGroupLink';
import type { AccountCodeDto } from '../../types/accountCode';
import type { LevelTafsilDto } from '../../types/levelTafsil';
import type { TafsilGroupDto } from '../../types/tafsilGroup';

export function AccountTafsilGroupLinksTab() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<AccountCodeDto | null>(null);
  const [editingRow, setEditingRow] = useState<AccountTafsilGroupLinkDto | 'new' | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AccountTafsilGroupLinkDto | null>(null);

  const linksQuery = useQuery({
    queryKey: ['account-tafsil-group-links', selectedAccount?.id],
    queryFn: () => accountTafsilGroupLinksApi.list(selectedAccount!.id),
    enabled: selectedAccount !== null,
  });

  const levelsQuery = useQuery({
    queryKey: ['level-tafsils-lookup'],
    queryFn: () => levelTafsilsApi.list({ pageNumber: 1, pageSize: 200 }),
  });
  const levelOptions = levelsQuery.data?.items ?? [];

  const tafsilGroupsQuery = useQuery({
    queryKey: ['tafsil-groups-lookup'],
    queryFn: () => tafsilGroupsApi.list({ pageNumber: 1, pageSize: 200 }),
  });
  const tafsilGroupOptions = tafsilGroupsQuery.data?.items ?? [];

  const levelNameById = useMemo(() => {
    const map = new Map<string, string>();
    levelOptions.forEach((l) => map.set(l.id, `${l.levelCode} - ${l.levelName}`));
    return map;
  }, [levelOptions]);

  const groupNameById = useMemo(() => {
    const map = new Map<string, string>();
    tafsilGroupOptions.forEach((g) => map.set(g.id, `${g.tafsilGroupCode ?? ''} - ${g.tafsilGroupName ?? ''}`));
    return map;
  }, [tafsilGroupOptions]);

  const deleteMutation = useMutation({
    mutationFn: (linkId: string) => accountTafsilGroupLinksApi.remove(selectedAccount!.id, linkId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['account-tafsil-group-links', selectedAccount?.id] });
      notify('ارتباط حذف شد.');
      setPendingDelete(null);
    },
    onError: (error) => {
      notify({ message: error instanceof Error ? error.message : 'حذف با خطا مواجه شد.', severity: 'error' });
    },
  });

  const columns: DataTableColumn<AccountTafsilGroupLinkDto>[] = [
    { key: 'level', header: 'سطح تفصیلی', render: (row) => levelNameById.get(row.levelId) ?? row.levelId },
    { key: 'group', header: 'گروه تفصیلی', render: (row) => groupNameById.get(row.tafsilGroupId) ?? row.tafsilGroupId },
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
        icon={<LinkOutlinedIcon />}
        title="ارتباط معین با گروه تفصیلی"
        description="برای هر معین، سطح تفصیلی و گروه تفصیلی مجاز آن را مشخص کنید."
      />

      <Paper
        variant="outlined"
        sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', borderRadius: 2 }}
      >
        <AccountBalanceWalletOutlinedIcon fontSize="small" color={selectedAccount ? 'primary' : 'action'} />
        <Typography sx={{ fontWeight: 700 }}>معین:</Typography>
        <Typography color={selectedAccount ? 'text.primary' : 'text.secondary'} sx={{ flexGrow: 1 }}>
          {selectedAccount ? `${selectedAccount.accCode ?? ''} - ${selectedAccount.accCodeName ?? ''}` : 'انتخاب نشده'}
        </Typography>
        <Button variant="outlined" size="small" onClick={() => setPickerOpen(true)}>
          {selectedAccount ? 'تغییر معین' : 'انتخاب معین'}
        </Button>
      </Paper>

      {selectedAccount && (
        <>
          <Stack direction="row" sx={{ justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => setEditingRow('new')}>
              افزودن ارتباط
            </Button>
          </Stack>

          {linksQuery.isError && <ErrorBanner error={linksQuery.error} />}

          {!linksQuery.isError && (
            <DataTable
              columns={columns}
              rows={linksQuery.data ?? []}
              getRowKey={(row) => row.id}
              isLoading={linksQuery.isLoading}
              emptyMessage="هیچ ارتباطی برای این معین ثبت نشده است."
            />
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف ارتباط"
        description="آیا از حذف این ارتباط مطمئن هستید؟"
        pending={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />

      <AccountCodePickerDialog
        open={pickerOpen}
        title="انتخاب معین"
        filterRows={(row) => (row.accCode ?? '').length === 6}
        onClose={() => setPickerOpen(false)}
        onSelect={(account) => setSelectedAccount(account)}
      />

      {editingRow !== null && selectedAccount && (
        <AccountTafsilGroupLinkFormDialog
          key={editingRow === 'new' ? 'new' : editingRow.id}
          accountCodeId={selectedAccount.id}
          existing={editingRow === 'new' ? null : editingRow}
          levelOptions={levelOptions}
          tafsilGroupOptions={tafsilGroupOptions}
          onClose={() => setEditingRow(null)}
        />
      )}
    </section>
  );
}

interface AccountTafsilGroupLinkFormDialogProps {
  accountCodeId: string;
  existing: AccountTafsilGroupLinkDto | null;
  levelOptions: LevelTafsilDto[];
  tafsilGroupOptions: TafsilGroupDto[];
  onClose: () => void;
}

interface LinkFormValues {
  levelId: string;
  tafsilGroupId: string;
}

function AccountTafsilGroupLinkFormDialog({
  accountCodeId,
  existing,
  levelOptions,
  tafsilGroupOptions,
  onClose,
}: AccountTafsilGroupLinkFormDialogProps) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<unknown>(null);
  const isEdit = existing !== null;

  const { control, handleSubmit } = useForm<LinkFormValues>({
    defaultValues: {
      levelId: existing?.levelId ?? '',
      tafsilGroupId: existing?.tafsilGroupId ?? '',
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: AccountTafsilGroupLinkWritePayload) => accountTafsilGroupLinksApi.create(accountCodeId, payload),
  });
  const updateMutation = useMutation({
    mutationFn: (payload: AccountTafsilGroupLinkWritePayload) =>
      accountTafsilGroupLinksApi.update(accountCodeId, existing!.id, payload),
  });
  const pending = isEdit ? updateMutation.isPending : createMutation.isPending;

  async function onSubmit(values: LinkFormValues) {
    if (!values.levelId || !values.tafsilGroupId) {
      setSubmitError(new Error('سطح تفصیلی و گروه تفصیلی هر دو الزامی است.'));
      return;
    }
    setSubmitError(null);
    try {
      const payload: AccountTafsilGroupLinkWritePayload = {
        levelId: values.levelId,
        tafsilGroupId: values.tafsilGroupId,
      };
      if (isEdit) {
        await updateMutation.mutateAsync(payload);
      } else {
        await createMutation.mutateAsync(payload);
      }
      await queryClient.invalidateQueries({ queryKey: ['account-tafsil-group-links', accountCodeId] });
      notify(isEdit ? 'ارتباط ویرایش شد.' : 'ارتباط جدید ذخیره شد.');
      onClose();
    } catch (err) {
      setSubmitError(err);
    }
  }

  return (
    <FormDialog
      open
      onClose={onClose}
      icon={<LinkOutlinedIcon />}
      title={isEdit ? 'ویرایش ارتباط' : 'ارتباط جدید'}
      subtitle="سطح تفصیلی و گروه تفصیلی مجاز برای این معین را انتخاب کنید."
      maxWidth="sm"
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
      {submitError !== null && <ErrorBanner error={submitError} />}
      <Grid container spacing={3}>
        <Grid size={12}>
          <Controller
            control={control}
            name="levelId"
            render={({ field }) => (
              <Autocomplete
                options={levelOptions}
                getOptionLabel={(option) => `${option.levelCode} - ${option.levelName}`}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                value={levelOptions.find((l) => l.id === field.value) ?? null}
                onChange={(_event, selected) => field.onChange(selected?.id ?? '')}
                renderInput={(params) => <TextField {...params} label="سطح تفصیلی" required />}
              />
            )}
          />
        </Grid>
        <Grid size={12}>
          <Controller
            control={control}
            name="tafsilGroupId"
            render={({ field }) => (
              <Autocomplete
                options={tafsilGroupOptions}
                getOptionLabel={(option) => `${option.tafsilGroupCode ?? ''} - ${option.tafsilGroupName ?? ''}`}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                value={tafsilGroupOptions.find((g) => g.id === field.value) ?? null}
                onChange={(_event, selected) => field.onChange(selected?.id ?? '')}
                renderInput={(params) => <TextField {...params} label="گروه تفصیلی" required />}
              />
            )}
          />
        </Grid>
      </Grid>
    </FormDialog>
  );
}
