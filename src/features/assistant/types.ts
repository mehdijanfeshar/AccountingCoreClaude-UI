import type { VoucherLineExtrasPayload } from '../vouchers/lineExtras';
/**
 * Wire types for the حسابیار (Agent-UX) module — `api/operations` on the backend
 * (`Accounting.Application/OperationTemplates`). Ids are Guid strings; amounts are integer Rial.
 */

/** 1 مبلغ · 2 تفصیلی · 3 متن · 4 تاریخ · 5 انتخابی (گزینه‌ها در options) */
export type ParameterType = 1 | 2 | 3 | 4 | 5;

export interface ParameterOption {
  value: string;
  label: string;
}

/** ریسک پایه الگو: 1 کم · 2 متوسط · 3 زیاد. */
export type RiskBase = 1 | 2 | 3;
export type RiskLevel = 'low' | 'medium' | 'high';

/** دستهٔ عملیات: 1 هزینه · 2 پرداخت · 3 دریافت · 4 خرید · 5 تنخواه · 6 فروش · 7 تعهدی · 9 سایر. */
export type TemplateCategory = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 9;
export const CATEGORY_LABEL: Record<TemplateCategory, string> = { 1: 'هزینه', 2: 'پرداخت', 3: 'دریافت', 4: 'خرید', 5: 'تنخواه', 6: 'فروش', 7: 'تعهدی', 9: 'سایر' };
export const RISK_BASE_LABEL: Record<RiskBase, string> = { 1: 'کم', 2: 'متوسط', 3: 'زیاد' };

/** تقسیم چندماهه (فاز ۶۶): 2 پیش‌پرداخت · 3 درآمد انتقالی. */
export type AccrualScheduleKindValue = 2 | 3;

/** پارامتر الزامی تعداد ماه در الگوی تقسیم چندماهه (همان ثابت سرور). */
export const ACCRUAL_MONTHS_KEY = 'months';

/** سیاست الگو (فاز ۶۲) — در پاسخ‌های قدیمی نیست. */
export interface TemplatePolicy {
  maxAmount?: number | null;
  requireAttachment?: boolean;
  riskBase?: RiskBase | null;
  category?: TemplateCategory | null;
  plainPattern?: string | null;
  /** فاز ۶۶: سند اول ماه بعد خودکار برگردانده شود (برآورد). */
  autoReverse?: boolean;
  /** فاز ۶۶: تقسیم روی چند ماه؛ null = ندارد. */
  scheduleKind?: AccrualScheduleKindValue | null;
}

export interface TemplateParameterDto {
  key: string;
  title: string;
  type: ParameterType;
  detailGroupId: string | null;
  isRequired: boolean;
  /** The question asked when this value is missing — the same text a future agent will ask. */
  askPrompt: string;
  sortOrder: number;
  /** For type 2: the معین/سطح whose تفصیلی list is offered (same unit rule as the voucher form). */
  pickerAccountId: string | null;
  pickerLevel: number | null;
  /** فقط برای نوع ۵. */
  options?: ParameterOption[];
}

export interface TemplateSummaryDto extends TemplatePolicy {
  id: string;
  code: string;
  title: string;
  description: string;
  parameters: TemplateParameterDto[];
  /** کلمات کلیدی و جمله‌های نمونه، هر خط یکی. */
  keywords: string | null;
  questionCount?: number;
  usageCountInUnit?: number;
}

export interface VoucherDraftDetail {
  level: number;
  levelId: string;
  detailId: string;
  detailTitle: string;
}

export interface VoucherDraftLine {
  subsidiaryAccountId: string;
  subsidiaryAccountTitle: string;
  subsidiaryAccountCode: string | null;
  details: VoucherDraftDetail[];
  debit: number;
  credit: number;
  description: string;
  checkId: string | null;
}

export interface VoucherDraft {
  vahedCode: string;
  /** Gregorian `YYYY-MM-DD`. */
  voucherDate: string;
  description: string;
  sourceTemplateCode: string;
  lines: VoucherDraftLine[];
  apendix: string | null;
  /** نوع سند (`TB_SYSTYPE.ID`). */
  systemTypeId: string | null;
  totalDebit: number;
  totalCredit: number;
}

/**
 * One engine/validation error. `parameterKey` is either a template parameter key (`amount`,
 * `customer`, …) or a field path of the full voucher (`voucherDate`, `lines[2].tafsili.{levelId}`,
 * …); `askPrompt` is the question to put back to the user.
 */
