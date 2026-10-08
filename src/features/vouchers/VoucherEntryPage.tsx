import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import PostAddOutlinedIcon from '@mui/icons-material/PostAddOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined';
import { FormActions } from '../../components/FormActions';
import { JalaliDateField } from '../../components/JalaliDateField';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { useSession } from '../../lib/session/SessionContext';
import { formatThousands, toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { VoucherLineRow } from './VoucherLineRow';
import { buildVoucherEntrySchema, type ActiveLevelsByRowKey, type VoucherEntryFormSchema } from './voucherEntrySchema';
import { createEmptyVoucherLine, isBlankVoucherLine, type VoucherLineFormValue } from './voucherFormTypes';
import {
  buildSaveLines,
  toFormValues,
  type DetailIdByRowKey,
  type OriginalDetailByRowKey,
} from './voucherEdit';
import { useAllAccountCodes } from '../chart-of-accounts/useAllAccountCodes';
import { getNextDocNum, saveVoucher, toSaveLine, voucherDetailsApi, voucherHeadsApi, type CreateVoucherDetailPayload, type CreateVoucherHeadPayload } from './api';
import { defaultVoucherDate } from '../assistant/draftMapping';
import { lineExtrasPayload } from './lineExtras';
import type { TafsiliLevelDto } from '../../types/tafsili';

/**
 * Section heading for the three parts of the voucher form. Plain text, no icon or coloured rule:
 * the form already has one accent (the row being entered), and an icon on every heading made the
 * headings compete with it.
 */
function SectionTitle({ title, meta, action }: { title: string; meta?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between', gap: 2, mb: 1.25, minHeight: 36 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
        <Typography variant="h3" component="h2">
          {title}
        </Typography>
        {meta && (
          <Typography variant="body2" color="text.secondary">
            {meta}
          </Typography>
        )}
      </Stack>
      {action}
    </Stack>
  );
}

/**
 * What a recorded row carries besides its amount: the cheque (or fictitious cheque) with its due
 * date, the deposit slip/transfer with its date, and the identifier values. Without it the summary
 * table showed two bank rows as bare amounts, and the only way to check a cheque number was to
 * reopen the row.
 */
function LineDocuments({ line }: { line: VoucherLineFormValue }) {
  const items: string[] = [];
  const date = (v: string) => (v ? formatLegacyJalaliDate(toLatinDigits(v).replace(/\D/g, '')) : '');

  if (line.checkId || line.soriCheckBookId) {
    // checkLabel is «چک ۵۰۰۱۰۰۱، بانک … حساب …»; the part before the comma is the cheque itself.
    const cheque = (line.checkLabel || (line.soriCheckBookId ? 'اعلامیه صوری' : 'چک')).split('،')[0].trim();
    items.push(line.chequeDate ? `${cheque}، سررسید ${date(line.chequeDate)}` : cheque);
  }
  if (line.receiptNo?.trim()) {
    const kind = line.receiptKind === '2' ? 'حواله' : 'فیش';
    items.push(`${kind} ${line.receiptNo.trim()}${line.receiptDate ? `، ${date(line.receiptDate)}` : ''}`);
  }
  const attributeDefs = line.extrasReq?.attributes ?? [];
  Object.entries(line.attributes ?? {}).forEach(([id, value]) => {
    if (!value?.trim()) return;
    const def = attributeDefs.find((a) => a.definitionId === id);
    const shown = def && (def.flag === 2 || def.control === 2) ? date(value) : value.trim();
    items.push(`شناسه ${shown}`);
  });

  if (items.length === 0) return <>—</>;
  return (
    <Stack spacing={0.25}>
      {items.map((text) => (
        <Typography key={text} variant="body2" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
          {toPersianDigits(text)}
        </Typography>
      ))}
    </Stack>
  );
}

/**
 * Debit / credit / difference, pinned in the save bar. A voucher's balance is the one figure the
 * user checks before every save, and on a long voucher the old totals card sat below the fold,
 * right where it was least visible. Debit is not coloured red: it is not an error.
 */
function BalanceSummary({ debtor, creditor }: { debtor: number; creditor: number }) {
  const difference = debtor - creditor;
  const figure = (label: string, value: number) => (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums lining-nums', lineHeight: 1.4 }}>
        {formatThousands(value)}
      </Typography>
    </Box>
  );
  return (
    <Stack
      direction="row"
      spacing={2}
      divider={<Divider orientation="vertical" flexItem />}
      sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}
      aria-live="polite"
    >
      {figure('جمع بدهکار', debtor)}
      {figure('جمع بستانکار', creditor)}
      {figure('اختلاف', difference)}
      <Chip size="small" color={difference === 0 ? 'success' : 'warning'} label={difference === 0 ? 'تراز' : 'تراز نیست'} />
    </Stack>
  );
}


