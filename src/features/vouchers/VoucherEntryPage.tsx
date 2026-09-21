import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import DatePicker from 'react-multi-date-picker';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import PostAddOutlinedIcon from '@mui/icons-material/PostAddOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FormatListNumberedOutlinedIcon from '@mui/icons-material/FormatListNumberedOutlined';
import TrendingDownOutlinedIcon from '@mui/icons-material/TrendingDownOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import BalanceOutlinedIcon from '@mui/icons-material/BalanceOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined';
import { FormActions } from '../../components/FormActions';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { useSession } from '../../lib/session/SessionContext';
import { formatThousands, toLatinDigits } from '../../lib/format/numbers';
import { VoucherLineRow } from './VoucherLineRow';
import { buildVoucherEntrySchema, type ActiveLevelsByRowKey, type VoucherEntryFormSchema } from './voucherEntrySchema';
import { createEmptyVoucherLine, type VoucherLineFormValue } from './voucherFormTypes';
import { reconcileLines, toFormValues, type DetailIdByRowKey } from './voucherEdit';
import { useAllAccountCodes } from '../chart-of-accounts/useAllAccountCodes';
import { voucherDetailsApi, voucherHeadsApi, type CreateVoucherDetailPayload, type CreateVoucherHeadPayload } from './api';
import type { TafsiliLevelDto } from '../../types/tafsili';

type LineSubmissionState = 'idle' | 'pending' | 'success' | 'error';

/**
 * Voucher entry form with dynamic تفصیلی fields (phase 22-b). Layout adapted from the old
 * Angular `add-voucher` page (header chips/fields, per-line تفصیلی 1-3 inline + 4+ modal,
 * totals footer) — see the completion report for exactly which patterns were kept vs.
 * dropped.
 *
 * ⚠️ Save flow is deliberately TWO STEPS, NOT atomic (see `onSubmit`): the real
 * `CreateVoucherHeadCommand.InitialDetails` shape has no `tafsiliLinks` field, so this form
 * never uses it — it always creates the head first, then each line individually via
 * `POST /api/voucher-details` (the only endpoint that accepts `tafsiliLinks`). If the head
 * succeeds but a line fails, the head is NOT rolled back (the backend has no endpoint for
 * that) — this is flagged as an open decision for the project owner in the completion
 * report, and handled here by keeping the created head id around so retrying only re-submits
 * the lines that actually failed, never a duplicate head.
 *
 * ⚠️ Debit/credit balance is shown for information only and never blocks submission — the
 * "Legacy fully replaces the rich model" architecture decision (CLAUDE.md) deliberately
 * discarded the debit==credit invariant; inventing a client-side block here would be exactly
 * the "Business Rule حسابداری فقط در UI" this role is forbidden from doing.
 */
