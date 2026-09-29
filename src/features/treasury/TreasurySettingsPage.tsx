import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import SettingsSuggestOutlinedIcon from '@mui/icons-material/SettingsSuggestOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import HealthAndSafetyOutlinedIcon from '@mui/icons-material/HealthAndSafetyOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import { PageHeader } from '../../components/PageHeader';
import { FormCard } from '../../components/FormCard';
import { FormActions } from '../../components/FormActions';
import { FormSectionLabel } from '../../components/FormSectionLabel';
import { ErrorBanner } from '../../components/ErrorBanner';
import { AmountField } from '../../components/AmountField';
import { LinkedEntityPickerField } from '../../components/LinkedEntityPickerField';
import { AccountCodePickerDialog } from '../../components/AccountCodePickerDialog';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { ApiError } from '../../lib/api/apiError';
import { treasurySettingsApi } from './api';
import { tafsilGroupsApi } from '../tafsil-groups/api';
import {
  buildEmptyTreasurySettingFormValues,
  treasurySettingFormSchema,
  type TreasurySettingFormValues,
} from './schema';
import type { AccountCodeDto } from '../../types/accountCode';

function accountCodeLabel(account: { accCode: string | null; accCodeName: string | null }): string {
  return `${account.accCode ? `${account.accCode} — ` : ''}${account.accCodeName ?? '—'}`;
}

type AccountPickerField = 'payablesAccountId' | 'vatCreditAccountId' | 'insurancePayableAccountId' | 'receivablesAccountId';

/**
 * تنظیمات خزانه (`TB_TR_SETTING`) — خزانه‌داری بخش ۴-الف. `GET` می‌تواند ۴۰۴ بدهد اگر مدیر مالی
 * هنوز تعریف نکرده — فرم برای همان حالت هم خالی و قابل‌ذخیره باز است. ذخیره فقط برای نقش
 * FinanceManager همان واحد مجاز است؛ خطای واقعی سرور (۴۰۳) همان‌طور که هست نمایش داده می‌شود.
 */
