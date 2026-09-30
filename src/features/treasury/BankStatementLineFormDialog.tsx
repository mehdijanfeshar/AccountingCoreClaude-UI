import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import PlaylistAddOutlinedIcon from '@mui/icons-material/PlaylistAddOutlined';
import { FormDialog } from '../../components/FormDialog';
import { AmountField } from '../../components/AmountField';
import { JalaliDateField } from '../../components/JalaliDateField';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { bankStatementsApi } from './api';
import {
  bankStatementLineFormSchema,
  bankStatementLineDtoToFormValues,
  bankStatementLineFormValuesToPayload,
  buildEmptyBankStatementLineFormValues,
  type BankStatementLineFormValues,
} from './schema';
import type { BankStatementLineDto } from '../../types/treasury';

interface BankStatementLineFormDialogProps {
  open: boolean;
  onClose: () => void;
  statementId: string;
  /** `null` = افزودن ردیف جدید؛ در غیر این صورت ویرایش همین ردیف. */
  line: BankStatementLineDto | null;
}

/** افزودن/ویرایش دستی یک ردیف صورت‌حساب — خزانه‌داری بخش ۴-د. فقط در وضعیت باز فراخوانی می‌شود. */
export function BankStatementLineFormDialog({ open, onClose, statementId, line }: BankStatementLineFormDialogProps) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const isEdit = line !== null;

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BankStatementLineFormValues>({
    resolver: zodResolver(bankStatementLineFormSchema),
    defaultValues: buildEmptyBankStatementLineFormValues(''),
  });

  useEffect(() => {
    if (!open) return;
    reset(line ? bankStatementLineDtoToFormValues(line) : buildEmptyBankStatementLineFormValues(''));
  }, [open, line, reset]);

  const saveMutation = useMutation({
    mutationFn: (values: BankStatementLineFormValues) => {
      const payload = bankStatementLineFormValuesToPayload(values);
      return isEdit ? bankStatementsApi.updateLine(statementId, line!.id, payload) : bankStatementsApi.addLine(statementId, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['treasury-bank-statements', statementId] });
      notify(isEdit ? 'ردیف ویرایش شد.' : 'ردیف افزوده شد.');
      onClose();
    },
  });

  function onSubmit(values: BankStatementLineFormValues) {
    saveMutation.mutate(values);
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'ویرایش ردیف صورت‌حساب' : 'افزودن ردیف صورت‌حساب'}
      subtitle="دقیقاً یکی از برداشت یا واریز باید مقدار داشته باشد."
      icon={<PlaylistAddOutlinedIcon />}
      accentColor="secondary"
      maxWidth="sm"
      onSubmit={handleSubmit(onSubmit)}
      actions={
        <>
          <Button onClick={onClose} disabled={saveMutation.isPending}>
            انصراف
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={saveMutation.isPending}
            startIcon={saveMutation.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {saveMutation.isPending ? 'در حال ذخیره…' : 'ذخیره'}
          </Button>
        </>
      }
    >
      {saveMutation.isError && <ErrorBanner error={saveMutation.error} />}
      <Grid container spacing={2}>
        <Grid size={12}>
          <Controller
            control={control}
            name="lineDate"
            render={({ field }) => (
              <JalaliDateField
                label="تاریخ"
                required
                value={field.value}
                onChange={field.onChange}
                error={!!errors.lineDate}
                helperText={errors.lineDate?.message}
              />
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <AmountField control={control} name="withdrawal" label="برداشت (ریال)" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <AmountField control={control} name="deposit" label="واریز (ریال)" />
        </Grid>
        {(errors.withdrawal?.message || errors.deposit?.message) && (
          <Grid size={12}>
            <ErrorBanner error={new Error(errors.withdrawal?.message ?? errors.deposit?.message ?? '')} />
          </Grid>
        )}
        <Grid size={12}>
          <AmountField control={control} name="balance" label="مانده (اختیاری، ریال)" />
        </Grid>
        <Grid size={12}>
          <TextField
            {...register('bankReference')}
            label="مرجع بانک (اختیاری)"
            fullWidth
            slotProps={{ htmlInput: { maxLength: 100 } }}
            error={!!errors.bankReference}
            helperText={errors.bankReference?.message}
          />
        </Grid>
        <Grid size={12}>
          <TextField
            {...register('description')}
            label="شرح (اختیاری)"
            fullWidth
            multiline
            minRows={2}
            slotProps={{ htmlInput: { maxLength: 500 } }}
            error={!!errors.description}
            helperText={errors.description?.message}
          />
        </Grid>
      </Grid>
    </FormDialog>
  );
}
