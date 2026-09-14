import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Alert from '@mui/material/Alert';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { Pagination } from '../../components/Pagination';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FormDialog } from '../../components/FormDialog';
import { RecordMetaFooter } from '../../components/RecordMetaFooter';
import { AccountCodePickerDialog } from '../../components/AccountCodePickerDialog';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { ApiError } from '../../lib/api/apiError';
import { accountCodesApi } from './api';
import { AccountCodeFormFields } from './AccountCodeFormFields';
import { useAllAccountCodes } from './useAllAccountCodes';
import {
  accountCodeDtoToFormValues,
  accountCodeFormSchema,
  accountCodeFormValuesToPayload,
  emptyAccountCodeFormValues,
  type AccountCodeFormValues,
} from './schema';
import type { AccountCodeDto } from '../../types/accountCode';

const PAGE_SIZE = 20;

interface AccountCodeLevelTabProps {
  title: string;
  description: string;
  icon: ReactNode;
  /** Expected `accCode.length` for this level — see `useAllAccountCodes.ts` XML doc for why this is the level-detection heuristic. */
  codeLength: number;
  codeLengthHint: string;
  /** `null` for گروه (top level, no parent at all). */
  parentCodeLength: number | null;
  parentFieldLabel?: string;
  addButtonLabel: string;
  emptyMessage: string;
}

/**
 * Shared list+dialog-form for one کدینگ level (گروه/کل/معین) inside the tabbed
 * `AccountCodingPage`. All three levels share one `TB_ACCOUNTCODE` table and one
 * `accountCodesApi` — the only real difference between them is which `accCode.length` bucket
 * they show and, for کل/معین, which length their parent picker is restricted to.
 */
