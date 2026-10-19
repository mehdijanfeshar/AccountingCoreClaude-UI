import { newClientId } from '../../../lib/ids';
import type { AmountSource, LineSide, ParameterOption, ParameterType, RiskBase, TemplateCategory, TemplateDefinitionDto, TemplateWritePayload } from '../types';

/**
 * Editable shape of a template in the designer. Plain objects + pure helpers (no form library):
 * lines refer to questions by `key`, and renaming/removing a question has to ripple into every line
 * that uses it — which is far simpler on plain data than through a nested form library.
 */

export interface DesignParam {
  uid: string;
  key: string;
  title: string;
  type: ParameterType;
  detailGroupId: string | null;
  isRequired: boolean;
  askPrompt: string;
  /** گزینه‌های سؤال انتخابی (نوع ۵). */
  options: ParameterOption[];
}

export interface DesignLevel {
  level: number;
  source: 'param' | 'fixed';
  parameterKey: string;
  fixedDetailId: string;
  fixedLabel: string;
}

export interface DesignLine {
  uid: string;
  side: LineSide;
  accountId: string;
  accountLabel: string;
  amountParameterKey: string;
  percent: string;
  isBalancing: boolean;
  descriptionPattern: string;
  /** شرط ردیف: فقط وقتی جواب سؤال انتخابی برابر مقدار باشد (هر دو خالی = همیشه). */
  conditionParamKey: string;
  conditionValue: string;
  /** 1 مبلغ پارامتر · 2 ارزش افزوده بر اساس نرخ تاریخ سند */
  amountSource: AmountSource;
  /** راهنمای انتخاب معین (از نمونهٔ آماده)، مثلاً «بانک / صندوق». */
  hint?: string;
  /** Only levels the user has bound; levels of the معین without an entry are "not set yet". */
  details: DesignLevel[];
}

export interface DesignModel {
  id: string | null;
  code: string;
  title: string;
  description: string;
  voucherDescriptionPattern: string;
  /** نوع سند (`TB_SYSTYPE.ID`) یا null. */
  systemTypeId: string | null;
  /** کلمات کلیدی و جمله‌های نمونه، هر خط یکی. */
  keywords: string;
  /** کد نوع واحدهایی که الگو را می‌بینند؛ خالی = همه. */
  allowedVahedTypes: string[];
  isActive: boolean;
  /** سیاست الگو (فاز ۶۲): سقف مبلغ (ریال، خالی = بدون سقف)، پیوست الزامی، ریسک پایه، دسته و الگوی متن ساده. */
  maxAmount: string;
  requireAttachment: boolean;
  riskBase: RiskBase | '';
  category: TemplateCategory | '';
  plainPattern: string;
  params: DesignParam[];
  lines: DesignLine[];
}

export const PARAM_TYPE_LABEL: Record<ParameterType, string> = { 1: 'مبلغ', 2: 'تفصیلی (شخص، بانک، مرکز…)', 3: 'متن', 4: 'تاریخ', 5: 'انتخابی (گزینه‌ها)' };

const KEY_BASE: Record<ParameterType, string> = { 1: 'amount', 2: 'detail', 3: 'note', 4: 'date', 5: 'choice' };

/** A Latin key no other question uses: amount, amount2, detail1, … (the server requires Latin keys). */
export function nextKey(params: DesignParam[], type: ParameterType): string {
  const used = new Set(params.map((p) => p.key.toLowerCase()));
  const base = KEY_BASE[type];
  if (type === 1 && !used.has(base)) return base;
  for (let i = type === 1 ? 2 : 1; ; i++) if (!used.has(`${base}${i}`)) return `${base}${i}`;
}

export function newParam(params: DesignParam[], type: ParameterType, init: Partial<DesignParam> = {}): DesignParam {
  const defaults: Record<ParameterType, Pick<DesignParam, 'title' | 'askPrompt'>> = {
    1: { title: 'مبلغ', askPrompt: 'مبلغ چقدر بود؟' },
    2: { title: '', askPrompt: '' },
    3: { title: 'توضیح', askPrompt: 'توضیح بیشتری دارد؟' },
    4: { title: 'تاریخ', askPrompt: 'چه تاریخی؟' },
    5: { title: '', askPrompt: '' },
  };
  return {
    uid: newClientId(),
    key: nextKey(params, type),
    type,
    detailGroupId: null,
    options: [],
    isRequired: type !== 3,
    ...defaults[type],
    ...init,
  };
}

