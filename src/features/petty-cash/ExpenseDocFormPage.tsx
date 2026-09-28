import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import DateObject from 'react-date-object';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import StoreOutlinedIcon from '@mui/icons-material/StoreOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutlineOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import KeyboardReturnOutlinedIcon from '@mui/icons-material/KeyboardReturnOutlined';
import NavigateBeforeOutlinedIcon from '@mui/icons-material/NavigateBeforeOutlined';
import NavigateNextOutlinedIcon from '@mui/icons-material/NavigateNextOutlined';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import { PageHeader } from '../../components/PageHeader';
import { FormCard } from '../../components/FormCard';
import { FormActions } from '../../components/FormActions';
import { FormLoadingSkeleton } from '../../components/FormLoadingSkeleton';
import { FormSectionLabel } from '../../components/FormSectionLabel';
import { ErrorBanner } from '../../components/ErrorBanner';
import { AmountField } from '../../components/AmountField';
import { JalaliDateField } from '../../components/JalaliDateField';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { useSession } from '../../lib/session/SessionContext';
import { toLatinDigits, toPersianDigits, formatThousands } from '../../lib/format/numbers';
import { formatLegacyJalaliDate, formatPersianDateTime } from '../../lib/format/dates';
import { amountInWordsRial } from '../../lib/format/numberToWords';
import { meApi } from '../../lib/api/meApi';
import { expensesApi } from '../expenses/api';
import { pettyCashExpenseDocsApi, pettyCashFundsApi } from './api';
import { PettyCashAttachmentsPanel } from './PettyCashAttachmentsPanel';
import { PettyCashAttachmentPreview } from './PettyCashAttachmentPreview';
import { PettyCashDocEventsPanel, usePettyCashDocEvents } from './PettyCashDocEventsPanel';
import { PettyCashReviewDialogs, type PettyCashApprovalAction, type PettyCashReviewDocTarget } from './PettyCashReviewDialogs';
import { PETTY_CASH_DOC_ACTION } from './pettyCashDocAction';
import {
  EVIDENCE_TYPE_OPTIONS,
  PETTY_CASH_DOC_STATE,
  SUGGESTED_VAT_RATE,
  getPettyCashStateLabel,
  isExpenseDocEditable,
} from './pettyCashDocState';
import { getReturnReasonLabels } from './pettyCashReturnReason';
import {
  buildEmptyExpenseDocFormValues,
  expenseDocDtoToFormValues,
  expenseDocFormSchema,
  expenseDocFormValuesToPayload,
  type ExpenseDocFormValues,
} from './schema';

function todayLegacyJalali(): string {
  return toLatinDigits(new DateObject({ calendar: persian, locale: persian_fa }).format('YYYYMMDD'));
}

interface ChecklistItemProps {
  ok: boolean | null;
  label: string;
}

/** `ok === null` means "not applicable yet" (e.g. no تنخواه selected, or no per-doc limit set). */
function ChecklistItem({ ok, label }: ChecklistItemProps) {
  return (
    <ListItem disableGutters sx={{ py: 0.25 }}>
      <ListItemIcon sx={{ minWidth: 32 }}>
        {ok === null ? (
          <RemoveCircleOutlineIcon fontSize="small" color="disabled" />
        ) : ok ? (
          <CheckCircleOutlineIcon fontSize="small" color="success" />
        ) : (
          <CancelOutlinedIcon fontSize="small" color="error" />
        )}
      </ListItemIcon>
      <ListItemText
        primary={label}
        slotProps={{ primary: { color: ok === false ? 'error' : 'text.primary', variant: 'body2' } }}
      />
    </ListItem>
  );
}

/**
 * ثبت صورت‌هزینه — ص ۶. هندل می‌کند `/treasury/petty-cash/expense-docs/new` و `/:id/edit`.
 *
 * ⚠️ کنترل‌های لحظه‌ای پنل «مانده تنخواه» فقط راهنمای UX‌اند، نه اعتبارسنجی واقعی — قوانین واقعی
 * (سقف هر سند، کفایت موجودی، تاریخ فاکتور در سال جاری) فقط موقع «ارسال برای بررسی» و فقط سمت سرور
 * اجرا می‌شوند (سند مرجع بخش ۴). خطای سرور همیشه با `ErrorBanner` (ProblemDetails واقعی) نشان داده
 * می‌شود، حتی اگر این چک‌لیست «سبز» بوده باشد.
 */