export interface EngineError {
  code: string | number;
  message: string;
  parameterKey: string | null;
  askPrompt: string | null;
}

export interface OperationResult {
  success: boolean;
  draft: VoucherDraft | null;
  errors: EngineError[];
  voucherId: string | null;
  voucherNo: string | null;
  wasAlreadyExecuted: boolean;
  /** متن ساده و هشدارهای پیش‌نمایش (فاز ۶۱)؛ سرور قدیمی نمی‌فرستد. */
  plainText?: string;
  warnings?: string[];
  risk?: { level: RiskLevel; reasons: string[] };
  controls?: ControlItem[];
  basis?: { templateTitle: string; usageCountInUnit: number };
}

export interface ControlItem {
  key: string;
  label: string;
  passed: boolean;
}

/** منبع هر جواب برای ریسک‌سنجی سرور. */
export type AnswerSourceKind = 'sentence' | 'ai' | 'recent' | 'quick' | 'user';

export interface OperationInput {
  voucherDate: string | null;
  values: Record<string, string | null>;
  answerSources?: Record<string, AnswerSourceKind>;
  aiConfirmed?: boolean;
  hasAttachment?: boolean;
}

export interface ComposedLineInput {
  accountId: string | null;
  debit: number;
  credit: number;
  description: string | null;
  tafsili: { levelId: string; tafsiliId: string }[];
  checkId: string | null;
  cheque: { payTo: string | null; chequeDate: string | null; description: string | null; soriCheckBookId: string | null } | null;
  extras?: VoucherLineExtrasPayload | null;
}

export interface ComposedVoucherInput {
  voucherDate: string | null;
  description: string | null;
  apendix: string | null;
  systemTypeId: string | null;
  lines: ComposedLineInput[];
}

// ───────────── طراحی الگو (ستاد) ─────────────

/** 1 بدهکار · 2 بستانکار */
export type LineSide = 1 | 2;

export interface TemplateDefinitionSummaryDto extends TemplatePolicy {
  id: string;
  code: string;
  title: string;
  description: string;
  isActive: boolean;
  parameterCount: number;
  lineCount: number;
  createdBy: string;
  createdAtUtc: string;
}

export interface TemplateLineDetailDefinitionDto {
  level: number;
  parameterKey: string | null;
  fixedDetailId: string | null;
  fixedDetailTitle: string | null;
}

export interface TemplateLineDefinitionDto {
  side: LineSide;
  subsidiaryAccountId: string;
  accountCode: string | null;
  accountTitle: string | null;
  amountParameterKey: string | null;
  percent: number;
  isBalancingLine: boolean;
  descriptionPattern: string | null;
  sortOrder: number;
  details: TemplateLineDetailDefinitionDto[];
  /** شرط ردیف: فقط وقتی جواب پارامتر انتخابی برابر مقدار باشد. */
  conditionParamKey?: string | null;
  conditionValue?: string | null;
  /** 1 مبلغ پارامتر · 2 ارزش افزوده بر اساس نرخ تاریخ سند */
  amountSource?: AmountSource;
  /** فاز ۶۶: ردیف «سهم ماهانه» الگوی تقسیم چندماهه — در سند اصلی ساخته نمی‌شود. */
  isScheduleLine?: boolean;
}

export type AmountSource = 1 | 2;

export interface TemplateDefinitionDto extends TemplatePolicy {
  id: string;
  code: string;
  title: string;
  description: string;
  voucherDescriptionPattern: string;
  isActive: boolean;
  parameters: TemplateParameterDto[];
  lines: TemplateLineDefinitionDto[];
  systemTypeId: string | null;
  keywords: string | null;
  /** کد نوع واحدهای مجاز (TB_VAHEDTYPE.TYPECODE)؛ خالی = همه. */
  allowedVahedTypes?: string[] | null;
}

/** Body of create / update / validate. */
export interface TemplateWritePayload extends TemplatePolicy {
  code: string;
  title: string;
  description: string;
  voucherDescriptionPattern: string;
  systemTypeId: string | null;
  keywords: string | null;
  allowedVahedTypes: string[];
  parameters: Omit<TemplateParameterDto, 'pickerAccountId' | 'pickerLevel'>[];
  lines: {
    side: LineSide;
    subsidiaryAccountId: string;
    amountParameterKey: string | null;
    percent: number;
    isBalancingLine: boolean;
    descriptionPattern: string | null;
    sortOrder: number;
    details: { level: number; parameterKey: string | null; fixedDetailId: string | null }[];
    conditionParamKey: string | null;
    conditionValue: string | null;
    amountSource: AmountSource;
    isScheduleLine?: boolean;
  }[];
}