export function newLine(side: LineSide, amountKey: string): DesignLine {
  return {
    uid: newClientId(),
    side,
    accountId: '',
    accountLabel: '',
    amountParameterKey: amountKey,
    percent: '100',
    isBalancing: false,
    descriptionPattern: '',
    conditionParamKey: '',
    conditionValue: '',
    amountSource: 1,
    details: [],
  };
}

/** A new template starts as the most common shape: one amount, an optional note, a debit and a credit line. */
export function emptyModel(): DesignModel {
  const amount = newParam([], 1, { askPrompt: 'چه مبلغی؟' });
  const note = newParam([amount], 3);
  return {
    id: null,
    code: '',
    title: '',
    description: '',
    voucherDescriptionPattern: '',
    systemTypeId: null,
    keywords: '',
    allowedVahedTypes: [],
    isActive: true,
    maxAmount: '',
    requireAttachment: false,
    riskBase: '',
    category: '',
    plainPattern: '',
    params: [amount, note],
    lines: [newLine(1, amount.key), newLine(2, amount.key)],
  };
}

export function fromDefinition(def: TemplateDefinitionDto): DesignModel {
  return {
    id: def.id,
    code: def.code,
    title: def.title,
    description: def.description,
    voucherDescriptionPattern: def.voucherDescriptionPattern,
    systemTypeId: def.systemTypeId ?? null,
    keywords: def.keywords ?? '',
    allowedVahedTypes: def.allowedVahedTypes ?? [],
    isActive: def.isActive,
    maxAmount: def.maxAmount ? String(def.maxAmount) : '',
    requireAttachment: def.requireAttachment ?? false,
    riskBase: def.riskBase ?? '',
    category: def.category ?? '',
    plainPattern: def.plainPattern ?? '',
    params: def.parameters.map((p) => ({
      uid: newClientId(),
      key: p.key,
      title: p.title,
      type: p.type,
      detailGroupId: p.detailGroupId,
      isRequired: p.isRequired,
      askPrompt: p.askPrompt,
      options: (p.options ?? []).map((o) => ({ value: o.value, label: o.label })),
    })),
    lines: def.lines.map((l) => ({
      uid: newClientId(),
      side: l.side,
      accountId: l.subsidiaryAccountId,
      accountLabel: `${l.accountCode ?? ''} - ${l.accountTitle ?? 'حساب نامعلوم'}`,
      amountParameterKey: l.amountParameterKey ?? '',
      percent: String(l.percent),
      isBalancing: l.isBalancingLine,
      descriptionPattern: l.descriptionPattern ?? '',
      conditionParamKey: l.conditionParamKey ?? '',
      conditionValue: l.conditionValue ?? '',
      amountSource: l.amountSource ?? 1,
      details: l.details.map((d) => ({
        level: d.level,
        source: d.fixedDetailId ? 'fixed' : 'param',
        parameterKey: d.parameterKey ?? '',
        fixedDetailId: d.fixedDetailId ?? '',
        fixedLabel: d.fixedDetailTitle ?? '',
      })),
    })),
  };
}

/**
 * پیش‌نویس الگوی ساخته‌شده از سوابق (ذخیره‌نشده، بدون id) ⇒ مدل طراحی.
 * `labels`: عنوان حساب معین به‌ازای شناسه‌اش (از کارت کشف الگو) تا ردیف‌ها «کد - عنوان» نشان بدهند.
 */
export function fromTemplatePayload(p: TemplateWritePayload, labels: Record<string, string> = {}): DesignModel {
  return {
    id: null,
    code: p.code,
    title: p.title,
    description: p.description ?? '',
    voucherDescriptionPattern: p.voucherDescriptionPattern ?? '',
    systemTypeId: p.systemTypeId ?? null,
    keywords: p.keywords ?? '',
    allowedVahedTypes: p.allowedVahedTypes ?? [],
    isActive: true,
    maxAmount: p.maxAmount ? String(p.maxAmount) : '',
    requireAttachment: p.requireAttachment ?? false,
    riskBase: p.riskBase ?? '',
    category: p.category ?? '',
    plainPattern: p.plainPattern ?? '',
    params: (p.parameters ?? []).map((q) => ({
      uid: newClientId(),
      key: q.key,
      title: q.title,
      type: q.type,
      detailGroupId: q.detailGroupId ?? null,
      isRequired: q.isRequired,
      askPrompt: q.askPrompt,
      options: (q.options ?? []).map((o) => ({ value: o.value, label: o.label })),
    })),
    lines: (p.lines ?? []).map((l) => ({
      uid: newClientId(),
      side: l.side,
      accountId: l.subsidiaryAccountId,
      accountLabel: labels[l.subsidiaryAccountId] ?? '',
      amountParameterKey: l.amountParameterKey ?? '',
      percent: String(l.percent),
      isBalancing: l.isBalancingLine,
      descriptionPattern: l.descriptionPattern ?? '',
      conditionParamKey: l.conditionParamKey ?? '',
      conditionValue: l.conditionValue ?? '',
      amountSource: l.amountSource ?? 1,
      details: (l.details ?? []).map((d) => ({
        level: d.level,
        source: d.fixedDetailId ? 'fixed' : 'param',
        parameterKey: d.parameterKey ?? '',
        fixedDetailId: d.fixedDetailId ?? '',
        fixedLabel: '',
      })),
    })),
  };
}

