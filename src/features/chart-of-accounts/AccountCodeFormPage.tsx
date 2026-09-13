import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import { PageHeader } from '../../components/PageHeader';
import { FormCard } from '../../components/FormCard';
import { FormLoadingSkeleton } from '../../components/FormLoadingSkeleton';
import { RecordMetaFooter } from '../../components/RecordMetaFooter';
import { ErrorBanner } from '../../components/ErrorBanner';
import { AccountCodePickerDialog } from '../../components/AccountCodePickerDialog';
import { ApiError } from '../../lib/api/apiError';
import { accountCodesApi } from './api';
import { AccountCodeFormFields } from './AccountCodeFormFields';
import {
  accountCodeDtoToFormValues,
  accountCodeFormSchema,
  accountCodeFormValuesToPayload,
  emptyAccountCodeFormValues,
  type AccountCodeFormValues,
} from './schema';
import type { AccountCodeDto } from '../../types/accountCode';

/** Handles both `/base/account-codes/new` and `/base/account-codes/:id/edit`. */
export function AccountCodeFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const existingQuery = useQuery({
    queryKey: ['account-codes', id],
    queryFn: () => accountCodesApi.getById(id as string),
    enabled: isEdit,
  });

  const parentId = existingQuery.data?.parentId ?? null;
  const existingParentQuery = useQuery({
    queryKey: ['account-codes', parentId],
    queryFn: () => accountCodesApi.getById(parentId as string),
    enabled: parentId !== null,
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AccountCodeFormValues>({
    resolver: zodResolver(accountCodeFormSchema),
    defaultValues: emptyAccountCodeFormValues,
  });

  useEffect(() => {
    if (!existingQuery.data) return;
    // If this account has a parent, wait for the parent's own row to resolve so the
    // "حساب والد" field can show its label immediately instead of flashing blank.
    if (existingQuery.data.parentId && !existingParentQuery.data) return;
    const parent = existingParentQuery.data;
    const parentLabel = parent ? `${parent.accCode ?? ''} - ${parent.accCodeName ?? ''}` : null;
    reset(accountCodeDtoToFormValues(existingQuery.data, parentLabel));
  }, [existingQuery.data, existingParentQuery.data, reset]);

  const createMutation = useMutation({
    mutationFn: (values: AccountCodeFormValues) => accountCodesApi.create(accountCodeFormValuesToPayload(values)),
  });

  const updateMutation = useMutation({
    mutationFn: (values: AccountCodeFormValues) =>
      accountCodesApi.update(id as string, accountCodeFormValuesToPayload(values)),
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
      navigate('/base/account-codes');
    } catch (error) {
      setSubmitError(error);
    }
  }

  function handlePickParent(account: AccountCodeDto) {
    setValue('parentId', account.id, { shouldDirty: true });
    setValue('parentLabel', `${account.accCode ?? ''} - ${account.accCodeName ?? ''}`, { shouldDirty: true });
  }

  const parentLabel = watch('parentLabel');

  if (isEdit && (existingQuery.isLoading || (parentId !== null && existingParentQuery.isLoading))) {
    return <FormLoadingSkeleton />;
  }

  if (isEdit && existingQuery.isError) {
    return <ErrorBanner error={existingQuery.error} />;
  }

  if (isEdit && !existingQuery.isLoading && existingQuery.data === undefined && !existingQuery.isError) {
    return <ErrorBanner error={new Error('حساب مورد نظر یافت نشد.')} />;
  }

  const duplicateCodeMessage =
    submitError instanceof ApiError && submitError.status === 409 ? 'کد حساب تکراری است.' : null;

  return (
    <section>
      <PageHeader
        eyebrow="اطلاعات پایه"
        icon={<AccountTreeOutlinedIcon />}
        title={isEdit ? 'ویرایش کدینگ حساب' : 'کدینگ حساب جدید'}
        description="اطلاعات حساب را وارد کنید. سطوح تفصیلی این حساب پس از ذخیره، در فرم صدور سند به‌صورت داینامیک نمایش داده می‌شود."
      />

      {duplicateCodeMessage ? (
        <ErrorBanner error={new Error(duplicateCodeMessage)} />
      ) : (
        submitError !== null && <ErrorBanner error={submitError} />
      )}

      <FormCard onSubmit={handleSubmit(onSubmit)} watermarkIcon={<AccountTreeOutlinedIcon />}>
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
        />
        <RecordMetaFooter
          createdDate={existingQuery.data?.createdDate}
          updatedDate={existingQuery.data?.updatedDate}
          addUserId={existingQuery.data?.addUserId}
          changeUserId={existingQuery.data?.changeUserId}
        />
        <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end', mt: 3 }}>
          <Button variant="text" onClick={() => navigate('/base/account-codes')}>
            انصراف
          </Button>
          <Button type="submit" variant="contained" startIcon={<SaveOutlinedIcon />} disabled={pending}>
            {pending ? 'در حال ذخیره...' : 'ذخیره'}
          </Button>
        </Stack>
      </FormCard>

      <AccountCodePickerDialog
        open={pickerOpen}
        title="انتخاب حساب والد"
        excludeId={id}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickParent}
      />
    </section>
  );
}
