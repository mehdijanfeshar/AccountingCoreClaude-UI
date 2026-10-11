import { apiClient } from '../../lib/api/client';
import { toLatinDigits } from '../../lib/format/numbers';

/**
 * اطلاعات تکمیلی ردیف سند: شناسهٔ حساب شناسه‌دار، ویژگی (شناسنامه) تفصیلی/حساب، و فیش واریز بانک.
 * قاعده‌ها سمت سرور هم اجرا می‌شوند (VoucherLineExtrasService) — اینجا فقط برای راهنمایی زودهنگام کاربر.
 */

/** AttribFlag: ۱=عدد، ۲=تاریخ. AttribControl: ۱=غیرصفر، ۲=تاریخ. */
export interface AttributeRequirement {
  definitionId: string;
  boxNo: number;
  flag: number;
  length: number;
  control: number | null;
  accountCode: string;
  accountTitle: string;
}

/** kind: ۱=ثابت، ۲=متغیر. type: ۱=تاریخ، ۲=حروف فارسی، ۳=عدد، ۴=حروف لاتین. */
export interface IdentityFieldInfo {
  subGroupId: string;
  title: string;
  kind: number;
  type: number | null;
  length: number;
}

export interface IdentityRequirement {
  groupId: string;
  title: string;
  tafsiliId: string | null;
  fields: IdentityFieldInfo[];
}

export interface VoucherLineRequirements {
  attributes: AttributeRequirement[];
  identities: IdentityRequirement[];
  isBankAccount: boolean;
}

export interface IdentityHeadOption {
  headId: string;
  serial: number;
  fixedValues: { subGroupId: string; title: string; value: string | null }[];
}

export interface VoucherLineExtrasPayload {
  attributes: { definitionId: string; value: string }[];
  identities: { groupId: string; headId: string | null; values: { subGroupId: string; value: string }[] }[];
  receipt: { kind: number; no: string; date: string } | null;
}

export interface SavedLineExtras {
  attributes: { definitionId: string; value: string | null }[];
  identities: { groupId: string; headId: string | null; values: { subGroupId: string; value: string | null }[] | null }[];
  receiptId: string | null;
  receipt: { kind: number; no: string | null; date: string | null } | null;
}

export const lineExtrasApi = {
  requirements(accountId: string, tafsiliIds: string[], year: string): Promise<VoucherLineRequirements> {
    const params = new URLSearchParams({ accountId, year });
    tafsiliIds.forEach((id) => params.append('tafsiliIds', id));
    return apiClient
      .get<VoucherLineRequirements>(`/voucher-line-extras/requirements?${params}`)
      .then((r) => normalizeRequirements(r.data));
  },
  heads(groupId: string, year: string): Promise<IdentityHeadOption[]> {
    return apiClient
      .get<IdentityHeadOption[]>(`/voucher-line-extras/identity-groups/${groupId}/heads`, { params: { year } })
      .then((r) => (Array.isArray(r.data) ? r.data.map((h) => ({ ...h, fixedValues: Array.isArray(h.fixedValues) ? h.fixedValues : [] })) : []));
  },
  saved(detailId: string): Promise<SavedLineExtras> {
    return apiClient.get<SavedLineExtras>(`/voucher-line-extras/details/${detailId}`).then((r) => r.data);
  },
};

/**
 * پاسخ ناقص/نامنتظره (مثلاً بک‌اندی که هنوز این endpoint را ندارد و صفحهٔ HTML برمی‌گرداند) هرگز نباید
 * صفحه را از کار بیندازد — در بدترین حالت یعنی «چیزی لازم نیست».
 */
function normalizeRequirements(data: unknown): VoucherLineRequirements {
  const d = (data && typeof data === 'object' ? data : {}) as Partial<VoucherLineRequirements>;
  return {
    attributes: Array.isArray(d.attributes) ? d.attributes : [],
    identities: Array.isArray(d.identities)
      ? d.identities.map((g) => ({ ...g, fields: Array.isArray(g.fields) ? g.fields : [] }))
      : [],
    isBankAccount: d.isBankAccount === true,
  };
}

