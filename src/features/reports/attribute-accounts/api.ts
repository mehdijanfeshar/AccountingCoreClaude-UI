import { apiClient } from '../../../lib/api/client';

/**
 * مغایرت‌گیری حساب‌های شناسه‌دار (FINACC-523) — `GET /api/reports/attribute-accounts/*`.
 * ⚠️ بدون `vahedCode`؛ واحد روی هدر `X-Vahed-Code` می‌رود.
 */

/** 1 مانده ≠ ۰، 2 مبالغ جفت نمی‌شوند (جمع‌ناپذیر)، 3 ردیف بی‌شناسه. */
export type AttributeMismatchReason = 1 | 2 | 3;

export const MISMATCH_REASON_LABEL: Record<AttributeMismatchReason, string> = {
  1: 'مانده صفر نیست',
  2: 'مبالغ بدهکار و بستانکار یک‌به‌یک جفت نمی‌شوند',
  3: 'ردیف بدون شناسه',
};

export interface AttributeAccountMoeinDto {
  accountId: string;
  accCode: string;
  accName: string | null;
  /** 1 جمع‌پذیر، 2 جمع‌ناپذیر. */
  attribSum: number;
  debtor: number;
  creditor: number;
  identifierCount: number;
  mismatchCount: number;
  linesWithoutIdentifier: number;
}

export interface AttributeAccountValueDto {
  /** null = ردیف‌های بی‌شناسه. */
  attributeValue: string | null;
  debtor: number;
  creditor: number;
  lineCount: number;
  isMismatch: boolean;
  reason: AttributeMismatchReason | null;
}

export interface AttributeAccountLineDto {
  lineId: string;
  voucherHeadId: string;
  docNum: string | null;
  dateDoc: string | null;
  docLife: number | null;
  headDesc: string | null;
  lineDesc: string | null;
  debtor: number;
  creditor: number;
}

export interface AttributeAccountCriteria {
  year: string;
  fromDate?: string;
  toDate?: string;
  docLife?: number;
}

function params(c: AttributeAccountCriteria, extra: Record<string, string | boolean> = {}) {
  const p: Record<string, string | number | boolean> = { year: c.year, ...extra };
  if (c.fromDate) p.fromDate = c.fromDate;
  if (c.toDate) p.toDate = c.toDate;
  if (c.docLife !== undefined) p.docLife = c.docLife;
  return p;
}

export const attributeAccountsApi = {
  moeins: (c: AttributeAccountCriteria) =>
    apiClient
      .get<AttributeAccountMoeinDto[]>('/reports/attribute-accounts/moeins', { params: params(c) })
      .then((r) => r.data),
  values: (c: AttributeAccountCriteria, accountId: string) =>
    apiClient
      .get<AttributeAccountValueDto[]>('/reports/attribute-accounts/values', { params: params(c, { accountId }) })
      .then((r) => r.data),
  lines: (c: AttributeAccountCriteria, accountId: string, attributeValue: string | null) =>
    apiClient
      .get<AttributeAccountLineDto[]>('/reports/attribute-accounts/lines', {
        params: params(
          c,
          attributeValue === null ? { accountId, withoutIdentifier: true } : { accountId, attributeValue },
        ),
      })
      .then((r) => r.data),
};