export function TreasurySettingsPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();

  const settingQuery = useQuery({
    queryKey: ['treasury-settings'],
    queryFn: () => treasurySettingsApi.get(),
    retry: (failureCount, error) => !(error instanceof ApiError && error.isNotFound) && failureCount < 2,
  });

  const notDefinedYet = settingQuery.isError && settingQuery.error instanceof ApiError && settingQuery.error.isNotFound;

  // بدون جست‌وجوی سرچشمه‌ای — تعداد گروه‌های تفصیلی کوچک است، هم‌الگوی
  // `AccountTafsilGroupLinksTab` (صفحهٔ اول با اندازهٔ بزرگ).
  const tafsilGroupsQuery = useQuery({
    queryKey: ['tafsil-groups-lookup'],
    queryFn: () => tafsilGroupsApi.list({ pageNumber: 1, pageSize: 200 }),
  });
  const tafsilGroupOptions = tafsilGroupsQuery.data?.items ?? [];

  const [accountPickerField, setAccountPickerField] = useState<AccountPickerField | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
  } = useForm<TreasurySettingFormValues>({
    resolver: zodResolver(treasurySettingFormSchema),
    defaultValues: buildEmptyTreasurySettingFormValues(),
  });

  useEffect(() => {
    if (settingQuery.data) {
      reset({
        ceoApprovalThreshold: String(settingQuery.data.ceoApprovalThreshold),
        bulkApproveLimit: String(settingQuery.data.bulkApproveLimit),
        beneficiaryTafsilGroupId: settingQuery.data.beneficiaryTafsilGroupId,
        payablesAccountId: settingQuery.data.payablesAccountId,
        payablesAccountLabel:
          settingQuery.data.payablesAccountId != null
            ? accountCodeLabel({
                accCode: settingQuery.data.payablesAccountCode,
                accCodeName: settingQuery.data.payablesAccountName,
              })
            : null,
        vatCreditAccountId: settingQuery.data.vatCreditAccountId,
        vatCreditAccountLabel:
          settingQuery.data.vatCreditAccountId != null
            ? accountCodeLabel({
                accCode: settingQuery.data.vatCreditAccountCode,
                accCodeName: settingQuery.data.vatCreditAccountName,
              })
            : null,
        insurancePayableAccountId: settingQuery.data.insurancePayableAccountId,
        insurancePayableAccountLabel:
          settingQuery.data.insurancePayableAccountId != null
            ? accountCodeLabel({
                accCode: settingQuery.data.insurancePayableAccountCode,
                accCodeName: settingQuery.data.insurancePayableAccountName,
              })
            : null,
        receivablesAccountId: settingQuery.data.receivablesAccountId,
        receivablesAccountLabel:
          settingQuery.data.receivablesAccountId != null
            ? accountCodeLabel({
                accCode: settingQuery.data.receivablesAccountCode,
                accCodeName: settingQuery.data.receivablesAccountName,
              })
            : null,
        customerTafsilGroupId: settingQuery.data.customerTafsilGroupId,
        dailyTransferLimit: settingQuery.data.dailyTransferLimit != null ? String(settingQuery.data.dailyTransferLimit) : '',
      });
    }
  }, [settingQuery.data, reset]);

  const payablesAccountLabel = watch('payablesAccountLabel');
  const vatCreditAccountLabel = watch('vatCreditAccountLabel');
  const insurancePayableAccountLabel = watch('insurancePayableAccountLabel');
  const receivablesAccountLabel = watch('receivablesAccountLabel');

  function handlePickAccount(account: AccountCodeDto) {
    if (!accountPickerField) return;
    setValue(accountPickerField, account.id, { shouldDirty: true });
    const labelField = `${accountPickerField.replace(/Id$/, '')}Label` as
      | 'payablesAccountLabel'
      | 'vatCreditAccountLabel'
      | 'insurancePayableAccountLabel'
      | 'receivablesAccountLabel';
    setValue(labelField, accountCodeLabel(account), { shouldDirty: true });
    setAccountPickerField(null);
  }

  const saveMutation = useMutation({
    mutationFn: (values: TreasurySettingFormValues) =>
      treasurySettingsApi.upsert({
        ceoApprovalThreshold: Number(values.ceoApprovalThreshold || 0),
        bulkApproveLimit: Number(values.bulkApproveLimit || 0),
        beneficiaryTafsilGroupId: values.beneficiaryTafsilGroupId ?? null,
        payablesAccountId: values.payablesAccountId ?? null,
        vatCreditAccountId: values.vatCreditAccountId ?? null,
        insurancePayableAccountId: values.insurancePayableAccountId ?? null,
        receivablesAccountId: values.receivablesAccountId ?? null,
        customerTafsilGroupId: values.customerTafsilGroupId ?? null,
        dailyTransferLimit: values.dailyTransferLimit ? Number(values.dailyTransferLimit) : null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['treasury-settings'] });
      notify('تنظیمات خزانه ذخیره شد.');
    },
  });

  function onSubmit(values: TreasurySettingFormValues) {
    saveMutation.mutate(values);
  }

  return (
    <section>
      <PageHeader
        eyebrow="تنخواه و خزانه‌داری"
        icon={<SettingsSuggestOutlinedIcon />}
        accentColor="secondary"
        title="تنظیمات خزانه"
        description="آستانهٔ تأیید مدیرعامل و سقف تأیید گروهی — فقط نقش مدیر مالی می‌تواند ذخیره کند."
      />

      {settingQuery.isError && !notDefinedYet && <ErrorBanner error={settingQuery.error} />}
      {notDefinedYet && (
        <Alert severity="info" sx={{ mb: 2 }}>
          تنظیمات خزانهٔ این واحد هنوز تعریف نشده است — مقادیر زیر را وارد و ذخیره کنید.
        </Alert>
      )}
      {saveMutation.isError && <ErrorBanner error={saveMutation.error} />}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <FormCard accentColor="secondary" watermarkIcon={<SettingsSuggestOutlinedIcon />} onSubmit={handleSubmit(onSubmit)}>
            <Grid container spacing={3}>
              <Grid size={12}>
                <FormSectionLabel label="آستانه‌ها" accentColor="secondary" />
              </Grid>
              <Grid size={12}>
                <AmountField
                  control={control}
                  name="ceoApprovalThreshold"
                  label="آستانهٔ تأیید مدیرعامل (ریال)"
                  required
                  helperText="درخواست پرداختی با مبلغ خالص بالاتر از این آستانه، به تأیید مدیرعامل هم نیاز دارد."
                />
              </Grid>
              <Grid size={12}>
                <AmountField
                  control={control}
                  name="bulkApproveLimit"
                  label="سقف تأیید گروهی (ریال)"
                  required
                  helperText="فقط درخواست‌های زیر این سقف در «تأیید گروهی» کارتابل قابل‌انتخاب‌اند."
                />
              </Grid>

              <Grid size={12}>
                <FormSectionLabel label="تفصیلی ذی‌نفع" accentColor="secondary" />
              </Grid>
              <Grid size={12}>
                <Controller
                  control={control}
                  name="beneficiaryTafsilGroupId"
                  render={({ field }) => (
                    <Autocomplete
                      options={tafsilGroupOptions}
                      loading={tafsilGroupsQuery.isLoading}
                      getOptionLabel={(option) => `${option.tafsilGroupCode ?? ''} - ${option.tafsilGroupName ?? ''}`}
                      isOptionEqualToValue={(option, current) => option.id === current.id}
                      value={tafsilGroupOptions.find((g) => g.id === field.value) ?? null}
                      onChange={(_event, selected) => field.onChange(selected?.id ?? null)}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="گروه تفصیلی ذی‌نفع (اختیاری)"
                          helperText="فقط تفصیلی‌های عضو این گروه در فرم درخواست پرداخت به‌عنوان «تفصیلی ذی‌نفع» قابل‌انتخاب‌اند."
                          slotProps={{
                            ...params.slotProps,
                            input: {
                              ...params.slotProps.input,
                              startAdornment: (
                                <InputAdornment position="start">
                                  <CategoryOutlinedIcon fontSize="small" color="action" />
                                </InputAdornment>
                              ),
                            },
                          }}
                        />
                      )}
                    />
                  )}
                />
              </Grid>

              <Grid size={12}>
                <FormSectionLabel
                  label="حساب‌های حسابداری خودکار"
                  accentColor="secondary"
                  caption="بخش ۴-ب — بدون این سه حساب، صدور سند «شناسایی بدهی» هنگام تأیید نهایی درخواست پرداخت با خطا رد می‌شود."
                />
              </Grid>
              <LinkedEntityPickerField
                icon={<ReceiptLongOutlinedIcon fontSize="small" color="action" />}
                label="حساب بستانکاران تجاری (اختیاری)"
                value={payablesAccountLabel}
                onPick={() => setAccountPickerField('payablesAccountId')}
                onClear={() => {
                  setValue('payablesAccountId', null, { shouldDirty: true });
                  setValue('payablesAccountLabel', null, { shouldDirty: true });
                }}
              />
              <LinkedEntityPickerField
                icon={<AccountBalanceOutlinedIcon fontSize="small" color="action" />}
                label="حساب اعتبار مالیات بر ارزش‌افزودهٔ خرید (اختیاری)"
                value={vatCreditAccountLabel}
                onPick={() => setAccountPickerField('vatCreditAccountId')}
                onClear={() => {
                  setValue('vatCreditAccountId', null, { shouldDirty: true });
                  setValue('vatCreditAccountLabel', null, { shouldDirty: true });
                }}
              />
              <LinkedEntityPickerField
                icon={<HealthAndSafetyOutlinedIcon fontSize="small" color="action" />}
                label="حساب سپرده بیمه پرداختنی (اختیاری)"
                value={insurancePayableAccountLabel}
                onPick={() => setAccountPickerField('insurancePayableAccountId')}
                onClear={() => {
                  setValue('insurancePayableAccountId', null, { shouldDirty: true });
                  setValue('insurancePayableAccountLabel', null, { shouldDirty: true });
                }}
              />

              <Grid size={12}>
                <FormSectionLabel
                  label="دریافت و انتقال وجه"
                  accentColor="secondary"
                  caption="بخش ۴-ج — بدون «حساب دریافتنی»/«گروه تفصیلی مشتریان»، ثبت دریافت وجه با خطا رد می‌شود؛ بدون «سقف انتقال روزانه»، تأیید انتقال وجه با خطا رد می‌شود."
                />
              </Grid>
              <LinkedEntityPickerField
                icon={<ReceiptLongOutlinedIcon fontSize="small" color="action" />}
                label="حساب دریافتنی (اختیاری)"
                value={receivablesAccountLabel}
                onPick={() => setAccountPickerField('receivablesAccountId')}
                onClear={() => {
                  setValue('receivablesAccountId', null, { shouldDirty: true });
                  setValue('receivablesAccountLabel', null, { shouldDirty: true });
                }}
              />
              <Grid size={12}>
                <Controller
                  control={control}
                  name="customerTafsilGroupId"
                  render={({ field }) => (
                    <Autocomplete
                      options={tafsilGroupOptions}
                      loading={tafsilGroupsQuery.isLoading}
                      getOptionLabel={(option) => `${option.tafsilGroupCode ?? ''} - ${option.tafsilGroupName ?? ''}`}
                      isOptionEqualToValue={(option, current) => option.id === current.id}
                      value={tafsilGroupOptions.find((g) => g.id === field.value) ?? null}
                      onChange={(_event, selected) => field.onChange(selected?.id ?? null)}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="گروه تفصیلی مشتریان (اختیاری)"
                          helperText="فقط تفصیلی‌های عضو این گروه در فرم دریافت وجه به‌عنوان «پرداخت‌کننده» قابل‌انتخاب‌اند."
                          slotProps={{
                            ...params.slotProps,
                            input: {
                              ...params.slotProps.input,
                              startAdornment: (
                                <InputAdornment position="start">
                                  <PeopleAltOutlinedIcon fontSize="small" color="action" />
                                </InputAdornment>
                              ),
                            },
                          }}
                        />
                      )}
                    />
                  )}
                />
              </Grid>
              <Grid size={12}>
                <AmountField
                  control={control}
                  name="dailyTransferLimit"
                  label="سقف انتقال روزانه (ریال، اختیاری)"
                  helperText="سقف مجموع انتقال‌های اجراشده از یک حساب مبدأ در یک روز."
                />
              </Grid>

              <Grid size={12}>
                <FormActions onCancel={() => reset()} pending={saveMutation.isPending} submitLabel="ذخیره تنظیمات" />
              </Grid>
            </Grid>
          </FormCard>
        </Grid>
      </Grid>

      <AccountCodePickerDialog
        open={accountPickerField !== null}
        onClose={() => setAccountPickerField(null)}
        onSelect={handlePickAccount}
      />
    </section>
  );
}