/** فیلدهای فرم ردیف که این بخش لازم دارد (زیرمجموعهٔ VoucherLineFormValue). */
export interface LineExtrasFormFields {
  debtor?: string;
  creditor?: string;
  checkId?: string;
  soriCheckBookId?: string;
  extrasLoaded: boolean;
  extrasReq: VoucherLineRequirements | null;
  attributes: Record<string, string>;
  identities: Record<string, { headId: string; values: Record<string, string> }>;
  receiptKind: string;
  receiptNo: string;
  receiptDate: string;
}

export function emptyLineExtras(): Omit<LineExtrasFormFields, 'debtor'> & { extrasDetailId: string } {
  return {
    extrasLoaded: true,
    extrasDetailId: '',
    extrasReq: null,
    attributes: {},
    identities: {},
    receiptKind: '1',
    receiptNo: '',
    receiptDate: '',
  };
}

export function isDateAttribute(a: AttributeRequirement): boolean {
  return a.flag === 2 || a.control === 2;
}

export function attributeHint(a: AttributeRequirement): string {
  if (isDateAttribute(a)) return 'تاریخ';
  const parts = ['عدد'];
  if (a.length > 0) parts.push(`حداکثر ${a.length} رقم`);
  if (a.control === 1) parts.push('غیرصفر');
  return parts.join('، ');
}

export const IDENTITY_TYPE_LABEL: Record<number, string> = { 1: 'تاریخ', 2: 'حروف فارسی', 3: 'عدد', 4: 'حروف لاتین' };

const PERSIAN_TEXT = /^[؀-ۿ‌\s0-9۰-۹\-_.()/]+$/;
const LATIN_TEXT = /^[A-Za-z\s0-9\-_.()/]+$/;

/**
 * خطای قالب یک فیلد متغیر ویژگی — آینهٔ `IdentityError` سرور (VoucherLineExtrasService)، تا کاربر
 * مثل برنامهٔ مرجع همان‌جا در پنجره خطا را ببیند نه هنگام ذخیرهٔ سند. null یعنی درست یا خالی.
 */
export function identityFieldError(f: IdentityFieldInfo, raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (f.length > 0 && value.length > f.length) return `حداکثر ${f.length} کاراکتر است.`;
  switch (f.type) {
    case 3:
      return /^[0-9]+$/.test(toLatinDigits(value)) ? null : 'فقط عدد مجاز است.';
    case 2:
      return PERSIAN_TEXT.test(value) ? null : 'فقط حروف فارسی مجاز است.';
    case 4:
      return LATIN_TEXT.test(value) ? null : 'فقط حروف لاتین مجاز است.';
    default:
      return null;
  }
}

/** آیا ویژگی یک گروه کامل و درست پر شده (شناسنامه + همهٔ متغیرها بدون خطای قالب). */
export function identityComplete(
  g: IdentityRequirement,
  value: { headId: string; values: Record<string, string> } | undefined,
): boolean {
  if (!value?.headId) return false;
  return g.fields
    .filter((f) => f.kind === 2)
    .every((f) => {
      const v = value.values[f.subGroupId] ?? '';
      return v.trim() !== '' && identityFieldError(f, v) === null;
    });
}

/** آیا ردیف بانک بدهکار (واریز) است؛ فیش/حواله‌اش الزامی است. */
export function canHaveReceipt(line: LineExtrasFormFields): boolean {
  return !!line.extrasReq?.isBankAccount && Number(line.debtor || 0) > 0;
}

/** آیا ردیف بانک بستانکار (برداشت) است؛ برگ چک یا چک صوری‌اش الزامی است. */
export function needsCheque(line: Pick<LineExtrasFormFields, 'extrasReq' | 'creditor'>): boolean {
  return !!line.extrasReq?.isBankAccount && Number(line.creditor || 0) > 0;
}

