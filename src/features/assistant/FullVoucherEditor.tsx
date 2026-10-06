import { useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import MenuItem from '@mui/material/MenuItem';
import { sysTypesApi } from '../../lib/api/sysTypesApi';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import BalanceOutlinedIcon from '@mui/icons-material/BalanceOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import { JalaliDateField } from '../../components/JalaliDateField';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useSession } from '../../lib/session/SessionContext';
import { formatThousands, toPersianDigits } from '../../lib/format/numbers';
import { VoucherLineRow } from '../vouchers/VoucherLineRow';
import { buildVoucherEntrySchema, type ActiveLevelsByRowKey, type VoucherEntryFormSchema } from '../vouchers/voucherEntrySchema';
import { createEmptyVoucherLine } from '../vouchers/voucherFormTypes';
import type { TafsiliLevelDto } from '../../types/tafsili';
import { operationsApi } from './api';
import { applyServerErrors, draftToFormValues, formToComposeInput, lineIndexOf } from './draftMapping';
import type { EngineError, OperationResult, VoucherDraft } from './types';

interface FullVoucherEditorProps {
  seed: VoucherDraft | null;
  /** شرح پیش‌فرض سند دستی (از جملهٔ کاربر). */
  initialDescription?: string;
  sourceTemplateId: string | null;
  clientRequestId: string;
  onExecuted: (result: OperationResult) => void;
  onPreview: (draft: VoucherDraft | null) => void;
  onBack: () => void;
}

/**
 * Every field of a voucher, seeded from the template draft (or blank). The rows are the voucher
 * form's own `VoucherLineRow`, so معین, تفصیلی levels, amounts, شرح and چک behave exactly as there.
 * Unlike that form, saving is ONE request (`compose/execute`): header, rows, تفصیلی and چک are
 * re-validated on the server and written in a single transaction.
 */
export function FullVoucherEditor({ seed, initialDescription, sourceTemplateId, clientRequestId, onExecuted, onPreview, onBack }: FullVoucherEditorProps) {
  const { financialYear } = useSession();
  const activeLevelsRef = useRef<ActiveLevelsByRowKey>({});
  const schema = useMemo(() => buildVoucherEntrySchema(activeLevelsRef), []);
  const form = useForm<VoucherEntryFormSchema>({
    resolver: zodResolver(schema),
    defaultValues: { ...draftToFormValues(seed, financialYear), ...(!seed && initialDescription ? { headDesc: initialDescription.slice(0, 250) } : {}) },
  });
  const { control, register, handleSubmit, formState, getValues } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const lines = useWatch({ control, name: 'lines' });
  const dateDoc = useWatch({ control, name: 'dateDoc' });

  const [serverErrors, setServerErrors] = useState<EngineError[]>([]);
  const [requestError, setRequestError] = useState<unknown>(null);
  const [busy, setBusy] = useState<'check' | 'save' | null>(null);
  const [checkedOk, setCheckedOk] = useState(false);
  const [systemTypeId, setSystemTypeId] = useState<string | null>(seed?.systemTypeId ?? null);
  const sysTypes = useQuery({ queryKey: ['sys-types'], queryFn: () => sysTypesApi.list() });
  /** Rows named by an error that has no field of its own (amount, whole row) are outlined. */
  const erroredRows = useMemo(() => new Set(serverErrors.map(lineIndexOf).filter((i): i is number => i !== null)), [serverErrors]);

  const totals = useMemo(() => {
    const debit = (lines ?? []).reduce((s, l) => s + Number(l.debtor || 0), 0);
    const credit = (lines ?? []).reduce((s, l) => s + Number(l.creditor || 0), 0);
    return { debit, credit, diff: debit - credit };
  }, [lines]);

  const yearMismatch = !!dateDoc && !!financialYear && dateDoc.slice(0, 4) !== financialYear;

  function onActiveLevelsChange(rowKey: string, levels: TafsiliLevelDto[]) {
    activeLevelsRef.current = { ...activeLevelsRef.current, [rowKey]: levels };
  }

  /** The «balance it» helper: one new row on the short side for exactly the difference. */
  function addBalancingLine() {
    const line = createEmptyVoucherLine();
    if (totals.diff > 0) line.creditor = String(totals.diff);
    else line.debtor = String(-totals.diff);
    append(line);
  }

  function handleResult(result: OperationResult, saving: boolean) {
    if (result.success) {
      setServerErrors([]);
      if (saving) onExecuted(result);
      else {
        setCheckedOk(true);
        onPreview(result.draft);
      }
      return;
    }
    setCheckedOk(false);
    onPreview(null);
    setServerErrors(applyServerErrors(form, result.errors));
  }

  async function run(mode: 'check' | 'save', values: VoucherEntryFormSchema) {
    setBusy(mode);
    setRequestError(null);
    try {
      const input = formToComposeInput(values, systemTypeId);
      const result = mode === 'save'
        ? await operationsApi.composeExecute({ ...input, sourceTemplateId, clientRequestId }, financialYear)
        : await operationsApi.composePreview(input, financialYear);
      handleResult(result, mode === 'save');
    } catch (error) {
      setRequestError(error);
    } finally {
      setBusy(null);
    }
  }

  function scrollToLine(index: number | null) {
    const key = index !== null ? getValues(`lines.${index}.key`) : null;
    if (key) document.getElementById(`voucher-line-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <Box component="form" noValidate onSubmit={handleSubmit((v) => run('save', v))}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
        <Button color="inherit" startIcon={<ArrowForwardOutlinedIcon />} onClick={onBack}>بازگشت به گفتگو</Button>
        <Box sx={{ flex: 1 }} />
        {seed && <Chip size="small" variant="outlined" label={`از الگو: ${seed.sourceTemplateCode}`} />}
      </Stack>

      {/* ── سرآیند ── */}
      <Paper variant="outlined" sx={{ p: 2.5, mb: 2.5, borderRadius: 3 }}>
        <Typography variant="h2" component="h2" sx={{ mb: 2 }}>سرآیند سند</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <Controller
              control={control}
              name="dateDoc"
              render={({ field, fieldState }) => (
                <JalaliDateField
                  label="تاریخ سند"
                  required
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v);
                    form.setValue('year', v.slice(0, 4));
                  }}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message ?? (yearMismatch ? `خارج از سال مالی جاری (${toPersianDigits(financialYear)})` : undefined)}
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 2 }}>
            <TextField label="شماره سند" value="خودکار هنگام ثبت" disabled fullWidth />
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 2 }}>
            <TextField select label="نوع سند" fullWidth value={systemTypeId ?? ''} onChange={(e) => setSystemTypeId(e.target.value || null)}
              slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
              <MenuItem value=""><em>بدون نوع</em></MenuItem>
              {(sysTypes.data ?? []).map((t) => (
                <MenuItem key={t.id} value={t.id}>{t.sysName ?? t.sysCode}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <TextField
              label="شرح سند"
              fullWidth
              {...register('headDesc')}
              error={!!formState.errors.headDesc}
              helperText={formState.errors.headDesc?.message ?? 'شرح ردیف‌های بی‌شرح هم همین می‌شود.'}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label="پیوست"
              fullWidth
              multiline
              minRows={2}
              {...register('apendix')}
              error={!!formState.errors.apendix}
              helperText={formState.errors.apendix?.message}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* ── ردیف‌ها ── */}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h2" component="h2" sx={{ flex: 1 }}>ردیف‌های سند</Typography>
        <Button variant="outlined" color="secondary" startIcon={<AddCircleOutlineIcon />} onClick={() => append(createEmptyVoucherLine())}>
          افزودن ردیف
        </Button>
      </Stack>

      {formState.errors.lines?.message && <ErrorBanner error={new Error(formState.errors.lines.message)} />}

      {serverErrors.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>این موارد باید درست شوند</AlertTitle>
          {serverErrors.map((e, i) => {
            const index = lineIndexOf(e);
            return (
              <Box key={i}>
                {index !== null ? (
                  <Link component="button" type="button" onClick={() => scrollToLine(index)} sx={{ textAlign: 'start' }}>{e.message}</Link>
                ) : (
                  e.message
                )}
              </Box>
            );
          })}
        </Alert>
      )}

      {fields.map((field, index) => (
        <VoucherLineRow
          key={field.id}
          form={form}
          index={index}
          rowKey={field.key}
          canRemove={fields.length > 1}
          onRemove={() => remove(index)}
          onActiveLevelsChange={onActiveLevelsChange}
          highlighted={erroredRows.has(index)}
        />
      ))}

      {/* ── جمع و ثبت ── */}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, position: 'sticky', bottom: 12, zIndex: 2, bgcolor: 'background.paper' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' } }}>
          <Stack direction="row" spacing={3}>
            <Total label="جمع بدهکار" value={totals.debit} />
            <Total label="جمع بستانکار" value={totals.credit} />
            <Total label="اختلاف" value={Math.abs(totals.diff)} color={totals.diff === 0 ? 'success.main' : 'error.main'} />
          </Stack>
          {totals.diff !== 0 && (
            <Button size="small" startIcon={<BalanceOutlinedIcon />} onClick={addBalancingLine}>
              افزودن ردیف تراز‌کننده ({totals.diff > 0 ? 'بستانکار' : 'بدهکار'})
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          {checkedOk && <Chip color="success" variant="outlined" label="سرور سند را تأیید کرد" />}
          <Button
            variant="outlined"
            startIcon={<FactCheckOutlinedIcon />}
            disabled={busy !== null}
            onClick={handleSubmit((v) => run('check', v))}
          >
            {busy === 'check' ? 'در حال بررسی…' : 'بررسی سند'}
          </Button>
          <Button type="submit" variant="contained" disabled={busy !== null}>
            {busy === 'save' ? 'در حال ثبت…' : 'ثبت سند (موقت)'}
          </Button>
        </Stack>
        {requestError != null && <Box sx={{ mt: 1.5 }}><ErrorBanner error={requestError} /></Box>}
      </Paper>
    </Box>
  );
}

function Total({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{label}</Typography>
      <Typography sx={{ fontWeight: 700, color }}>{formatThousands(value)}</Typography>
    </Box>
  );
}