export function AccountCodeLevelTab({
  title,
  description,
  icon,
  codeLength,
  codeLengthHint,
  parentCodeLength,
  parentFieldLabel,
  addButtonLabel,
  emptyMessage,
}: AccountCodeLevelTabProps) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { items, isLoading, isError, error, isTruncated, totalCount } = useAllAccountCodes();

  const [search, setSearch] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [editingRow, setEditingRow] = useState<AccountCodeDto | 'new' | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AccountCodeDto | null>(null);

  const levelRows = useMemo(
    () => items.filter((row) => (row.accCode ?? '').length === codeLength),
    [items, codeLength],
  );

  const filteredRows = useMemo(() => {
    if (!search.trim()) return levelRows;
    const needle = search.trim().toLowerCase();
    return levelRows.filter(
      (row) =>
        (row.accCode ?? '').toLowerCase().includes(needle) ||
        (row.accCodeName ?? '').toLowerCase().includes(needle),
    );
  }, [levelRows, search]);

  const pageRows = filteredRows.slice((pageNumber - 1) * PAGE_SIZE, pageNumber * PAGE_SIZE);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => accountCodesApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['account-codes'] });
      notify('حساب حذف شد.');
      setPendingDelete(null);
    },
    onError: (err) => {
      notify({ message: err instanceof Error ? err.message : 'حذف با خطا مواجه شد.', severity: 'error' });
    },
  });

  const columns: DataTableColumn<AccountCodeDto>[] = [
    { key: 'accCode', header: 'کد', render: (row) => row.accCode ?? '—' },
    { key: 'accCodeName', header: 'عنوان', render: (row) => row.accCodeName ?? '—' },
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
        icon={icon}
        title={title}
        description={description}
        actions={
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => setEditingRow('new')}>
            {addButtonLabel}
          </Button>
        }
      />

      {isTruncated && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          فهرست کامل نیست — تعداد کل کدینگ ({totalCount.toLocaleString('fa-IR')}) از حد نمایش این صفحه بیشتر است.
        </Alert>
      )}

      <Box sx={{ mb: 2, maxWidth: 320 }}>
        <TextField
          fullWidth
          size="small"
          label="جستجو در کد یا عنوان"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPageNumber(1);
          }}
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

      {isError && <ErrorBanner error={error} />}

      {!isError && (
        <>
          <DataTable
            columns={columns}
            rows={pageRows}
            getRowKey={(row) => row.id}
            isLoading={isLoading}
            emptyMessage={emptyMessage}
          />
          {filteredRows.length > 0 && (
            <Pagination
              pageNumber={pageNumber}
              pageSize={PAGE_SIZE}
              totalCount={filteredRows.length}
              onPageChange={setPageNumber}
            />
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف حساب"
        description={pendingDelete ? `آیا از حذف «${pendingDelete.accCode} - ${pendingDelete.accCodeName}» مطمئن هستید؟` : undefined}
        pending={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />

      {editingRow !== null && (
        <AccountCodeLevelFormDialog
          key={editingRow === 'new' ? 'new' : editingRow.id}
          existing={editingRow === 'new' ? null : editingRow}
          icon={icon}
          title={editingRow === 'new' ? addButtonLabel : `ویرایش ${title}`}
          subtitle={editingRow === 'new' ? description : undefined}
          codeLengthHint={codeLengthHint}
          parentCodeLength={parentCodeLength}
          parentFieldLabel={parentFieldLabel}
          allAccountCodes={items}
          onClose={() => setEditingRow(null)}
        />
      )}
    </section>
  );
}

interface AccountCodeLevelFormDialogProps {
  existing: AccountCodeDto | null;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  codeLengthHint: string;
  parentCodeLength: number | null;
  parentFieldLabel?: string;
  allAccountCodes: AccountCodeDto[];
  onClose: () => void;
}

function AccountCodeLevelFormDialog({
  existing,
  icon,
  title,
  subtitle,
  codeLengthHint,
  parentCodeLength,
  parentFieldLabel,
  allAccountCodes,
  onClose,
}: AccountCodeLevelFormDialogProps) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const isEdit = existing !== null;

  const existingParent = existing?.parentId
    ? (allAccountCodes.find((a) => a.id === existing.parentId) ?? null)
    : null;

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AccountCodeFormValues>({
    resolver: zodResolver(accountCodeFormSchema),
    defaultValues: existing
      ? accountCodeDtoToFormValues(
          existing,
          existingParent ? `${existingParent.accCode ?? ''} - ${existingParent.accCodeName ?? ''}` : null,
        )
      : emptyAccountCodeFormValues,
  });

  const createMutation = useMutation({
    mutationFn: (values: AccountCodeFormValues) => accountCodesApi.create(accountCodeFormValuesToPayload(values)),
  });
  const updateMutation = useMutation({
    mutationFn: (values: AccountCodeFormValues) =>
      accountCodesApi.update(existing!.id, accountCodeFormValuesToPayload(values)),
  });
  const pending = isEdit ? updateMutation.isPending : createMutation.isPending;

  async function onSubmit(values: AccountCodeFormValues) {
    setSubmitError(null);
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(values);
      } else {
        await createMutation.mutateAsync(values);
      }
      await queryClient.invalidateQueries({ queryKey: ['account-codes'] });
      notify(isEdit ? 'حساب ویرایش شد.' : 'حساب جدید ذخیره شد.');
      onClose();
    } catch (err) {
      setSubmitError(err);
    }
  }

  function handlePickParent(account: AccountCodeDto) {
    setValue('parentId', account.id, { shouldDirty: true });
    setValue('parentLabel', `${account.accCode ?? ''} - ${account.accCodeName ?? ''}`, { shouldDirty: true });
  }

  const parentLabel = watch('parentLabel');

  const duplicateMessage =
    submitError instanceof ApiError && submitError.status === 409 ? 'کد حساب تکراری است.' : null;

  return (
    <FormDialog
      open
      onClose={onClose}
      icon={icon}
      title={title}
      subtitle={subtitle}
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
      <AccountCodeFormFields
        control={control}
        register={register}
        errors={errors}
        parentLabel={parentLabel ?? null}
        onPickParent={() => setPickerOpen(true)}
        onClearParent={() => {
          setValue('parentId', null, { shouldDirty: true });
          setValue('parentLabel', null, { shouldDirty: true });
        }}
        showParentPicker={parentCodeLength !== null}
        parentFieldLabel={parentFieldLabel}
        codeLengthHint={codeLengthHint}
      />

      <RecordMetaFooter
        createdDate={existing?.createdDate}
        updatedDate={existing?.updatedDate}
        addUserId={existing?.addUserId}
        changeUserId={existing?.changeUserId}
      />

      {parentCodeLength !== null && (
        <AccountCodePickerDialog
          open={pickerOpen}
          title="انتخاب حساب والد"
          excludeId={existing?.id}
          filterRows={(row) => (row.accCode ?? '').length === parentCodeLength}
          onClose={() => setPickerOpen(false)}
          onSelect={handlePickParent}
        />
      )}
    </FormDialog>
  );
}