export function toPayload(m: DesignModel): TemplateWritePayload {
  return {
    code: m.code.trim().toUpperCase(),
    title: m.title.trim(),
    description: m.description.trim(),
    voucherDescriptionPattern: m.voucherDescriptionPattern.trim(),
    systemTypeId: m.systemTypeId || null,
    keywords: m.keywords.trim() || null,
    allowedVahedTypes: m.allowedVahedTypes,
    maxAmount: Number(m.maxAmount) > 0 ? Number(m.maxAmount) : null,
    requireAttachment: m.requireAttachment,
    riskBase: m.riskBase === '' ? null : m.riskBase,
    category: m.category === '' ? null : m.category,
    plainPattern: m.plainPattern.trim() || null,
    parameters: m.params.map((p, i) => ({
      key: p.key.trim(),
      title: p.title.trim(),
      type: p.type,
      detailGroupId: p.type === 2 ? p.detailGroupId : null,
      isRequired: p.isRequired,
      askPrompt: p.askPrompt.trim(),
      sortOrder: i + 1,
      ...(p.type === 5 ? { options: p.options.map((o) => ({ value: o.value.trim(), label: o.label.trim() })) } : {}),
    })),
    lines: m.lines.map((l, i) => ({
      side: l.side,
      subsidiaryAccountId: l.accountId,
      amountParameterKey: l.isBalancing ? null : l.amountParameterKey || null,
      percent: l.isBalancing ? 100 : Number(l.percent || 0),
      isBalancingLine: l.isBalancing,
      descriptionPattern: l.descriptionPattern.trim() || null,
      sortOrder: i + 1,
      conditionParamKey: l.conditionParamKey && l.conditionValue ? l.conditionParamKey : null,
      conditionValue: l.conditionParamKey && l.conditionValue ? l.conditionValue : null,
      amountSource: l.amountSource,
      details: l.details
        .filter((d) => (d.source === 'param' ? !!d.parameterKey : !!d.fixedDetailId))
        .map((d) => ({
          level: d.level,
          parameterKey: d.source === 'param' ? d.parameterKey : null,
          fixedDetailId: d.source === 'fixed' ? d.fixedDetailId : null,
        })),
    })),
  };
}

/** Renaming a question's key must follow it into every line and into the description patterns. */
export function renameKey(m: DesignModel, from: string, to: string): DesignModel {
  const swap = (text: string) => text.split(`{${from}}`).join(`{${to}}`);
  return {
    ...m,
    voucherDescriptionPattern: swap(m.voucherDescriptionPattern),
    plainPattern: swap(m.plainPattern),
    params: m.params.map((p) => (p.key === from ? { ...p, key: to } : p)),
    lines: m.lines.map((l) => ({
      ...l,
      amountParameterKey: l.amountParameterKey === from ? to : l.amountParameterKey,
      conditionParamKey: l.conditionParamKey === from ? to : l.conditionParamKey,
      descriptionPattern: swap(l.descriptionPattern),
      details: l.details.map((d) => (d.parameterKey === from ? { ...d, parameterKey: to } : d)),
    })),
  };
}

/** Where a question is used — a used question cannot be deleted. */
export function usagesOf(m: DesignModel, key: string): number {
  return m.lines.reduce(
    (n, l) => n + (l.amountParameterKey === key && !l.isBalancing ? 1 : 0) + (l.conditionParamKey === key ? 1 : 0) + l.details.filter((d) => d.source === 'param' && d.parameterKey === key).length,
    0,
  );
}