export interface TemplateWriteResult {
  success: boolean;
  id: string | null;
  errors: string[];
}

/** اطلاعاتی که هنگام «ثبت» سند الگو برای یک ردیف پیش‌نویس گرفته می‌شود (به ترتیب ردیف پیش‌نمایش). */
export interface DraftLineExtrasInput {
  lineIndex: number;
  checkId: string | null;
  cheque: ComposedLineInput['cheque'];
  extras: VoucherLineExtrasPayload | null;
}

// ───────────── هوش مصنوعی (Agent-UX فاز ۲) ─────────────

/** type: 1 مبلغ (ریال) · 2 تفصیلی (نام نوشته‌شده؛ جستجو با سیستم) · 3 متن · 4 تاریخ شمسی YYYYMMDD */
export interface InterpretedAnswer {
  key: string;
  value: string;
  type: number;
}

export interface InterpretResult {
  /** false ⇒ هوش مصنوعی در تنظیمات سرور خاموش است؛ روش قاعده‌ای. */
  enabled: boolean;
  provider: string | null;
  succeeded: boolean;
  message: string | null;
  templateId: string | null;
  confidence: number | null;
  voucherDate: string | null;
  answers: InterpretedAnswer[];
  clarification: string | null;
  /** ردپای تفسیر هوش مصنوعی — هنگام execute بی‌تغییر برگردانده می‌شود. */
  aiTraceId?: string | null;
}

// ───────────── ردپای حسابیار ─────────────

/** type: 1 مبلغ · 2 تفصیلی (value=Guid، label=عنوان) · 3 متن · 4 تاریخ شمسی YYYYMMDD */
export interface RecentAnswer {
  key: string;
  type: number;
  value: string;
  label: string | null;
}

export interface RecentOperation {
  executionId: string;
  templateId: string;
  templateTitle: string;
  voucherNo: string;
  voucherId: string;
  createdAtUtc: string;
  answers: RecentAnswer[];
}

export interface ExecutionRow {
  id: string;
  templateId: string | null;
  templateCode: string;
  templateTitle: string | null;
  /** Form = از الگو · Compose = سند کامل/دستی · Agent */
  channel: string;
  voucherId: string;
  voucherNo: string;
  createdBy: string;
  createdAtUtc: string;
  vahedCode: string;
}