/**
 * Voucher entry form with dynamic تفصیلی fields (phase 22-b). Layout adapted from the old
 * Angular `add-voucher` page (header chips/fields, per-line تفصیلی 1-3 inline + 4+ modal,
 * totals footer) — see the completion report for exactly which patterns were kept vs.
 * dropped.
 *
 * ذخیره اتمیک است (فاز ۵۲، ریسک #۲۱): سرسند + ردیف‌ها + حذف‌ها با یک POST /api/voucher-heads/save
 * در یک تراکنش سمت سرور — یا همه یا هیچ. تراز فقط نمایشی است؛ قاعدهٔ «خروج از یادداشت = تراز» را سرور اعمال می‌کند.
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
      // پیش‌فرض: امروز (اگر امروز در سال مالی جاری نیست، آخرین روز همان سال). در ویرایش با سند بارشده جایگزین می‌شود.
      dateDoc: defaultVoucherDate(financialYear).value,
      year: financialYear || '',
      headDesc: '',
      apendix: '',
      lines: [createEmptyVoucherLine()],
    },
  });
  const { control, register, handleSubmit, formState } = form;

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const watchedLines = useWatch({ control, name: 'lines' });
  const watchedYear = useWatch({ control, name: 'year' });

  // یک ردیف در حال ویرایش است؛ بقیه فقط در «خلاصه ردیف‌ها» دیده می‌شوند (همه mount می‌مانند تا
  // سطوح تفصیلی و انتخاب‌هایشان حفظ شود). کلید ناموجود ⇒ آخرین ردیف.
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null);
  const currentRowKey =
    fields.find((f) => f.key === editingRowKey)?.key ?? fields[fields.length - 1]?.key ?? null;

  // «ثبت ردیف»: ردیف کنترل می‌شود، به جدول خلاصه می‌رود و کادر ورود خالی می‌شود — یعنی کادر روی
  // یک ردیف خالی (موجود یا تازه) می‌رود. ردیف خالی نه در جدول می‌آید نه جلوی «ذخیره سند» را می‌گیرد.
  async function confirmRow(index: number) {
    const ok = await form.trigger(`lines.${index}` as const);
    if (!ok) return;
    const lines = form.getValues('lines');
    const blankIndex = lines.findIndex((l, i) => i !== index && isBlankVoucherLine(l));
    if (blankIndex >= 0 && fields[blankIndex]) {
      setEditingRowKey(fields[blankIndex].key);
      return;
    }
    const line = createEmptyVoucherLine();
    append(line);
    setEditingRowKey(line.key);
  }

  function onInvalid(errors: Parameters<Parameters<typeof handleSubmit>[1] & object>[0]) {
    // خطا در ردیفی که بسته است ⇒ همان ردیف را باز کن.
    const bad = Array.isArray(errors.lines) ? errors.lines.findIndex((e) => e) : -1;
    if (bad >= 0 && fields[bad]) handleEditRow(fields[bad].key);
  }

  /**
   * Enter moves to the next field instead of submitting the form: data-entry clerks key a voucher
   * with Enter the way the old system worked, and a browser-default Enter in «شماره سند» used to
   * save a half-typed voucher. Fields that own Enter run first and mark the event handled: the
   * تفصیلی autocomplete picking an option, the معین field opening its picker, and بدهکار/بستانکار
   * running «ثبت ردیف». Saving stays on the button (or Ctrl+Enter from anywhere).
   */
  function moveFocusOnEnter(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key !== 'Enter' || e.defaultPrevented || e.nativeEvent.isComposing) return;
    const target = e.target as HTMLElement;
    // React bubbles events out of portals: Enter in the معین picker's search box arrives here too,
    // though that dialog is not inside the form in the DOM. It is not ours to handle.
    if (!e.currentTarget.contains(target)) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.currentTarget.requestSubmit();
      return;
    }
    // Multi-line fields keep Enter for a new line; buttons keep Enter for their click.
    if (target.tagName !== 'INPUT') return;
    e.preventDefault();
    const fields = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>('input:not([type=hidden]):not([disabled]), textarea:not([disabled])'),
    ).filter((el) => el.tabIndex >= 0 && el.offsetParent !== null && !el.getAttribute('aria-hidden'));
    const next = fields[fields.indexOf(target) + 1];
    next?.focus();
  }

  function submitVoucher(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // کادر ورودِ خالی ذخیره نمی‌شود (مگر سند هیچ ردیف پری نداشته باشد — آن‌وقت خطای «ردیف الزامی» بماند).
    const lines = form.getValues('lines');
    const blank = lines.map((l, i) => (isBlankVoucherLine(l) ? i : -1)).filter((i) => i >= 0);
    if (blank.length > 0 && blank.length < lines.length) remove(blank);
    void handleSubmit(onSubmit, onInvalid)();
  }

  // Edit mode is this same form with a voucher already in it. A second page would mean a second
  // copy of the تفصیلی row logic, which is the most intricate part of this feature and the last
  // thing worth duplicating.
  const { id: editingId } = useParams<{ id: string }>();
  const isEditing = Boolean(editingId);
  const [detailIds, setDetailIds] = useState<DetailIdByRowKey>({});
  const [originalDetails, setOriginalDetails] = useState<OriginalDetailByRowKey>({});

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

  const [loadError, setLoadError] = useState<Error | null>(null);

  // Reset once, when the voucher arrives. Re-running on every render would fight the user for
  // control of the fields they are typing in.
  useEffect(() => {
    if (!existingVoucher.data) return;

    try {
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
      setOriginalDetails(loaded.originals);
      setLoadError(null);
    } catch (error) {
      // Anything thrown here would otherwise escape during render and take the whole tree down —
      // a blank page with no message, which is what a stale backend used to produce.
      setLoadError(error instanceof Error ? error : new Error('بارگذاری سند با خطا مواجه شد.'));
    }
  }, [existingVoucher.data, accountCodes, form]);


  // سند جدید: شمارهٔ پیشنهادی = آخرین شمارهٔ سند واحد در سال + ۱. فقط اگر کاربر خودش شماره‌ای ننوشته.
  const nextDocNumQuery = useQuery({
    queryKey: ['voucher-next-doc-num', watchedYear],
    queryFn: () => getNextDocNum(watchedYear),
    enabled: !isEditing && /^\d{4}$/.test(watchedYear ?? ''),
  });
  useEffect(() => {
    const next = nextDocNumQuery.data;
    if (!next || isEditing || form.getFieldState('docNum').isDirty) return;
    form.setValue('docNum', next, { shouldValidate: true });
  }, [nextDocNumQuery.data, isEditing, form]);
  const [globalError, setGlobalError] = useState<unknown>(null);
  const [highlightedRowKey, setHighlightedRowKey] = useState<string | null>(null);


  function handleActiveLevelsChange(rowKey: string, levels: TafsiliLevelDto[]) {
    activeLevelsRef.current = { ...activeLevelsRef.current, [rowKey]: levels };
  }

  function handleEditRow(rowKey: string) {
    setEditingRowKey(rowKey);
    setHighlightedRowKey(rowKey);
    // The row was hidden until now; scroll after it is shown.
    window.setTimeout(
      () => document.getElementById(`voucher-line-${rowKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      0,
    );
    window.setTimeout(() => setHighlightedRowKey((current) => (current === rowKey ? null : current)), 1600);
  }

  function handleRemoveRowByKey(rowKey: string) {
    const index = fields.findIndex((f) => f.key === rowKey);
    if (index === -1) return;
    remove(index);
  }

  function buildDetailPayload(headId: string, line: VoucherLineFormValue, year: string): CreateVoucherDetailPayload {
    const tafsiliEntries = Object.entries(line.tafsili ?? {});
    return {
      voucherHeadId: headId,
      accountId: line.accountId || null,
      receiptId: null,
      checkId: line.checkId || null,
      cheque: line.checkId || line.soriCheckBookId
        ? {
            payTo: line.chequePayTo.trim() || null,
            chequeDate: line.chequeDate || null,
            description: line.chequeDesc.trim() || null,
            soriCheckBookId: line.checkId ? null : line.soriCheckBookId,
          }
        : null,
      lowLevelCodeId: null,
      etebarId: null,
      description: line.description?.trim() ? line.description.trim() : null,
      radif: null,
      debtor: line.debtor ? Number(line.debtor) : null,
      creditor: line.creditor ? Number(line.creditor) : null,
      year: year || null,
      tafsiliLinks:
        tafsiliEntries.length > 0 ? tafsiliEntries.map(([levelId, tafsiliId]) => ({ tafsiliId, levelId })) : null,
      extras: lineExtrasPayload(line),
    };
  }

  function buildHeadPayload(values: VoucherEntryFormSchema): CreateVoucherHeadPayload {
    // ⚠️ در ویرایش همهٔ فیلدهای سرسند فرستاده می‌شوند، حتی آن‌هایی که فرم ویرایش نمی‌کند: مسیر
    // ویرایش جایگزین می‌کند نه وصله — فیلدِ نفرستاده null می‌شود (DOCLIFE، SYSTEM_TYPE، ATF_NUM و…).
    // DOCLIFE دست‌نخورده برمی‌گردد؛ تغییر وضعیت عملیات جدای خودش است.
    const loadedHead = isEditing ? existingVoucher.data?.head : undefined;
    return {
      docNum: values.docNum.trim(),
      dateDoc: values.dateDoc.trim(),
      headDesc: values.headDesc?.trim() ? values.headDesc.trim() : null,
      apendix: values.apendix?.trim() ? values.apendix.trim() : null,
      year: values.year.trim(),
      docLife: loadedHead?.docLife ?? null,
      systemTypeId: loadedHead?.systemTypeId ?? null,
      flagState: loadedHead?.flagState ?? null,
      isAutomatic: loadedHead?.isAutomatic ?? null,
      sndVahedCode: loadedHead?.sndVahedCode ?? null,
      parentHeadId: loadedHead?.parentHeadId ?? null,
      attachFileName: loadedHead?.attachFileName ?? null,
      // سرور نادیده می‌گیرد: عطف هنگام ایجاد تخصیص می‌یابد و هرگز عوض نمی‌شود.
      atfNum: loadedHead?.atfNum ?? null,
    };
  }

  /**
   * ذخیرهٔ اتمیک (ریسک #۲۱، فاز ۵۲): سرسند، ردیف‌ها و در ویرایش ردیف‌های حذف‌شده، همه در یک
   * درخواست و یک تراکنش سمت سرور. خطای هر ردیف کل سند را برمی‌گرداند — دیگر سرسند بی‌ردیف یا سند
   * نیمه‌ذخیره نمی‌ماند و «تلاش دوباره» همان ذخیرهٔ کامل است.
   */
  async function onSubmit(values: VoucherEntryFormSchema) {
    setGlobalError(null);

    if (isEditing && !existingVoucher.data?.head) {
      setGlobalError(new Error('سرسند بارگذاری نشده است؛ صفحه را دوباره باز کنید.'));
      return;
    }

    const { lines, deletedLineIds } = isEditing
      ? buildSaveLines(values.lines, detailIds, originalDetails)
      : { lines: values.lines.map((line) => toSaveLine(null, buildDetailPayload('', line, ''))), deletedLineIds: [] };

    try {
      await saveVoucher({
        headId: isEditing ? (editingId as string) : null,
        head: buildHeadPayload(values),
        lines,
        deletedLineIds,
        concurrency: isEditing ? { updatedDate: existingVoucher.data?.head.updatedDate ?? null } : null,
      });
    } catch (error) {
      setGlobalError(error);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ['voucher-heads'] });
    await queryClient.invalidateQueries({ queryKey: ['voucher-details'] });
    await queryClient.invalidateQueries({ queryKey: ['voucher-next-doc-num'] });
    navigate('/operation/voucher-heads');
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

  const summaryRows = (watchedLines ?? []).filter((l) => !isBlankVoucherLine(l));

  const summaryColumns: DataTableColumn<VoucherLineFormValue>[] = [
    {
      key: 'radif',
      header: 'ردیف',
      width: 56,
      render: (row) => summaryRows.findIndex((l) => l.key === row.key) + 1,
    },
    { key: 'accountLabel', header: 'معین', render: (row) => row.accountLabel || '—' },
    ...visibleTafsiliColumns.map((level) => ({
      key: `tafsili-${level.levelId}`,
      header: level.levelName,
      render: (row: VoucherLineFormValue) => row.tafsiliLabels?.[level.levelId] ?? '—',
    })),
    { key: 'description', header: 'شرح', render: (row) => row.description || '—' },
    { key: 'documents', header: 'چک / فیش / شناسه', render: (row) => <LineDocuments line={row} /> },
    { key: 'debtor', header: 'بدهکار', align: 'end', render: (row) => (row.debtor ? formatThousands(row.debtor) : '—') },
    { key: 'creditor', header: 'بستانکار', align: 'end', render: (row) => (row.creditor ? formatThousands(row.creditor) : '—') },
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

  return (
    <section>
      <PageHeader
        eyebrow="عملیات"
        icon={<PostAddOutlinedIcon />}
        accentColor="secondary"
        title={isEditing ? 'ویرایش سند' : 'صدور سند'}
        description={
          isEditing
            ? 'ردیف‌های حذف‌شده، تغییریافته و جدید هنگام ذخیره با سند موجود تطبیق داده می‌شوند.'
            : 'سرسند را پر کنید و ردیف‌ها را یکی‌یکی ثبت کنید. فیلدهای تفصیلی هر ردیف با انتخاب حساب معین ظاهر می‌شوند.'
        }
      />

      {/* Loading an existing voucher can fail in a way that is not a network error — see
          VoucherApiTooOldError. Showing the reason and stopping is the point: opening the form
          anyway would present an editable voucher whose save button destroys its تفصیلی. */}
      {loadError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <AlertTitle>سند بارگذاری نشد</AlertTitle>
          {loadError.message}
        </Alert>
      )}

      {isEditing && existingVoucher.isError && (
        <Box sx={{ mb: 3 }}>
          <ErrorBanner error={existingVoucher.error} />
        </Box>
      )}

      {globalError !== null && <ErrorBanner error={globalError} />}

      <Box component="form" onSubmit={submitVoucher} onKeyDown={moveFocusOnEnter} noValidate>
        <SectionTitle title="سرسند" />
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 4 }}>
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
                  <JalaliDateField
                    label="تاریخ سند"
                    value={field.value}
                    onChange={field.onChange}
                   
                    required
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
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
                minRows={1}
                maxRows={4}
               
                slotProps={{ htmlInput: { maxLength: 800 } }}
                error={!!formState.errors.apendix}
                helperText={formState.errors.apendix?.message}
              />
            </Grid>
          </Grid>
        </Paper>

        <SectionTitle
          title="ورود ردیف"
          action={
            <Button
              variant="text"
              color="secondary"
              startIcon={<AddCircleOutlineIcon />}
              onClick={() => {
                // کادر خالیِ موجود را باز کن؛ فقط اگر نیست ردیف تازه بساز.
                const blankIndex = form.getValues('lines').findIndex((l) => isBlankVoucherLine(l));
                if (blankIndex >= 0 && fields[blankIndex]) {
                  setEditingRowKey(fields[blankIndex].key);
                  return;
                }
                const line = createEmptyVoucherLine();
                append(line);
                setEditingRowKey(line.key);
              }}
            >
              ردیف جدید
            </Button>
          }
        />

        {formState.errors.lines?.message && <ErrorBanner error={new Error(formState.errors.lines.message)} />}

        {fields.map((field, index) => (
          <Box key={field.id} sx={{ display: field.key === currentRowKey ? 'block' : 'none' }}>
            <VoucherLineRow
              form={form}
              index={index}
              rowKey={field.key}
              canRemove={fields.length > 1}
              onRemove={() => remove(index)}
              onActiveLevelsChange={handleActiveLevelsChange}
              highlighted={highlightedRowKey === field.key}
              onConfirm={() => void confirmRow(index)}
            />
          </Box>
        ))}

        <SectionTitle
          title="ردیف‌های ثبت‌شده"
          meta={summaryRows.length > 0 ? `${summaryRows.length.toLocaleString('fa-IR')} ردیف` : undefined}
        />
        <Paper variant="outlined" sx={{ p: { xs: 1, sm: 2 }, mb: 3 }}>
          <DataTable
            columns={summaryColumns}
            rows={summaryRows}
            getRowKey={(row) => row.key}
            emptyMessage="هنوز ردیفی ثبت نشده است. ردیف بالا را پر کنید و «ثبت ردیف» را بزنید."
          />
        </Paper>

        {totals.difference !== 0 && summaryRows.length > 0 && (
          <Alert severity="info" sx={{ mb: 3 }}>
            سند تراز نیست. می‌توانید آن را به‌صورت «یادداشت» ذخیره کنید، ولی برای بردن به «موقت» و مراحل بعد باید تراز
            باشد.
          </Alert>
        )}

        {/* The longest form in the app — a voucher grows a row per line, so this is the save
            button most likely to end up scrolled out of reach. */}
        <FormActions
          onCancel={() => navigate('/operation/voucher-heads')}
          pending={formState.isSubmitting}
          submitLabel={isEditing ? 'ذخیره تغییرات' : 'ذخیره سند'}
          errorCount={Object.keys(formState.errors).length}
          summary={<BalanceSummary debtor={totals.debtor} creditor={totals.creditor} />}
        />
      </Box>
    </section>
  );
}