export function VoucherEntryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { financialYear } = useSession();

  const activeLevelsRef = useRef<ActiveLevelsByRowKey>({});
  const schema = useMemo(() => buildVoucherEntrySchema(activeLevelsRef), []);

  const form = useForm<VoucherEntryFormSchema>({
    resolver: zodResolver(schema),
    defaultValues: {
      docNum: '',
      dateDoc: '',
      year: financialYear || '',
      headDesc: '',
      apendix: '',
      lines: [createEmptyVoucherLine()],
    },
  });
  const { control, register, handleSubmit, formState } = form;

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const watchedLines = useWatch({ control, name: 'lines' });

  // Edit mode is this same form with a voucher already in it. A second page would mean a second
  // copy of the تفصیلی row logic, which is the most intricate part of this feature and the last
  // thing worth duplicating.
  const { id: editingId } = useParams<{ id: string }>();
  const isEditing = Boolean(editingId);
  const [detailIds, setDetailIds] = useState<DetailIdByRowKey>({});

  const { items: accountCodes } = useAllAccountCodes();

  const existingVoucher = useQuery({
    queryKey: ['voucher-heads', editingId, 'with-lines'],
    queryFn: async () => {
      const head = await voucherHeadsApi.getById(editingId as string);
      // 200 lines is far past any real voucher; the alternative is paging a form, which would let
      // a save silently drop the lines the user never scrolled to.
      const lines = await voucherDetailsApi.list({
        pageNumber: 1,
        pageSize: 200,
        voucherHeadId: editingId,
      });
      return { head, lines: lines.items };
    },
    enabled: isEditing,
  });

  // Reset once, when the voucher arrives. Re-running on every render would fight the user for
  // control of the fields they are typing in.
  useEffect(() => {
    if (!existingVoucher.data) return;

    const loaded = toFormValues(
      existingVoucher.data.head,
      existingVoucher.data.lines,
      (accountId) => {
        const account = accountCodes?.find((candidate) => candidate.id === accountId);
        return account ? `${account.accCode ?? ''} - ${account.accCodeName ?? ''}` : '';
      },
    );

    form.reset(loaded.values);
    setDetailIds(loaded.detailIds);
  }, [existingVoucher.data, accountCodes, form]);

  const [createdHeadId, setCreatedHeadId] = useState<string | null>(null);
  const [lineStatus, setLineStatus] = useState<Record<string, LineSubmissionState>>({});
  const [lineErrorMessages, setLineErrorMessages] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<unknown>(null);
  const [highlightedRowKey, setHighlightedRowKey] = useState<string | null>(null);

  const createHeadMutation = useMutation({
    mutationFn: (payload: CreateVoucherHeadPayload) => voucherHeadsApi.create(payload),
  });

  function handleActiveLevelsChange(rowKey: string, levels: TafsiliLevelDto[]) {
    activeLevelsRef.current = { ...activeLevelsRef.current, [rowKey]: levels };
  }

  function handleEditRow(rowKey: string) {
    setHighlightedRowKey(rowKey);
    document.getElementById(`voucher-line-${rowKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => setHighlightedRowKey((current) => (current === rowKey ? null : current)), 1600);
  }

  function handleRemoveRowByKey(rowKey: string) {
    const index = fields.findIndex((f) => f.key === rowKey);
    if (index === -1) return;
    remove(index);
    setLineStatus((prev) => {
      const next = { ...prev };
      delete next[rowKey];
      return next;
    });
    setLineErrorMessages((prev) => {
      const next = { ...prev };
      delete next[rowKey];
      return next;
    });
  }

  function buildDetailPayload(headId: string, line: VoucherLineFormValue, year: string): CreateVoucherDetailPayload {
    const tafsiliEntries = Object.entries(line.tafsili ?? {});
    return {
      voucherHeadId: headId,
      accountId: line.accountId || null,
      receiptId: null,
      checkId: null,
      lowLevelCodeId: null,
      etebarId: null,
      description: line.description?.trim() ? line.description.trim() : null,
      radif: null,
      debtor: line.debtor ? Number(line.debtor) : null,
      creditor: line.creditor ? Number(line.creditor) : null,
      year: year || null,
      tafsiliLinks:
        tafsiliEntries.length > 0 ? tafsiliEntries.map(([levelId, tafsiliId]) => ({ tafsiliId, levelId })) : null,
    };
  }

  async function submitLine(headId: string, line: VoucherLineFormValue, year: string) {
    setLineStatus((prev) => ({ ...prev, [line.key]: 'pending' }));
    try {
      await voucherDetailsApi.create(buildDetailPayload(headId, line, year));
      setLineStatus((prev) => ({ ...prev, [line.key]: 'success' }));
      setLineErrorMessages((prev) => {
        const next = { ...prev };
        delete next[line.key];
        return next;
      });
      return true;
    } catch (error) {
      setLineStatus((prev) => ({ ...prev, [line.key]: 'error' }));
      const message = error instanceof Error ? error.message : 'ثبت ردیف با خطا مواجه شد.';
      setLineErrorMessages((prev) => ({ ...prev, [line.key]: message }));
      return false;
    }
  }

  /**
   * Saving an edit is a different shape from saving a new voucher: the head is updated rather
   * than created, and the lines have to be reconciled — some updated, some added, and the ones
   * the user removed deleted. See `voucherEdit.ts` for why the reconcile is the delicate part.
   */
  async function submitEdit(values: VoucherEntryFormSchema) {
    setGlobalError(null);

    try {
      await voucherHeadsApi.update(editingId as string, {
        docNum: values.docNum.trim(),
        dateDoc: values.dateDoc.trim(),
        headDesc: values.headDesc?.trim() ? values.headDesc.trim() : null,
        apendix: values.apendix?.trim() ? values.apendix.trim() : null,
        year: values.year.trim(),
        // DOCLIFE is deliberately absent. A voucher's state moves through change-state, which is
        // its own auditable operation (phase 30) — letting an edit carry it would put the state
        // back into an anonymous field write, which is exactly what that phase undid.
      });
    } catch (error) {
      setGlobalError(error);
      return;
    }

    const { failed } = await reconcileLines(editingId as string, values.lines, detailIds, values.year);

    if (failed.length > 0) {
      setLineErrorMessages((prev) => {
        const next = { ...prev };
        failed.forEach((f) => {
          next[f.key] = f.message;
        });
        return next;
      });
      setLineStatus((prev) => {
        const next = { ...prev };
        failed.forEach((f) => {
          next[f.key] = 'error';
        });
        return next;
      });
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ['voucher-heads'] });
    await queryClient.invalidateQueries({ queryKey: ['voucher-details'] });
    navigate('/operation/voucher-heads');
  }

  async function onSubmit(values: VoucherEntryFormSchema) {
    if (isEditing) {
      await submitEdit(values);
      return;
    }

    setGlobalError(null);
    let headId = createdHeadId;

    if (!headId) {
      try {
        const headPayload: CreateVoucherHeadPayload = {
          docNum: values.docNum.trim(),
          dateDoc: values.dateDoc.trim(),
          docLife: null,
          headDesc: values.headDesc?.trim() ? values.headDesc.trim() : null,
          apendix: values.apendix?.trim() ? values.apendix.trim() : null,
          systemTypeId: null,
          flagState: null,
          year: values.year.trim(),
          isAutomatic: null,
          sndVahedCode: null,
          parentHeadId: null,
          attachFileName: null,
          atfNum: null,
        };
        const response = await createHeadMutation.mutateAsync(headPayload);
        headId = response.id;
        setCreatedHeadId(headId);
        await queryClient.invalidateQueries({ queryKey: ['voucher-heads'] });
      } catch (error) {
        setGlobalError(error);
        return;
      }
    }

    // Only (re)submit lines that have not already succeeded — this is what makes "retry"
    // safe: it never re-creates the head and never re-submits an already-accepted line.
    const pendingLines = values.lines.filter((line) => lineStatus[line.key] !== 'success');
    const results = await Promise.all(pendingLines.map((line) => submitLine(headId as string, line, values.year)));

    if (results.every(Boolean)) {
      await queryClient.invalidateQueries({ queryKey: ['voucher-details'] });
      navigate('/operation/voucher-heads');
    }
  }

  const totals = useMemo(() => {
    const lines = watchedLines ?? [];
    const debtor = lines.reduce((sum, line) => sum + Number(line.debtor || 0), 0);
    const creditor = lines.reduce((sum, line) => sum + Number(line.creditor || 0), 0);
    return { debtor, creditor, difference: debtor - creditor };
  }, [watchedLines]);

  const visibleTafsiliColumns = useMemo(() => {
    const lines = watchedLines ?? [];
    const byLevelId = new Map<string, TafsiliLevelDto>();
    Object.values(activeLevelsRef.current).forEach((levels) => {
      levels.forEach((level) => {
        if (!byLevelId.has(level.levelId)) byLevelId.set(level.levelId, level);
      });
    });
    return [...byLevelId.values()]
      .filter((level) => lines.some((line) => line.tafsili?.[level.levelId]))
      .sort((a, b) => a.code - b.code);
  }, [watchedLines]);

  const summaryColumns: DataTableColumn<VoucherLineFormValue>[] = [
    { key: 'accountLabel', header: 'معین', render: (row) => row.accountLabel || '—' },
    ...visibleTafsiliColumns.map((level) => ({
      key: `tafsili-${level.levelId}`,
      header: level.levelName,
      render: (row: VoucherLineFormValue) => row.tafsiliLabels?.[level.levelId] ?? '—',
    })),
    { key: 'description', header: 'شرح', render: (row) => row.description || '—' },
    { key: 'debtor', header: 'بدهکار', render: (row) => (row.debtor ? formatThousands(row.debtor) : '—') },
    { key: 'creditor', header: 'بستانکار', render: (row) => (row.creditor ? formatThousands(row.creditor) : '—') },
    {
      key: 'status',
      header: 'وضعیت ثبت',
      render: (row) => {
        const status = lineStatus[row.key] ?? 'idle';
        if (status === 'success') return <Chip size="small" color="success" label="ثبت شد" />;
        if (status === 'pending') return <Chip size="small" color="info" label="در حال ثبت..." />;
        if (status === 'error') return <Chip size="small" color="error" label={lineErrorMessages[row.key] ?? 'خطا'} />;
        return <Chip size="small" variant="outlined" label="ثبت‌نشده" />;
      },
    },
    {
      key: 'action',
      header: 'عملیات',
      render: (row) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="ویرایش (رفتن به ردیف)">
            <IconButton size="small" onClick={() => handleEditRow(row.key)}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="حذف ردیف">
            <span>
              <IconButton
                size="small"
                color="error"
                disabled={(watchedLines?.length ?? 0) <= 1}
                onClick={() => handleRemoveRowByKey(row.key)}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  const anyLineFailed = Object.values(lineStatus).some((status) => status === 'error');

  return (
    <section>
      <PageHeader
        eyebrow="عملیات"
        icon={<PostAddOutlinedIcon />}
        accentColor="secondary"
        title={isEditing ? 'ویرایش سند' : 'صدور سند (تفصیلی داینامیک)'}
        description={
          isEditing
            ? 'ردیف‌های حذف‌شده، تغییریافته و جدید هنگام ذخیره با سند موجود تطبیق داده می‌شوند.'
            : 'سرسند و ردیف‌های سند را وارد کنید؛ فیلدهای تفصیلی بر اساس حساب معین انتخاب‌شدهٔ هر ردیف به‌صورت داینامیک نمایش داده می‌شوند.'
        }
      />

      {/* The stepper narrates the two-request create flow (head, then lines). Editing has no such
          sequence — the head already exists — so showing it would describe something that is not
          happening. */}
      {!isEditing && (
        <Stepper activeStep={createdHeadId ? 1 : 0} sx={{ mb: 3 }}>
          <Step completed={!!createdHeadId}>
            <StepLabel>سرسند سند</StepLabel>
          </Step>
          <Step>
            <StepLabel>ردیف‌ها و ثبت نهایی</StepLabel>
          </Step>
        </Stepper>
      )}

      {globalError !== null && <ErrorBanner error={globalError} />}

      {createdHeadId && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <AlertTitle>سرسند سند با موفقیت ثبت شد</AlertTitle>
          شناسه سرسند: {createdHeadId}. ذخیره ردیف‌های سند به‌صورت مستقل انجام می‌شود؛ در صورت خطا در یک ردیف،
          می‌توانید فقط همان ردیف را دوباره ثبت کنید بدون این‌که سرسند تکراری ساخته شود.
        </Alert>
      )}

      {anyLineFailed && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          یک یا چند ردیف ثبت نشدند. پس از اصلاح، دوباره روی «ذخیره سند» بزنید — فقط ردیف‌های ثبت‌نشده دوباره ارسال
          می‌شوند.
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
          <DescriptionOutlinedIcon fontSize="small" color="secondary" />
          <Typography variant="h2" component="h2">
            اطلاعات سرسند
          </Typography>
        </Stack>
        <Paper variant="outlined" sx={{ p: 3, mb: 3, borderTop: 4, borderTopColor: 'secondary.main' }}>
          <Grid container spacing={2}>
            {/*
              `docNum`/`year` are legacy numeric codes, not narrative text — a Persian-keyboard
              user typing them will produce Persian digit glyphs (۰-۹) in the raw DOM value.
              `setValueAs: toLatinDigits` converts them at the point RHF reads the field (submit
              time), per the hard rule in `src/lib/format/numbers.ts` (only Latin digits may
              reach the API) — matches the fix applied to `dateDoc` below and to
              debtor/creditor in `VoucherLineRow`. It intentionally does NOT touch
              `accountLabel`, `description`, `headDesc`, `apendix` (free text, not codes).
            */}
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                {...register('docNum', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
                label="شماره سند"
                fullWidth
                required
                disabled={!!createdHeadId}
                slotProps={{
                  htmlInput: { maxLength: 6 },
                  input: { startAdornment: <InputAdornment position="start"><TagOutlinedIcon fontSize="small" color="action" /></InputAdornment> },
                }}
                error={!!formState.errors.docNum}
                helperText={formState.errors.docNum?.message}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <Controller
                control={control}
                name="dateDoc"
                render={({ field, fieldState }) => (
                  <DatePicker
                    calendar={persian}
                    locale={persian_fa}
                    format="YYYYMMDD"
                    disabled={!!createdHeadId}
                    value={field.value || undefined}
                    // ⚠️ `persian_fa`'s locale digit glyphs are Persian (۰-۹), so
                    // `date.format(...)` returns Persian-digit text — `toLatinDigits` is
                    // required here, not optional, per the hard rule in
                    // `src/lib/format/numbers.ts` (only Latin digits may reach the API).
                    onChange={(date) => field.onChange(date ? toLatinDigits(date.format('YYYYMMDD')) : '')}
                    render={(value, openCalendar) => (
                      <TextField
                        label="تاریخ سند"
                        required
                        fullWidth
                        value={value}
                        onClick={openCalendar}
                        onFocus={openCalendar}
                        inputRef={field.ref}
                        disabled={!!createdHeadId}
                        error={!!fieldState.error}
                        helperText={
                          fieldState.error?.message ??
                          'فرمت YYYYMMDD (فرض — رجوع به «تصمیمات باز» در گزارش تحویل)'
                        }
                        slotProps={{
                          htmlInput: { readOnly: true },
                          input: { startAdornment: <InputAdornment position="start"><EventOutlinedIcon fontSize="small" color="action" /></InputAdornment> },
                        }}
                      />
                    )}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 2 }}>
              <TextField
                {...register('year', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
                label="سال مالی"
                fullWidth
                required
                disabled={!!createdHeadId}
                slotProps={{
                  htmlInput: { maxLength: 4 },
                  input: { startAdornment: <InputAdornment position="start"><CalendarMonthOutlinedIcon fontSize="small" color="action" /></InputAdornment> },
                }}
                error={!!formState.errors.year}
                helperText={formState.errors.year?.message}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                {...register('headDesc')}
                label="شرح سند"
                fullWidth
                disabled={!!createdHeadId}
                slotProps={{
                  htmlInput: { maxLength: 250 },
                  input: { startAdornment: <InputAdornment position="start"><NotesOutlinedIcon fontSize="small" color="action" /></InputAdornment> },
                }}
                error={!!formState.errors.headDesc}
                helperText={formState.errors.headDesc?.message}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                {...register('apendix')}
                label="پیوست"
                fullWidth
                multiline
                minRows={2}
                disabled={!!createdHeadId}
                slotProps={{ htmlInput: { maxLength: 800 } }}
                error={!!formState.errors.apendix}
                helperText={formState.errors.apendix?.message}
              />
            </Grid>
          </Grid>
        </Paper>

        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <FormatListNumberedOutlinedIcon fontSize="small" color="secondary" />
            <Typography variant="h2" component="h2">
              ردیف‌های سند
            </Typography>
          </Stack>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => append(createEmptyVoucherLine())}
          >
            افزودن ردیف
          </Button>
        </Stack>

        {formState.errors.lines?.message && <ErrorBanner error={new Error(formState.errors.lines.message)} />}

        {fields.map((field, index) => (
          <VoucherLineRow
            key={field.id}
            form={form}
            index={index}
            rowKey={field.key}
            canRemove={fields.length > 1}
            onRemove={() => remove(index)}
            onActiveLevelsChange={handleActiveLevelsChange}
            highlighted={highlightedRowKey === field.key}
          />
        ))}

        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
          <FormatListNumberedOutlinedIcon fontSize="small" color="secondary" />
          <Typography variant="h2" component="h2">
            خلاصه ردیف‌ها
          </Typography>
        </Stack>
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <DataTable
            columns={summaryColumns}
            rows={watchedLines ?? []}
            getRowKey={(row) => row.key}
            emptyMessage="هنوز ردیفی اضافه نشده است."
          />
        </Paper>

        <Paper
          variant="outlined"
          sx={{
            p: 2,
            mb: 3,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            justifyContent: 'space-between',
          }}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Avatar variant="rounded" sx={{ bgcolor: 'error.main', opacity: 0.85, width: 40, height: 40 }}>
              <TrendingDownOutlinedIcon fontSize="small" />
            </Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary">
                جمع بدهکار
              </Typography>
              <Typography sx={{ fontWeight: 700 }}>{formatThousands(totals.debtor)}</Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Avatar variant="rounded" sx={{ bgcolor: 'success.main', opacity: 0.85, width: 40, height: 40 }}>
              <TrendingUpOutlinedIcon fontSize="small" />
            </Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary">
                جمع بستانکار
              </Typography>
              <Typography sx={{ fontWeight: 700 }}>{formatThousands(totals.creditor)}</Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Avatar
              variant="rounded"
              sx={{
                bgcolor: totals.difference === 0 ? 'success.main' : 'warning.main',
                opacity: 0.85,
                width: 40,
                height: 40,
              }}
            >
              <BalanceOutlinedIcon fontSize="small" />
            </Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary">
                اختلاف (تراز)
              </Typography>
              <Typography sx={{ fontWeight: 700 }}>{formatThousands(totals.difference)}</Typography>
            </Box>
          </Stack>
        </Paper>
        {totals.difference !== 0 && (
          <Alert severity="info" sx={{ mb: 3 }}>
            سند تراز نیست (بدهکار ≠ بستانکار)، اما طبق تصمیم معماری پروژه این تراز اجباری نیست و ثبت مسدود نمی‌شود.
          </Alert>
        )}

        {/* The longest form in the app — a voucher grows a row per line, so this is the save
            button most likely to end up scrolled out of reach. */}
        <FormActions
          onCancel={() => navigate('/operation/voucher-heads')}
          pending={formState.isSubmitting}
          submitLabel={isEditing ? 'ذخیره تغییرات' : 'ذخیره سند'}
          errorCount={Object.keys(formState.errors).length}
        />
      </Box>
    </section>
  );
}
