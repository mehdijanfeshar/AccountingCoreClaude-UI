/* ط-۳ تا ط-۸ — تنظیمات مجموعه، حذف فی‌مابین، شرکت‌های تابعه، کاربرگ اجرا و XBRL. */

export const FS_SETTING_KEYS = {
  CashSelector: 'CASH_SELECTOR',
  RestatementSelector: 'RESTATEMENT_SELECTOR',
  XbrlSchemaRef: 'XBRL_SCHEMA_REF',
  XbrlNamespaces: 'XBRL_NAMESPACES',
  XbrlEntityScheme: 'XBRL_ENTITY_SCHEME',
  XbrlEntityId: 'XBRL_ENTITY_ID',
} as const;

export interface FsSettingDto {
  id: string;
  ownerVahedCode: string | null;
  canEdit: boolean;
  framework: number;
  key: string;
  value: string | null;
}

export interface FsElimRuleDto {
  id: string;
  ownerVahedCode: string | null;
  canEdit: boolean;
  framework: number;
  code: string;
  titleFa: string;
  leftSelector: string;
  rightSelector: string;
  tolerance: number;
  isActive: boolean;
}

export interface FsEntityDto {
  id: string;
  code: string;
  titleFa: string;
  currency: string;
  ownership: number;
  isActive: boolean;
}

/** accClass: 1 دارایی/بدهی، 2 حقوق مالکانه، 3 سود و زیان. */
export interface FsEntityTbRow {
  accCode: string;
  sourceAccCode: string | null;
  sourceAccName: string | null;
  accClass: number;
  openingDebtor: number;
  openingCreditor: number;
  periodDebtor: number;
  periodCreditor: number;
}

export interface FsEntityTbDto {
  rows: FsEntityTbRow[];
  openingRate: number | null;
  closingRate: number | null;
  averageRate: number | null;
}

export interface FsXbrlMapDto {
  id: string;
  templateCode: string;
  rowCode: string;
  element: string;
  /** 1 instant، 2 duration. */
  periodType: number;
}

/** kind: 1 واحد، 2 شرکت تابعه، 3 حذفیات. */
export interface FsWorksheetGroupDto {
  code: string;
  name: string | null;
  kind: number;
}

export interface FsWorksheetRowDto {
  templateCode: string;
  statementTitle: string;
  rowId: string;
  rowCode: string;
  titleFa: string | null;
  rowType: number;
  normalBalance: number | null;
  bold: boolean;
  amounts: Record<string, number | null>;
  total: number | null;
}

/** status: 1 تطبیق، 2 در آستانه، 3 عدم تطبیق، 4 طرف مقابل ندارد. */
export interface FsRunElimDto {
  ruleCode: string;
  titleFa: string;
  left: number;
  right: number;
  difference: number;
  status: number;
}

export interface FsWorksheetDto {
  groups: FsWorksheetGroupDto[];
  rows: FsWorksheetRowDto[];
  eliminations: FsRunElimDto[];
}

export const FS_ELIM_STATUS: Record<number, { label: string; color: 'success' | 'info' | 'error' | 'warning' }> = {
  1: { label: 'تطبیق کامل', color: 'success' },
  2: { label: 'در آستانه', color: 'info' },
  3: { label: 'عدم تطبیق', color: 'error' },
  4: { label: 'طرف مقابل ندارد', color: 'warning' },
};

export const FS_ACC_CLASS_OPTIONS = [
  { value: 1, label: 'دارایی / بدهی' },
  { value: 2, label: 'حقوق مالکانه' },
  { value: 3, label: 'سود و زیان' },
] as const;

/** تطبیق فی‌مابین به تفکیک جفت واحد. status: ۱ تطبیق، ۲ در آستانه، ۳ اختلاف، ۴ بدون طرف مقابل، ۵ طرف مقابل نامعلوم. */
export interface FsElimPairDto {
  ruleCode: string;
  ruleTitle: string;
  unitA: string;
  nameA: string | null;
  unitB: string | null;
  nameB: string | null;
  amountA: number;
  amountB: number;
  difference: number;
  status: number;
  /** یک سوی جفت واحد صاحب اجراست (مثلاً ستاد ↔ اداره کل). */
  withRoot: boolean;
}

export interface FsElimPairsDto {
  pairs: FsElimPairDto[];
  /** آستانهٔ مشترک قواعد (اگر همه یکی باشند). */
  tolerance: number | null;
  available: boolean;
  message: string | null;
}

export interface FsElimPairLineDto {
  voucherHeadId: string;
  docNum: string | null;
  dateDoc: string | null;
  vahedCode: string;
  accCode: string;
  counterparty: string | null;
  /** A = از شناسهٔ ردیف، E = از اعلامیه. */
  source: 'A' | 'E' | null;
  attributeValue: string | null;
  lineDesc: string | null;
  debtor: number;
  creditor: number;
}

export const FS_PAIR_STATUS: Record<number, { label: string; color: 'success' | 'info' | 'error' | 'warning' | 'default' }> = {
  1: { label: 'تطبیق', color: 'success' },
  2: { label: 'در آستانه', color: 'info' },
  3: { label: 'اختلاف', color: 'error' },
  4: { label: 'بدون طرف مقابل', color: 'warning' },
  5: { label: 'طرف مقابل نامعلوم', color: 'default' },
};
