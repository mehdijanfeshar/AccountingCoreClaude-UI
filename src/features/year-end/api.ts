import { apiClient } from '../../lib/api/client';

export type YearEndKind = 'opening' | 'closing';

export interface YearEndLine {
  accCode: string;
  accName: string | null;
  tafsilis: string | null;
  debtor: number;
  creditor: number;
  /** ردیف حساب رابط که سند را تراز می‌کند. */
  isBalancing: boolean;
}

export interface YearEndVoucher {
  headDesc: string;
  group: string | null;
  lines: YearEndLine[];
  totalDebtor: number;
  totalCreditor: number;
}

export interface YearEndPreview {
  kind: YearEndKind;
  sourceYear: string;
  targetYear: string;
  dateDoc: string;
  vouchers: YearEndVoucher[];
  /** خالی نباشد ⇒ صدور ممکن نیست. */
  problems: string[];
  warnings: string[];
}

export const yearEndApi = {
  preview: (kind: YearEndKind, year: string) =>
    apiClient.get<YearEndPreview>('/year-end-vouchers/preview', { params: { kind, year } }).then((r) => r.data),
  issue: (kind: YearEndKind, year: string) =>
    apiClient.post<{ docNums: string[] }>('/year-end-vouchers/issue', { kind, year }).then((r) => r.data),
};
