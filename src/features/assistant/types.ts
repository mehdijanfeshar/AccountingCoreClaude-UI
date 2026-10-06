import type { VoucherLineExtrasPayload } from '../vouchers/lineExtras';
/**
 * Wire types for the حسابیار (Agent-UX) module — `api/operations` on the backend
 * (`Accounting.Application/OperationTemplates`). Ids are Guid strings; amounts are integer Rial.
 */

/** 1 مبلغ · 2 تفصیلی · 3 متن · 4 تاریخ */
export type ParameterType = 1 | 2 | 3 | 4;

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
}

export interface TemplateSummaryDto {
  id: string;
  code: string;
  title: string;
  description: string;
  parameters: TemplateParameterDto[];
  /** کلمات کلیدی و جمله‌های نمونه، هر خط یکی. */
  keywords: string | null;
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
}

export interface OperationInput {
  voucherDate: string | null;
  values: Record<string, string | null>;
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

export interface TemplateDefinitionSummaryDto {
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
}

export interface TemplateDefinitionDto {
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
export interface TemplateWritePayload {
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