/**
 * Where a question's answer lands in the voucher, in words. Amount/تفصیلی answers feed rows; text and
 * date answers reach the voucher only through `{key}` in the voucher or a row's description pattern.
 */
export function placementsOf(m: DesignModel, key: string): string[] {
  const out: string[] = [];
  const token = `{${key}}`;
  if (m.voucherDescriptionPattern.includes(token)) out.push('شرح سند');
  if (m.plainPattern.includes(token)) out.push('متن ساده');
  m.lines.forEach((l, i) => {
    const row = `ردیف ${i + 1}`;
    if (!l.isBalancing && l.amountParameterKey === key) out.push(`مبلغ ${row}`);
    if (l.conditionParamKey === key) out.push(`شرط ${row}`);
    l.details.filter((d) => d.source === 'param' && d.parameterKey === key).forEach((d) => out.push(`تفصیلی سطح ${d.level} ${row}`));
    if (l.descriptionPattern.includes(token)) out.push(`شرح ${row}`);
  });
  return out;
}

/** Client-side hints shown while designing (the server's validator is still the authority). */
export function quickChecks(m: DesignModel): string[] {
  const out: string[] = [];
  if (!m.title.trim()) out.push('عنوان عملیات را بنویسید.');
  if (!/^[A-Z][A-Z0-9_]{2,49}$/.test(m.code.trim().toUpperCase())) out.push('کد لاتین الگو (مثل BUY_GOODS) را بنویسید.');
  if (!m.description.trim()) out.push('توضیح «چه وقت این عملیات انتخاب شود» را بنویسید.');
  if (!m.voucherDescriptionPattern.trim()) out.push('شرح سند را بنویسید.');
  if (!m.lines.some((l) => l.side === 1) || !m.lines.some((l) => l.side === 2)) out.push('حداقل یک ردیف بدهکار و یک ردیف بستانکار لازم است.');
  m.lines.forEach((l, i) => {
    if (!l.accountId) out.push(`ردیف ${i + 1}: حساب معین را انتخاب کنید.`);
    if (!l.isBalancing && !l.amountParameterKey) out.push(`ردیف ${i + 1}: مبلغ ردیف از کدام سؤال بیاید؟`);
    if (!!l.conditionParamKey !== !!l.conditionValue) out.push(`ردیف ${i + 1}: شرط ردیف ناقص است (سؤال و مقدار هر دو لازم‌اند).`);
  });
  if (m.lines.filter((l) => l.isBalancing).length > 1) out.push('فقط یک ردیف تراز‌کننده مجاز است.');
  m.params.forEach((p) => {
    if (!p.title.trim()) out.push(`سؤال «${p.key}»: عنوان ندارد.`);
    if (!p.askPrompt.trim()) out.push(`سؤال «${p.title || p.key}»: متن سؤال ندارد.`);
    if (p.type === 2 && !p.detailGroupId) out.push(`سؤال «${p.title || p.key}»: گروه تفصیلی را انتخاب کنید.`);
    // An amount/تفصیلی answer no row consumes is a question the user answers for nothing.
    if ((p.type === 1 || p.type === 2) && usagesOf(m, p.key) === 0)
      out.push(`سؤال «${p.title || p.key}» در هیچ ردیفی استفاده نشده؛ حذفش کنید یا به ردیفی وصلش کنید.`);
    if ((p.type === 3 || p.type === 4) && placementsOf(m, p.key).length === 0)
      out.push(`پاسخ «${p.title || p.key}» در سند نمی‌نشیند؛ {${p.key}} را در «شرح سند» یا شرح ردیف بگذارید یا سؤال را حذف کنید.`);
    if (p.type === 5) {
      const filled = p.options.filter((o) => o.value.trim() && o.label.trim());
      if (filled.length === 0) out.push(`سؤال «${p.title || p.key}»: حداقل یک گزینه (مقدار و برچسب) لازم است.`);
      if (filled.length !== p.options.length) out.push(`سؤال «${p.title || p.key}»: گزینهٔ ناقص دارد.`);
      if (new Set(p.options.map((o) => o.value.trim())).size !== p.options.length) out.push(`سؤال «${p.title || p.key}»: مقدار گزینه‌ها تکراری است.`);
      if (placementsOf(m, p.key).length === 0)
        out.push(`سؤال انتخابی «${p.title || p.key}» جایی استفاده نشده؛ آن را شرط یک ردیف کنید یا {${p.key}} را در شرح بگذارید.`);
    }
  });
  if (m.lines.length >= 2 && new Set(m.lines.map((l) => l.side)).size === 1)
    out.unshift(`همهٔ ردیف‌ها ${m.lines[0].side === 1 ? 'بدهکار' : 'بستانکار'}اند؛ سمت یکی از ردیف‌ها را عوض کنید.`);
  return out;
}