export function ExpenseDocFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { financialYear } = useSession();
  const [submitError, setSubmitError] = useState<unknown>(null);
  // نوار اقدام بررسی (ص ۷) — تأیید/رد یک دیالوگ مشترک؛ برگشت جدا (دلایل چندگزینه‌ای + مهلت).
  const [reviewActionTarget, setReviewActionTarget] = useState<
    { doc: PettyCashReviewDocTarget; action: PettyCashApprovalAction } | null
  >(null);
  const [reviewReturnTarget, setReviewReturnTarget] = useState<PettyCashReviewDocTarget | null>(null);
  const [reviewActionError, setReviewActionError] = useState<unknown>(null);
  const vatTouchedRef = useRef(false);
  // Tracks the last value WE wrote into `vatAmount`, so a manual edit can be told apart from our
  // own auto-suggestion without needing an onChange hook into the shared `AmountField`.
  const lastAutoVatRef = useRef<string | null>(null);

  // صفحهٔ بررسی (ص ۷) — «سند قبلی/بعدی». کارتابل هنگام باز کردن سند، idهای ردیف‌های فعلی جدولش را
  // با `navigate(..., { state: { reviewQueue } })` می‌فرستد؛ این صفحه فقط وقتی از آن مسیر باز شده
  // باشد ناوبری قبلی/بعدی را نشان می‌دهد.
  const reviewQueue = (location.state as { reviewQueue?: string[] } | null)?.reviewQueue ?? null;
  const queueIndex = reviewQueue && id ? reviewQueue.indexOf(id) : -1;
  const hasReviewQueue = Boolean(reviewQueue && reviewQueue.length > 0 && queueIndex >= 0);
  const prevQueueId = hasReviewQueue && queueIndex > 0 ? reviewQueue![queueIndex - 1] : null;
  const nextQueueId = hasReviewQueue && queueIndex < (reviewQueue?.length ?? 0) - 1 ? reviewQueue![queueIndex + 1] : null;

  function goToQueueDoc(targetId: string) {
    navigate(`/treasury/petty-cash/expense-docs/${targetId}/edit`, { state: { reviewQueue } });
  }

  /** «تأیید و سند بعدی» — بعد از تأیید کنترل/تأیید نهایی/برگشت/رد موفق. */
  function goToNextInQueueOrCartable() {
    if (nextQueueId) {
      goToQueueDoc(nextQueueId);
    } else {
      navigate('/treasury/petty-cash/cartable');
    }
  }

  const existingQuery = useQuery({
    queryKey: ['petty-cash-expense-docs', id],
    queryFn: () => pettyCashExpenseDocsApi.getById(id as string),
    enabled: isEdit,
  });

  const fundsQuery = useQuery({ queryKey: ['petty-cash-funds'], queryFn: () => pettyCashFundsApi.list() });
  const expensesQuery = useQuery({
    queryKey: ['expenses', 'for-petty-cash-select'],
    queryFn: () => expensesApi.list({ pageNumber: 1, pageSize: 200 }),
  });
  const allFunds = fundsQuery.data ?? [];
  const expenseOptions = expensesQuery.data?.items ?? [];

  // پیوست‌ها فقط برای مالک سند و فقط در وضعیت پیش‌نویس/برگشتی قابل افزودن/حذف‌اند (بخش ۲-ب). این
  // فقط UX است — تصمیم واقعی سمت سرور با ۴۰۳/۴۰۹ گرفته می‌شود؛ اگر شناسهٔ کاربر جاری در دسترس نبود
  // (که اینجا هست، از `GET /api/me`) به‌جای مخفی‌کردن دکمه، فقط روی وضعیت سند تکیه می‌کردیم و اجازه
  // می‌دادیم خطای واقعی سرور را `ErrorBanner` نشان دهد.
  const currentUserQuery = useQuery({ queryKey: ['me'], queryFn: () => meApi.getCurrentUser() });
  const isDocOwner =
    !existingQuery.data?.addUserId || !currentUserQuery.data
      ? true
      : currentUserQuery.data.userId === existingQuery.data.addUserId;

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ExpenseDocFormValues>({
    resolver: zodResolver(expenseDocFormSchema),
    defaultValues: buildEmptyExpenseDocFormValues(todayLegacyJalali()),
  });

  useEffect(() => {
    if (existingQuery.data) {
      reset(expenseDocDtoToFormValues(existingQuery.data));
      // Loaded values already carry whatever واقعی ارزش افزوده was saved — auto-suggest must not
      // clobber it the moment `amountBeforeTax`'s watch effect below fires for the loaded value.
      vatTouchedRef.current = true;
    }
  }, [existingQuery.data, reset]);

  const fundId = watch('fundId');
  const amountBeforeTax = watch('amountBeforeTax');
  const vatAmount = watch('vatAmount');
  const invoiceDate = watch('invoiceDate');

  // تنخواه‌های غیرفعال برای ساخت/انتخاب سند جدید نمایش داده نمی‌شوند — مگر سندی که در حال ویرایش
  // آن هستیم از قبل به همان تنخواه (که از وقتی ساخته شده غیرفعال شده) وصل باشد؛ آن یک مورد باید در
  // فهرست بماند (غیرقابل‌انتخاب) تا مقدار فعلی فرم گم نشود.
  const funds = allFunds.filter((f) => f.isActive || f.id === fundId);

  // ارزش افزوده پیشنهادی — فقط پیشنهاد اولیه، هرگز سمت سرور hardcode نمی‌شود (سند مرجع §۴).
  // کاربر با اولین ویرایش دستی فیلد، پیشنهاد خودکار را برای همیشه غیرفعال می‌کند: یک ویرایش دستی
  // یعنی مقدار فعلی `vatAmount` با آخرین چیزی که خودمان اینجا نوشته‌ایم فرق دارد — تشخیص این تفاوت
  // (نه یک onChange جداگانه روی `AmountField` مشترک) راهی است که این افتراق تشخیص داده می‌شود.
  useEffect(() => {
    if (vatTouchedRef.current) return;
    const before = Number(amountBeforeTax || 0);
    if (!before) return;
    if (vatAmount !== '' && vatAmount !== lastAutoVatRef.current) {
      vatTouchedRef.current = true;
      return;
    }
    const suggested = String(Math.round(before * SUGGESTED_VAT_RATE));
    lastAutoVatRef.current = suggested;
    setValue('vatAmount', suggested);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `vatAmount` is read from this
    // render's closure on purpose: adding it here would re-run this effect every time OUR OWN
    // `setValue` call above changes it, which does nothing new (see the equality check) but would
    // still fire on every keystroke-triggered render instead of only when `amountBeforeTax` moves.
  }, [amountBeforeTax, setValue]);

  const selectedFund = useMemo(() => funds.find((f) => f.id === fundId) ?? null, [funds, fundId]);
  const totalAmount = Number(amountBeforeTax || 0) + Number(vatAmount || 0);

  // «کنترل‌های لحظه‌ای» — سند مرجع بخش ۴٫ هر سه فقط راهنما هستند؛ منبع حقیقت سرور است.
  const perDocLimit = selectedFund?.perDocLimit ?? null;
  const withinPerDocLimit = perDocLimit == null ? null : totalAmount <= perDocLimit;
  const balanceSufficient = selectedFund?.cashBalance == null ? null : totalAmount <= selectedFund.cashBalance;
  const invoiceYearMatches =
    !invoiceDate || !financialYear ? null : toLatinDigits(invoiceDate).slice(0, 4) === financialYear;
  const balanceAfter = selectedFund?.cashBalance != null ? selectedFund.cashBalance - totalAmount : null;

  const readOnly = isEdit && existingQuery.data !== undefined && !isExpenseDocEditable(existingQuery.data.state);

  // «قفل فیلدبه‌فیلد» (تکمیل بخش ۲، ص ۸) — فقط وقتی سند برگشتی است و بازرس دلیل مشخصی زده باشد
  // غیر `null` است؛ اینجا فقط چیزی را که سرور از قبل تصمیم گرفته اجرا می‌کند (۴۰۹ روی خطای واقعی
  // سمت سرور اگر این کپی UI با آن اختلاف پیدا کند).
  const editableFields = existingQuery.data?.editableFields ?? null;
  function isFieldEditable(fieldName: string): boolean {
    if (readOnly) return false;
    if (editableFields === null) return true;
    return editableFields.includes(fieldName);
  }
  /** فیلدهای مجاز (وقتی محدودیت فعال است) را با کادر رنگی هایلایت می‌کند. */
  function fieldHighlightSx(fieldName: string) {
    return editableFields !== null && isFieldEditable(fieldName)
      ? { '& .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main', borderWidth: 2 } }
      : undefined;
  }
  const attachmentsEditable = editableFields === null || editableFields.includes('attachments');
  const canEditAttachments = isEdit && !readOnly && isDocOwner && attachmentsEditable;

  // «گردش عملیات» — هم برای بنر سند برگشتی (آخرین رویداد Return) و هم پنل تاریخچه؛ هر دو از همین
  // یک کوئری استفاده می‌کنند (کلید مشترک در `PettyCashDocEventsPanel`)، پس درخواست تکراری نمی‌رود.
  const eventsQuery = usePettyCashDocEvents(isEdit ? (id as string) : undefined);
  const lastReturnEvent = useMemo(() => {
    const events = eventsQuery.data ?? [];
    for (let i = events.length - 1; i >= 0; i -= 1) {
      if (events[i].action === PETTY_CASH_DOC_ACTION.return) return events[i];
    }
    return null;
  }, [eventsQuery.data]);

  // نوار اقدام بررسی (ص ۷) — فقط سند خواندنی در وضعیت «جدید»/«در انتظار بررسی» را نشان می‌دهد.
  // نمایش دکمه‌ها بر اساس نقش حدس زده نمی‌شود؛ سرور با ۴۰۳/۴۰۹ تصمیم واقعی را می‌گیرد.
  const canStartReview = readOnly && existingQuery.data?.state === PETTY_CASH_DOC_STATE.new;
  const canReview = readOnly && existingQuery.data?.state === PETTY_CASH_DOC_STATE.pendingReview;
  const isVerified = Boolean(existingQuery.data?.verifiedByUserId);
  /** «تأیید کنترل» اگر هنوز بازرس کنترل نکرده، وگرنه «تأیید نهایی» — هرکدام الان در دسترس است. */
  const primaryApprovalAction: PettyCashApprovalAction = isVerified ? 'approve' : 'verify';

  // «کنترل‌های سند» (ص ۷، فقط در حالت خواندنیِ بررسی) — همان دو کنترل بالا (سقف هر سند/دورهٔ جاری)
  // به‌علاوهٔ ایجادکننده≠بررسی‌کننده و بررسی‌کننده≠تأییدکننده. فقط نمایشی؛ تصمیم واقعی سمت سرور است.
  const creatorNotReviewer =
    !currentUserQuery.data || !existingQuery.data?.addUserId
      ? null
      : currentUserQuery.data.userId !== existingQuery.data.addUserId;
  const reviewerNotApprover =
    !currentUserQuery.data || !existingQuery.data?.verifiedByUserId
      ? null
      : currentUserQuery.data.userId !== existingQuery.data.verifiedByUserId;

  // میانبر کیبورد (ص ۷): «A» = تأیید (کنترل یا نهایی، هرکدام در دسترس است)، «R» = برگشت — فقط وقتی
  // فوکوس داخل یک input/textarea/select نیست و هیچ دیالوگی باز نیست.
  useEffect(() => {
    if (!canReview || !existingQuery.data) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (reviewActionTarget !== null || reviewReturnTarget !== null) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      const doc = existingQuery.data!;
      if (event.key === 'a' || event.key === 'A') {
        event.preventDefault();
        setReviewActionTarget({ doc: { id: doc.id, docNumber: doc.docNumber }, action: primaryApprovalAction });
      } else if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        setReviewReturnTarget({ id: doc.id, docNumber: doc.docNumber });
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canReview, existingQuery.data, primaryApprovalAction, reviewActionTarget, reviewReturnTarget]);

  const startReviewMutation = useMutation({
    mutationFn: () => pettyCashExpenseDocsApi.startReview(id as string),
    onSuccess: async () => {
      setReviewActionError(null);
      await queryClient.invalidateQueries({ queryKey: ['petty-cash-expense-docs'] });
      await queryClient.invalidateQueries({ queryKey: ['petty-cash-doc-events'] });
      notify('بررسی سند آغاز شد.');
    },
    onError: (error) => setReviewActionError(error),
  });

  async function invalidateLists() {
    await queryClient.invalidateQueries({ queryKey: ['petty-cash-expense-docs'] });
    await queryClient.invalidateQueries({ queryKey: ['petty-cash-funds'] });
  }

  const saveDraftMutation = useMutation({
    mutationFn: async (values: ExpenseDocFormValues) => {
      const payload = expenseDocFormValuesToPayload(values, financialYear || '');
      return isEdit ? pettyCashExpenseDocsApi.update(id as string, payload) : pettyCashExpenseDocsApi.create({ ...payload, submit: false });
    },
    onSuccess: async () => {
      await invalidateLists();
      notify('صورت‌هزینه به‌صورت پیش‌نویس ذخیره شد.');
      navigate('/treasury/petty-cash/cartable');
    },
    onError: (error) => setSubmitError(error),
  });

  const submitForReviewMutation = useMutation({
    mutationFn: async (values: ExpenseDocFormValues) => {
      const payload = expenseDocFormValuesToPayload(values, financialYear || '');
      if (isEdit) {
        await pettyCashExpenseDocsApi.update(id as string, payload);
        return pettyCashExpenseDocsApi.submit(id as string);
      }
      return pettyCashExpenseDocsApi.create({ ...payload, submit: true });
    },
    onSuccess: async () => {
      await invalidateLists();
      notify('صورت‌هزینه برای بررسی ارسال شد.');
      navigate('/treasury/petty-cash/cartable');
    },
    onError: (error) => setSubmitError(error),
  });

  const pending = saveDraftMutation.isPending || submitForReviewMutation.isPending;

  function onSubmitForReview(values: ExpenseDocFormValues) {
    setSubmitError(null);
    submitForReviewMutation.mutate(values);
  }

  function onSaveDraft(values: ExpenseDocFormValues) {
    setSubmitError(null);
    saveDraftMutation.mutate(values);
  }

  if (isEdit && existingQuery.isLoading) {
    return <FormLoadingSkeleton />;
  }

  if (isEdit && existingQuery.isError) {
    return <ErrorBanner error={existingQuery.error} />;
  }

  return (
    <section>
      <PageHeader
        eyebrow="تنخواه و خزانه‌داری"
        icon={<ReceiptLongOutlinedIcon />}
        accentColor="secondary"
        title={isEdit ? 'ویرایش صورت‌هزینه' : 'ثبت صورت‌هزینه'}
        description={
          existingQuery.data?.docNumber
            ? `سند ${existingQuery.data.docNumber} — وضعیت: ${getPettyCashStateLabel(existingQuery.data.state)}`
            : 'ثبت هزینه‌کرد از یک تنخواه، با فاکتور/رسید پشتوانه.'
        }
      />

      {/* بخش ۲ — بنر سند برگشتی (صفحهٔ ۸ پاورپوینت، «آنچه تنخواه‌دار می‌بیند»). */}
      {isEdit && existingQuery.data?.state === PETTY_CASH_DOC_STATE.returned && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>این سند برای اصلاح برگشت خورده است</AlertTitle>
          <Stack spacing={0.5}>
            {existingQuery.data.returnDeadline && (
              <Typography variant="body2">
                مهلت اصلاح: {formatLegacyJalaliDate(existingQuery.data.returnDeadline)}
              </Typography>
            )}
            {lastReturnEvent && getReturnReasonLabels(lastReturnEvent.returnReasons).length > 0 && (
              <Typography variant="body2">
                دلایل برگشت: {getReturnReasonLabels(lastReturnEvent.returnReasons).join('، ')}
              </Typography>
            )}
            {lastReturnEvent?.note && (
              <Typography variant="body2">توضیح بررسی‌کننده: {lastReturnEvent.note}</Typography>
            )}
          </Stack>
        </Alert>
      )}

      {readOnly && (
        <Alert severity="info" sx={{ mb: 2 }}>
          این سند در وضعیت «{getPettyCashStateLabel(existingQuery.data?.state)}» است و دیگر قابل
          ویرایش نیست — فقط اسناد «پیش‌نویس» و «برگشتی» قابل ویرایش‌اند.
        </Alert>
      )}

      {/* صفحهٔ بررسی (ص ۷) — سند قبلی/بعدی؛ فقط وقتی از کارتابل با یک صف باز شده باشد. */}
      {hasReviewQueue && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'center', mb: 2 }}>
          <IconButton size="small" disabled={!prevQueueId} onClick={() => prevQueueId && goToQueueDoc(prevQueueId)} aria-label="سند قبلی">
            <NavigateNextOutlinedIcon fontSize="small" />
          </IconButton>
          <Typography variant="body2" color="text.secondary">
            سند {toPersianDigits(queueIndex + 1)} از {toPersianDigits(reviewQueue?.length ?? 0)}
          </Typography>
          <IconButton size="small" disabled={!nextQueueId} onClick={() => nextQueueId && goToQueueDoc(nextQueueId)} aria-label="سند بعدی">
            <NavigateBeforeOutlinedIcon fontSize="small" />
          </IconButton>
        </Stack>
      )}

      {/* بخش ۲ — نوار اقدام بررسی (صفحهٔ ۷ پاورپوینت). دکمه‌ها بر اساس نقش حدس زده نمی‌شوند —
          سرور با ۴۰۳/۴۰۹ تصمیم واقعی را می‌گیرد. */}
      {(canStartReview || canReview) && existingQuery.data && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
          {reviewActionError !== null && <ErrorBanner error={reviewActionError} />}
          {isVerified && (
            <Chip
              size="small"
              color="info"
              icon={<FactCheckIcon fontSize="small" />}
              label={`کنترل‌شده توسط ${existingQuery.data.verifiedByUserId}${
                existingQuery.data.verifiedDate ? ` — ${formatPersianDateTime(existingQuery.data.verifiedDate)}` : ''
              }`}
              sx={{ mb: 1.5 }}
            />
          )}
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            {canStartReview && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<FactCheckOutlinedIcon />}
                disabled={startReviewMutation.isPending}
                onClick={() => startReviewMutation.mutate()}
              >
                {startReviewMutation.isPending ? 'در حال ثبت…' : 'شروع بررسی'}
              </Button>
            )}
            {canReview && (
              <>
                <Button
                  variant="contained"
                  color={isVerified ? 'success' : 'primary'}
                  startIcon={isVerified ? <CheckCircleOutlineIcon /> : <FactCheckOutlinedIcon />}
                  onClick={() =>
                    setReviewActionTarget({
                      doc: { id: existingQuery.data!.id, docNumber: existingQuery.data!.docNumber },
                      action: primaryApprovalAction,
                    })
                  }
                >
                  {isVerified ? 'تأیید نهایی' : 'تأیید کنترل'}
                </Button>
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<KeyboardReturnOutlinedIcon />}
                  onClick={() =>
                    setReviewReturnTarget({ id: existingQuery.data!.id, docNumber: existingQuery.data!.docNumber })
                  }
                >
                  برگشت برای اصلاح
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<CancelOutlinedIcon />}
                  onClick={() =>
                    setReviewActionTarget({
                      doc: { id: existingQuery.data!.id, docNumber: existingQuery.data!.docNumber },
                      action: 'reject',
                    })
                  }
                >
                  رد سند…
                </Button>
              </>
            )}
          </Stack>
          {canReview && (
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
              میانبر: A تأیید | R برگشت
            </Typography>
          )}
        </Paper>
      )}

      {/* «قفل فیلدبه‌فیلد» (تکمیل بخش ۲، ص ۸) — سند برگشتی با دلیل مشخص. */}
      {editableFields !== null && (
        <Alert severity="info" sx={{ mb: 2 }}>
          فقط فیلدهای علامت‌خورده (کادر رنگی) توسط بازرس قابل ویرایش‌اند.
        </Alert>
      )}

      {submitError !== null && <ErrorBanner error={submitError} />}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <FormCard
            accentColor="secondary"
            watermarkIcon={<ReceiptLongOutlinedIcon />}
            onSubmit={handleSubmit(onSubmitForReview)}
          >
            <Grid container spacing={3}>
              <Grid size={12}>
                <FormSectionLabel label="تنخواه و تاریخ" accentColor="secondary" />
              </Grid>
              <Grid size={{ xs: 12, sm: 8 }}>
                <Controller
                  control={control}
                  name="fundId"
                  render={({ field }) => (
                    <TextField
                      select
                      fullWidth
                      required
                      label="تنخواه"
                      disabled={readOnly || !isFieldEditable('fundId')}
                      sx={fieldHighlightSx('fundId')}
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      error={!!errors.fundId}
                      helperText={errors.fundId?.message}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <SavingsOutlinedIcon fontSize="small" color="action" />
                            </InputAdornment>
                          ),
                        },
                      }}
                    >
                      {funds.length === 0 && (
                        <MenuItem value="" disabled>
                          {fundsQuery.isLoading ? 'در حال بارگذاری…' : 'هیچ تنخواهی تعریف نشده است'}
                        </MenuItem>
                      )}
                      {funds.map((fund) => (
                        <MenuItem key={fund.id} value={fund.id} disabled={!fund.isActive}>
                          {fund.code ? `${fund.code} — ` : ''}
                          {fund.name ?? '—'}
                          {!fund.isActive ? ' (غیرفعال)' : ''}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Controller
                  control={control}
                  name="registerDate"
                  render={({ field }) => (
                    <JalaliDateField
                      label="تاریخ ثبت"
                      value={field.value}
                      onChange={field.onChange}
                      disabled={readOnly || !isFieldEditable('registerDate')}
                      sx={fieldHighlightSx('registerDate')}
                      error={!!errors.registerDate}
                      helperText={errors.registerDate?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={12}>
                <FormSectionLabel label="فروشنده و فاکتور" accentColor="secondary" />
              </Grid>
              <Grid size={{ xs: 12, sm: 8 }}>
                <TextField
                  {...register('vendorName')}
                  label="فروشنده"
                  fullWidth
                  required
                  disabled={readOnly || !isFieldEditable('vendorName')}
                  sx={fieldHighlightSx('vendorName')}
                  slotProps={{
                    htmlInput: { maxLength: 200 },
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <StoreOutlinedIcon fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                    },
                  }}
                  error={!!errors.vendorName}
                  helperText={errors.vendorName?.message}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  {...register('vendorNationalId', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
                  label="شناسه ملی فروشنده"
                  fullWidth
                  disabled={readOnly || !isFieldEditable('vendorNationalId')}
                  sx={fieldHighlightSx('vendorNationalId')}
                  slotProps={{
                    htmlInput: { maxLength: 11, inputMode: 'numeric' },
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <BadgeOutlinedIcon fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                    },
                  }}
                  error={!!errors.vendorNationalId}
                  helperText={errors.vendorNationalId?.message}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Controller
                  control={control}
                  name="invoiceDate"
                  render={({ field }) => (
                    <JalaliDateField
                      label="تاریخ فاکتور"
                      required
                      value={field.value}
                      onChange={field.onChange}
                      disabled={readOnly || !isFieldEditable('invoiceDate')}
                      sx={fieldHighlightSx('invoiceDate')}
                      error={!!errors.invoiceDate}
                      helperText={errors.invoiceDate?.message}
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  {...register('invoiceNo', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
                  label="شماره فاکتور"
                  fullWidth
                  required
                  disabled={readOnly || !isFieldEditable('invoiceNo')}
                  sx={fieldHighlightSx('invoiceNo')}
                  slotProps={{
                    htmlInput: { maxLength: 50 },
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <TagOutlinedIcon fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                    },
                  }}
                  error={!!errors.invoiceNo}
                  helperText={errors.invoiceNo?.message}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Controller
                  control={control}
                  name="evidenceType"
                  render={({ field }) => (
                    <TextField
                      select
                      fullWidth
                      required
                      label="نوع مدرک"
                      disabled={readOnly || !isFieldEditable('evidenceType')}
                      sx={fieldHighlightSx('evidenceType')}
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      error={!!errors.evidenceType}
                      helperText={errors.evidenceType?.message}
                    >
                      {EVIDENCE_TYPE_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>

              <Grid size={12}>
                <FormSectionLabel label="شرح و مبلغ" accentColor="secondary" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller
                  control={control}
                  name="expenseId"
                  render={({ field }) => (
                    <TextField
                      select
                      fullWidth
                      required
                      label="حساب هزینه"
                      disabled={readOnly || !isFieldEditable('expenseId')}
                      sx={fieldHighlightSx('expenseId')}
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      error={!!errors.expenseId}
                      helperText={errors.expenseId?.message}
                    >
                      {expenseOptions.length === 0 && (
                        <MenuItem value="" disabled>
                          {expensesQuery.isLoading ? 'در حال بارگذاری…' : 'هیچ هزینه‌ای تعریف نشده است'}
                        </MenuItem>
                      )}
                      {expenseOptions.map((expense) => (
                        <MenuItem key={expense.id} value={expense.id}>
                          {expense.expenseCode ? `${expense.expenseCode} — ` : ''}
                          {expense.expenseName ?? '—'}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  {...register('description')}
                  label="شرح هزینه"
                  fullWidth
                  required
                  multiline
                  minRows={1}
                  disabled={readOnly || !isFieldEditable('description')}
                  sx={fieldHighlightSx('description')}
                  slotProps={{
                    htmlInput: { maxLength: 1000 },
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <DescriptionOutlinedIcon fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                    },
                  }}
                  error={!!errors.description}
                  helperText={errors.description?.message}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <AmountField
                  control={control}
                  name="amountBeforeTax"
                  label="مبلغ قبل از مالیات (ریال)"
                  required
                  disabled={readOnly || !isFieldEditable('amountBeforeTax')}
                  sx={fieldHighlightSx('amountBeforeTax')}
                  icon={<PaidOutlinedIcon fontSize="small" color="action" />}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <AmountField
                  control={control}
                  name="vatAmount"
                  label="ارزش افزوده (ریال)"
                  disabled={readOnly || !isFieldEditable('vatAmount')}
                  sx={fieldHighlightSx('vatAmount')}
                  helperText="پیش‌فرض ۱۰٪ مبلغ قبل از مالیات — قابل ویرایش"
                  icon={<PaidOutlinedIcon fontSize="small" color="action" />}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="مبلغ کل (ریال)"
                  fullWidth
                  disabled
                  value={totalAmount ? formatThousands(totalAmount) : ''}
                  helperText={totalAmount ? amountInWordsRial(totalAmount) : 'مبلغ قبل از مالیات + ارزش افزوده'}
                />
              </Grid>

              <Grid size={12}>
                {isEdit && existingQuery.data?.addUserId && (
                  <>
                    <Divider sx={{ my: 3 }} />
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      ایجاد: کاربر {existingQuery.data.addUserId}
                    </Typography>
                  </>
                )}
                {!readOnly && (
                  <FormActions
                    onCancel={() => navigate('/treasury/petty-cash/cartable')}
                    pending={pending}
                    submitLabel="ارسال برای بررسی"
                    extra={
                      <Button
                        type="button"
                        variant="outlined"
                        disabled={pending}
                        onClick={handleSubmit(onSaveDraft)}
                      >
                        ذخیره پیش‌نویس
                      </Button>
                    }
                  />
                )}
                {readOnly && (
                  <Stack direction="row" sx={{ justifyContent: 'flex-end', mt: 3 }}>
                    <Button variant="outlined" onClick={() => navigate('/treasury/petty-cash/cartable')}>
                      بازگشت به کارتابل
                    </Button>
                  </Stack>
                )}
              </Grid>
            </Grid>
          </FormCard>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, position: 'sticky', top: 16 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
              <AccountBalanceWalletOutlinedIcon color="secondary" />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                مانده تنخواه
              </Typography>
            </Stack>

            {!selectedFund ? (
              <Typography variant="body2" color="text.secondary">
                برای دیدن مانده، ابتدا تنخواه را انتخاب کنید.
              </Typography>
            ) : (
              <Stack spacing={0.75}>
                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    موجودی نقد فعلی
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {selectedFund.cashBalance != null ? formatThousands(selectedFund.cashBalance) : '—'}
                  </Typography>
                </Stack>
                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    این سند
                  </Typography>
                  <Typography variant="body2" color="error.main" sx={{ fontWeight: 600 }}>
                    {totalAmount ? `− ${formatThousands(totalAmount)}` : '—'}
                  </Typography>
                </Stack>
                <Divider sx={{ my: 0.5 }} />
                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    مانده پس از این سند
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 700 }}
                    color={balanceAfter != null && balanceAfter < 0 ? 'error.main' : 'text.primary'}
                  >
                    {balanceAfter != null ? formatThousands(balanceAfter) : '—'}
                  </Typography>
                </Stack>
              </Stack>
            )}

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
              کنترل‌های لحظه‌ای
            </Typography>
            <List dense disablePadding>
              <ChecklistItem
                ok={withinPerDocLimit}
                label={
                  perDocLimit != null
                    ? `در سقف هر سند (${formatThousands(perDocLimit)} ریال)`
                    : 'سقف هر سند برای این تنخواه تعیین نشده'
                }
              />
              <ChecklistItem ok={balanceSufficient} label="موجودی نقد تنخواه کافی است" />
              <ChecklistItem
                ok={invoiceYearMatches}
                label={financialYear ? `تاریخ فاکتور در سال مالی ${toPersianDigits(financialYear)}` : 'تاریخ فاکتور در سال مالی جاری'}
              />
            </List>
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
              این‌ها فقط راهنمای سریع‌اند؛ تصمیم نهایی و پیام خطای واقعی همیشه از سرور می‌آید.
            </Typography>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mt: 2 }}>
            {isEdit && existingQuery.data ? (
              <PettyCashAttachmentsPanel expenseDocId={id as string} canEdit={canEditAttachments} />
            ) : (
              <Typography variant="body2" color="text.secondary">
                برای افزودن پیوست ابتدا سند را ذخیره کنید.
              </Typography>
            )}
          </Paper>

          {/* صفحهٔ بررسی (ص ۷) — پیش‌نمایش inline پیوست‌های تصویری/PDF، فقط در حالت خواندنی سند. */}
          {readOnly && isEdit && existingQuery.data && (
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mt: 2 }}>
              <PettyCashAttachmentPreview expenseDocId={id as string} />
            </Paper>
          )}

          {/* صفحهٔ بررسی (ص ۷) — کنترل‌های سند، فقط نمایشی؛ تصمیم واقعی همیشه سمت سرور است. */}
          {readOnly && isEdit && existingQuery.data && (
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mt: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                کنترل‌های سند
              </Typography>
              <List dense disablePadding>
                <ChecklistItem
                  ok={withinPerDocLimit}
                  label={
                    perDocLimit != null
                      ? `زیر سقف هر سند (${formatThousands(perDocLimit)} ریال)`
                      : 'سقف هر سند برای این تنخواه تعیین نشده'
                  }
                />
                <ChecklistItem
                  ok={invoiceYearMatches}
                  label={financialYear ? `در دورهٔ جاری (سال مالی ${toPersianDigits(financialYear)})` : 'در دورهٔ جاری'}
                />
                <ChecklistItem ok={creatorNotReviewer} label="ایجادکننده ≠ بررسی‌کننده (شما)" />
                <ChecklistItem ok={reviewerNotApprover} label="بررسی‌کننده ≠ تأییدکننده (شما)" />
                <ChecklistItem ok={null} label="عدم تکراری بودن: هنگام ارسال کنترل شد" />
              </List>
            </Paper>
          )}

          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mt: 2 }}>
            {isEdit && existingQuery.data ? (
              <PettyCashDocEventsPanel expenseDocId={id as string} />
            ) : (
              <Typography variant="body2" color="text.secondary">
                برای دیدن گردش عملیات ابتدا سند را ذخیره کنید.
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      <PettyCashReviewDialogs
        approveRejectTarget={reviewActionTarget}
        onCloseApproveReject={() => setReviewActionTarget(null)}
        returnTarget={reviewReturnTarget}
        onCloseReturn={() => setReviewReturnTarget(null)}
        onActionSuccess={hasReviewQueue ? () => goToNextInQueueOrCartable() : undefined}
      />
    </section>
  );
}