export interface ExecutionPage {
  items: ExecutionRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TemplateUsage {
  templateId: string;
  count: number;
  lastUsedUtc: string;
}

// ───────────── سندهای پرتکرار (DDL 079) ─────────────

export interface QuickVoucher {
  id: string;
  title: string;
  templateId: string;
  templateTitle: string;
  /** جواب‌های ثابت (قالب «اخیرها»)؛ پارامترهای دیگر (معمولاً مبلغ) هنگام ثبت پرسیده می‌شوند. */
  fixedAnswers: RecentAnswer[];
  createdBy: string;
}

// ───────────── سندهای من و صف بررسی (فاز ۶۱) ─────────────

export type MyVoucherStatus = 'returned' | 'pending' | 'reviewed';

export interface MyVoucherItem {
  executionId: string;
  voucherId: string;
  docNum: string;
  date: string;
  templateTitle: string | null;
  channel: string;
  totalAmount: number;
  status: MyVoucherStatus | 'draft';
  createdAtUtc: string;
  plainText: string | null;
  returnReasonCode: string | null;
  returnMessage: string | null;
  returnedAtUtc: string | null;
}

export interface MyVouchersResult {
  counts: { returned: number; pending: number; reviewed: number };
  oldestPendingAtUtc: string | null;
  latestReturn: {
    executionId: string;
    voucherId: string;
    docNum: string;
    reasonCode: string | null;
    message: string | null;
    returnedAtUtc: string;
  } | null;
  items: MyVoucherItem[];
}

export interface ReviewItem {
  executionId: string;
  voucherId: string;
  docNum: string;
  date: string;
  templateTitle: string | null;
  channel: string;
  totalAmount: number;
  createdBy: string;
  createdAtUtc: string;
  isMine: boolean;
  plainText: string | null;
  warnings: string[];
  riskLevel?: RiskLevel;
  riskReasons?: string[];
  userSentence?: string | null;
  origin?: { templateTitle: string | null; aiFilledKeys: string[]; userConfirmedAll: boolean };
  controls?: ControlItem[];
  latestReply?: { message: string; createdAtUtc: string } | null;
  /** تعداد پیوست واقعی سند (TB_ATTACH). */
  attachmentCount?: number;
}

export interface ReviewPage {
  items: ReviewItem[];
  total: number;
  page: number;
  pageSize: number;
  counts?: { all: number; low: number; attention: number };
}

export interface ReviewHistoryEntry {
  action: 'approved' | 'returned' | 'resubmitted' | 'replied';
  reasonCode: string | null;
  message: string | null;
  reviewerId: string | null;
  createdAtUtc: string;
}

export interface ReviewDetail {
  item: ReviewItem;
  status: string;
  history: ReviewHistoryEntry[];
}

export interface OperationRequestItem {
  id: string;
  sentence: string;
  createdBy: string;
  createdAtUtc: string;
  status: 'open' | 'done';
  handledBy: string | null;
  handledAtUtc: string | null;
  note: string | null;
}

export interface DetailSuggestion {
  detailId: string;
  title: string;
  count: number;
  lastUsedAtUtc: string | null;
}

export interface ReturnPayload {
  reasonCode: string;
  message: string | null;
}

// ───────────── یادگیری از اسناد گذشته ─────────────

/** پیشنهاد «از روی سوابق» برای جمله‌ای که الگویی نخورده (POST operations/history/match). */
export interface HistorySuggestion {
  patternId: string;
  plainSummary: string;
  sampleDescriptions: string[];
  voucherCount: number;
  inMyUnitCount: number;
  questions: TemplateParameterDto[];
}

export interface HistoryPatternLine {
  moinId: string;
  moinCode: string;
  moinTitle: string;
  /** 1 بدهکار · 2 بستانکار */
  side: LineSide;
  /** سهم از مبلغ، درصد. */
  share: number;
  detailLevels: { level: number; groupTitles: string[] }[];
}

export interface HistoryPattern {
  id: string;
  lines: HistoryPatternLine[];
  voucherCount: number;
  unitCount: number;
  /** فهرست سال‌ها یا متن آماده («۱۴۰۲–۱۴۰۴»). */
  years: (string | number)[] | string;
  medianAmount: number;
  lastDate: string | null;
  keywords: { word: string; count: number }[];
  sampleDescriptions: string[];
  coveredByTemplate: { id: string; title: string } | null;
  /** فقط الگوی چندمعنایی: حساب‌ها یکی‌اند ولی شرح‌ها چند کار متفاوت‌اند (گروه‌بندی معنایی، DDL 089). */
  meanings?: HistoryMeaning[] | null;
}

export interface HistoryMeaning {
  index: number;
  /** نماینده‌ترین شرح (بدون نام طرف حساب و رقم). */
  title: string;
  /** درصد از نمونه‌شرح‌های الگو. */
  share: number;
  samples: string[];
  keywords: { word: string; count: number }[];
}

export interface HistoryPatternPage {
  items: HistoryPattern[];
  total: number;
  page: number;
  pageSize: number;
  needsRebuild: boolean;
}

export interface HistoryPatternFilters {
  fromYear?: number;
  toYear?: number;
  vahedType?: string;
  minCount?: number;
  search?: string;
  page: number;
  pageSize: number;
}

export interface HistoryRebuildResult {
  patternCount: number;
  voucherCount: number;
  elapsedMs: number;
}

/** پیش‌نویس الگوی ساخته‌شده از یک الگوی سوابق؛ ذخیره نشده است. */
export interface HistoryTemplateDraft extends TemplateWritePayload {
  validationErrors: string[];
  notes: string[];
}

export const RETURN_REASONS: { code: string; label: string }[] = [
  { code: 'missing_attachment', label: 'پیوست ناقص' },
  { code: 'wrong_amount', label: 'مبلغ نادرست' },
  { code: 'wrong_account', label: 'حساب/طرف حساب نادرست' },
  { code: 'wrong_date', label: 'تاریخ نادرست' },
  { code: 'other', label: 'سایر' },
];

/** پیوست سند حسابیار (بدون محتوای فایل). */
export interface VoucherAttachment {
  id: string;
  fileName: string;
  title: string | null;
  size: number;
  createdAt: string | null;
  addedBy: string | null;
}