// ───────────── نمونه‌های آماده (فقط ساختار؛ معین‌ها را حسابدار انتخاب می‌کند) ─────────────

export interface StarterTemplate {
  title: string;
  code: string;
  keywords: string;
  description: string;
  voucherDescriptionPattern: string;
  /** Questions besides the default «مبلغ» (key `amount`) and «توضیح» (key `note1`). */
  extra: { key: string; title: string; askPrompt: string }[];
  lines: { side: LineSide; hint: string }[];
  category: TemplateCategory;
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    title: 'خرید کالا',
    code: 'BUY_GOODS',
    keywords: `خرید
خریدم
کالا
دارو
تجهیزات
لوازم مصرفی
فاکتور خرید`,
    description: 'وقتی کالا، تجهیزات یا ملزومات (مثلاً در، میز، صندلی، دارو، لوازم مصرفی) برای واحد یا بیمارستان خریده شده و به فروشنده بدهکار شده‌ایم.',
    voucherDescriptionPattern: 'خرید از {supplier} - {note1}',
    extra: [{ key: 'supplier', title: 'فروشنده', askPrompt: 'از چه کسی خریدید؟' }],
    lines: [
      { side: 1, hint: 'موجودی کالا / دارایی / هزینه' },
      { side: 2, hint: 'حساب‌های پرداختنی (فروشنده)' },
    ],
    category: 4,
  },
  {
    title: 'دریافت وجه از مشتری',
    code: 'RECEIVE_FROM_CUSTOMER',
    keywords: `دریافت
گرفتم
واریز کرد
وصول
مشتری پول داد`,
    description: 'وقتی پولی از مشتری یا شخصی دریافت شده و به بانک یا صندوق واریز شده است.',
    voucherDescriptionPattern: 'دریافت از {customer} - {note1}',
    extra: [{ key: 'customer', title: 'پرداخت‌کننده', askPrompt: 'از چه کسی دریافت شد؟' }],
    lines: [
      { side: 1, hint: 'بانک / صندوق' },
      { side: 2, hint: 'حساب‌های دریافتنی' },
    ],
    category: 3,
  },
  {
    title: 'پرداخت به فروشنده',
    code: 'PAY_SUPPLIER',
    keywords: `پرداخت
پرداختم
تسویه
چک دادم
بدهی فروشنده`,
    description: 'وقتی بدهی یک فروشنده یا پیمانکار از بانک پرداخت یا چک داده شده است.',
    voucherDescriptionPattern: 'پرداخت به {supplier} - {note1}',
    extra: [{ key: 'supplier', title: 'دریافت‌کننده', askPrompt: 'به چه کسی پرداخت شد؟' }],
    lines: [
      { side: 1, hint: 'حساب‌های پرداختنی' },
      { side: 2, hint: 'بانک' },
    ],
    category: 2,
  },
  {
    title: 'پرداخت هزینه',
    code: 'PAY_EXPENSE',
    keywords: `هزینه
قبض
آب و برق
تعمیرات
پذیرایی
ایاب و ذهاب`,
    description: 'وقتی هزینه‌ای مثل قبض آب و برق، تعمیرات، ایاب‌وذهاب یا پذیرایی مستقیم از بانک یا صندوق پرداخت شده است.',
    voucherDescriptionPattern: 'پرداخت هزینه - {note1}',
    extra: [],
    lines: [
      { side: 1, hint: 'هزینه' },
      { side: 2, hint: 'بانک / صندوق' },
    ],
    category: 1,
  },
];

/** A starter as a design model: questions and row sides filled, معین left for the accountant. */
export function fromStarter(s: StarterTemplate): DesignModel {
  const base = emptyModel();
  const extra = s.extra.map((e) => newParam(base.params, 2, { key: e.key, title: e.title, askPrompt: e.askPrompt }));
  return {
    ...base,
    title: s.title,
    code: s.code,
    keywords: s.keywords,
    description: s.description,
    voucherDescriptionPattern: s.voucherDescriptionPattern,
    category: s.category,
    params: [base.params[0], ...extra, base.params[1]],
    lines: s.lines.map((l) => ({ ...newLine(l.side, 'amount'), accountLabel: '', descriptionPattern: '', hint: l.hint })),
  };
}