/** پیام‌های «ناقص است» برای یک ردیف — خالی یعنی کامل. */
export function missingExtras(line: LineExtrasFormFields): string[] {
  const req = line.extrasReq;
  if (!req) return [];
  const out: string[] = [];
  for (const a of req.attributes) {
    if (!line.attributes[a.definitionId]?.trim()) out.push(`شناسهٔ حساب ${a.accountCode}${req.attributes.length > 1 ? ` (${a.boxNo})` : ''}`);
  }
  for (const g of req.identities) {
    const given = line.identities[g.groupId];
    if (!given?.headId) {
      out.push(`شناسنامهٔ ویژگی «${g.title}»`);
      continue;
    }
    for (const f of g.fields.filter((x) => x.kind === 2)) {
      const v = given.values[f.subGroupId] ?? '';
      const formatError = identityFieldError(f, v);
      if (!v.trim()) out.push(`«${f.title}» (ویژگی ${g.title})`);
      else if (formatError) out.push(`«${f.title}» (ویژگی ${g.title}): ${formatError}`);
    }
  }
  // ردیف حساب بانکی بدون مدرک ثبت نمی‌شود (تصمیم صاحب پروژه ۲۰۲۶-۱۰-۰۸؛ سرور هم کنترل می‌کند).
  if (canHaveReceipt(line)) {
    if (!line.receiptNo.trim()) out.push('شمارهٔ فیش/حواله');
    if (!line.receiptDate) out.push('تاریخ فیش/حواله');
  }
  if (needsCheque(line) && !line.checkId && !line.soriCheckBookId) out.push('برگ چک یا چک صوری');
  return out;
}

/**
 * بدنهٔ `extras` برای سرور. null = «دست نزن» (ردیف موجود که هنوز مقادیرش خوانده نشده).
 */
export function lineExtrasPayload(line: LineExtrasFormFields): VoucherLineExtrasPayload | null {
  if (!line.extrasLoaded) return null;
  const req = line.extrasReq;
  const attributeIds = req ? new Set(req.attributes.map((a) => a.definitionId)) : null;
  const groupIds = req ? new Set(req.identities.map((g) => g.groupId)) : null;
  return {
    attributes: Object.entries(line.attributes)
      .filter(([id, v]) => v.trim() && (!attributeIds || attributeIds.has(id)))
      .map(([definitionId, value]) => ({ definitionId, value: toLatinDigits(value.trim()) })),
    identities: Object.entries(line.identities)
      .filter(([id]) => !groupIds || groupIds.has(id))
      .map(([groupId, g]) => ({
        groupId,
        headId: g.headId || null,
        values: Object.entries(g.values)
          .filter(([, v]) => v.trim())
          .map(([subGroupId, value]) => ({ subGroupId, value: value.trim() })),
      })),
    receipt:
      canHaveReceipt(line) && line.receiptNo.trim()
        ? { kind: Number(line.receiptKind) || 1, no: toLatinDigits(line.receiptNo.trim()), date: line.receiptDate }
        : null,
  };
}

/** مقادیر ذخیره‌شده ⇒ فیلدهای فرم. */
export function savedToForm(saved: SavedLineExtras): Pick<LineExtrasFormFields, 'attributes' | 'identities' | 'receiptKind' | 'receiptNo' | 'receiptDate'> {
  const attributes: Record<string, string> = {};
  saved.attributes.forEach((a) => (attributes[a.definitionId] = a.value ?? ''));
  const identities: LineExtrasFormFields['identities'] = {};
  saved.identities.forEach((g) => {
    const values: Record<string, string> = {};
    (g.values ?? []).forEach((v) => (values[v.subGroupId] = v.value ?? ''));
    identities[g.groupId] = { headId: g.headId ?? '', values };
  });
  return {
    attributes,
    identities,
    receiptKind: String(saved.receipt?.kind ?? 1),
    receiptNo: saved.receipt?.no ?? '',
    receiptDate: saved.receipt?.date ?? '',
  };
}
