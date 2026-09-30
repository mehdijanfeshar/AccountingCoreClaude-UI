import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import DateObject from 'react-date-object';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import { FormDialog } from '../../components/FormDialog';
import { AmountField } from '../../components/AmountField';
import { JalaliDateField } from '../../components/JalaliDateField';
import { LinkedEntityPickerField } from '../../components/LinkedEntityPickerField';
import { BankAccountPickerDialog } from '../../components/BankAccountPickerDialog';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { useSession } from '../../lib/session/SessionContext';
import { toLatinDigits } from '../../lib/format/numbers';
import { bankStatementsApi } from './api';
import { bankStatementFormSchema, buildEmptyBankStatementFormValues, bankStatementFormValuesToPayload, type BankStatementFormValues } from './schema';
import type { BankAccountDto } from '../../types/bankAccount';

function bankAccountLabel(account: { accountNumber: string | null; accountHolder: string | null }): string {
  return `${account.accountNumber ?? ''} — ${account.accountHolder ?? ''}`;
}

function todayLegacyJalali(): string {
  return toLatinDigits(new DateObject({ calendar: persian, locale: persian_fa }).format('YYYYMMDD'));
}

interface NewBankStatementDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * «صورت‌حساب جدید» — خزانه‌داری بخش ۴-د. حساب بانکی + بازهٔ تاریخ + مانده پایانی طبق بانک +
 * توضیح. پس از ایجاد به صفحهٔ جزئیات (که ورود دستی ردیف‌ها/تطبیق در آن انجام می‌شود) هدایت می‌کند.
 */
export function NewBankStatementDialog({ open, onClose }: NewBankStatementDialogProps) {
  const navigate = useNavigate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { financialYear } = useSession();
  const [pickerOpen, setPickerOpen] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BankStatementFormValues>({
    resolver: zodResolver(bankStatementFormSchema),
    defaultValues: buildEmptyBankStatementFormValues(),
  });

  useEffect(() => {
    if (open) reset({ ...buildEmptyBankStatementFormValues(), toDate: todayLegacyJalali() });
  }, [open, reset]);

  const bankAccountLabelValue = watch('bankAccountLabel');

  const createMutation = useMutation({
    mutationFn: (values: BankStatementFormValues) =>
      bankStatementsApi.create({ ...bankStatementFormValuesToPayload(values), year: financialYear || '' }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['treasury-bank-statements'] });
      notify('صورت‌حساب بانکی ایجاد شد.');
      onClose();
      navigate(`/treasury/khazaneh/bank-reconciliation/${result.id}`);
    },
  });

  function onSubmit(values: BankStatementFormValues) {
    createMutation.mutate(values);
  }

  return (
    <>
      <FormDialog
        open={open}
        onClose={onClose}
        title="صورت‌حساب جدید"
        subtitle="حساب بانکی، بازهٔ تاریخ و مانده پایانی طبق بانک را وارد کنید — ردیف‌ها بعداً در صفحهٔ جزئیات افزوده می‌شوند."
        icon={<RuleOutlinedIcon />}
        accentColor="secondary"
        onSubmit={handleSubmit(onSubmit)}
        actions={
          <>
            <Button onClick={onClose} disabled={createMutation.isPending}>
              انصراف
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={createMutation.isPending}
              startIcon={createMutation.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {createMutation.isPending ? 'در حال ایجاد…' : 'ایجاد'}
            </Button>
          </>
        }
      >
        {createMutation.isError && <ErrorBanner error={createMutation.error} />}
        <Grid container spacing={2}>
          <LinkedEntityPickerField
            icon={<AccountBalanceOutlinedIcon fontSize="small" color="action" />}
            label="حساب بانکی"
            value={bankAccountLabelValue}
            required
            error={!!errors.bankAccountId}
            helperText={errors.bankAccountId?.message}
            onPick={() => setPickerOpen(true)}
          />
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              control={control}
              name="fromDate"
              render={({ field }) => (
                <JalaliDateField
                  label="از تاریخ"
                  required
                  value={field.value}
                  onChange={field.onChange}
                  error={!!errors.fromDate}
                  helperText={errors.fromDate?.message}
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              control={control}
              name="toDate"
              render={({ field }) => (
                <JalaliDateField
                  label="تا تاریخ"
                  required
                  value={field.value}
                  onChange={field.onChange}
                  error={!!errors.toDate}
                  helperText={errors.toDate?.message}
                />
              )}
            />
          </Grid>
          <Grid size={12}>
            <AmountField control={control} name="closingBalance" label="مانده پایانی طبق بانک (ریال)" required />
          </Grid>
          <Grid size={12}>
            <TextField
              {...register('description')}
              label="توضیح (اختیاری)"
              fullWidth
              multiline
              minRows={2}
              slotProps={{
                htmlInput: { maxLength: 1000 },
                input: { startAdornment: <DescriptionOutlinedIcon fontSize="small" color="action" sx={{ mr: 1 }} /> },
              }}
              error={!!errors.description}
              helperText={errors.description?.message}
            />
          </Grid>
        </Grid>
      </FormDialog>

      <BankAccountPickerDialog
        open={pickerOpen}
        title="انتخاب حساب بانکی"
        onClose={() => setPickerOpen(false)}
        onSelect={(account: BankAccountDto) => {
          setValue('bankAccountId', account.id, { shouldDirty: true, shouldValidate: true });
          setValue('bankAccountLabel', bankAccountLabel(account), { shouldDirty: true });
          setPickerOpen(false);
        }}
      />
    </>
  );
}
