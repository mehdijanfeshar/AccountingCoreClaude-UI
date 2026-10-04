import type { FsRunRowDto, FsRunStatementDto } from '../../../types/fsRun';

/**
 * متغیرهای متن یادداشت توضیحی (ح-۶، سند منبع §۹): `{{[TPL/]ROW[.cur|.prior|.change|.change%]}}` — مبلغ ردیف از
 * Snapshot اجرا. بدون TPL اول یادداشت عددی پیوسته، سپس صورت‌های اصلی، سپس بقیه. قرینهٔ دقیق
 * `FsNarrativeVariables.cs` سمت سرور (خروجی Word) — هر دو را با هم عوض کنید.
 */
export const VARIABLE_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;

function find(statements: FsRunStatementDto[], tpl: string | null, rowCode: string, linked: string | null): FsRunRowDto | undefined {
  const same = (a: string, b: string | null) => !!b && a.toUpperCase() === b.toUpperCase();
  const inStmt = (s: FsRunStatementDto) => s.rows.find((r) => same(r.code, rowCode));
  const first = (list: FsRunStatementDto[]) => list.map(inStmt).find((r) => r !== undefined);

  if (tpl) return first(statements.filter((s) => same(s.templateCode, tpl)));
  return (
    first(statements.filter((s) => same(s.templateCode, linked))) ??
    first(statements.filter((s) => !s.isNote)) ??
    first(statements)
  );
}

function amount(value: number | null, divisor: number): string {
  if (value === null) return '—';
  const scaled = Math.round(value / (divisor > 0 ? divisor : 1));
  if (scaled === 0) return '—';
  const text = Math.abs(scaled).toLocaleString('fa-IR');
  return scaled < 0 ? `(${text})` : text;
}

export function resolveVariable(token: string, statements: FsRunStatementDto[], linked: string | null, divisor: number): string {
  const t = token.trim();
  const slash = t.indexOf('/');
  const tpl = slash > 0 ? t.slice(0, slash) : null;
  const rest = slash > 0 ? t.slice(slash + 1) : t;
  const dot = rest.indexOf('.');
  const rowCode = dot > 0 ? rest.slice(0, dot) : rest;
  const part = dot > 0 ? rest.slice(dot + 1).toLowerCase() : 'cur';

  const row = find(statements, tpl, rowCode, linked);
  if (!row) return `[؟${t}]`;

  const sign = row.normalBalance === 2 ? -1 : 1;
  const cur = row.amountCur === null ? null : row.amountCur * sign;
  const prv = row.amountPrv === null ? null : row.amountPrv * sign;

  switch (part) {
    case 'cur':
      return amount(cur, divisor);
    case 'prior':
    case 'prv':
      return amount(prv, divisor);
    case 'change':
      return cur === null || prv === null ? '—' : amount(cur - prv, divisor);
    case 'change%':
      return cur === null || prv === null || prv === 0
        ? '—'
        : `${(Math.round(((cur - prv) / Math.abs(prv)) * 1000) / 10).toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}٪`;
    default:
      return `[؟${t}]`;
  }
}

export function replaceVariables(text: string, statements: FsRunStatementDto[], linked: string | null, divisor: number): string {
  return text.replace(VARIABLE_PATTERN, (_, token: string) => resolveVariable(token, statements, linked, divisor));
}
