import { toLatinDigits } from '../../../lib/format/numbers';
import type { FsEntityTbRow } from '../../../types/fsConsolidation';

const HEADERS = ['کد حساب شرکت', 'نام حساب', 'کد معین سازمان', 'طبقه (۱ دارایی/بدهی، ۲ حقوق مالکانه، ۳ سود و زیان)', 'بدهکار ابتدا', 'بستانکار ابتدا', 'بدهکار دوره', 'بستانکار دوره'];

async function save(workbookBuffer: ArrayBuffer, fileName: string) {
  const url = URL.createObjectURL(new Blob([workbookBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** ط-۵ — فایل الگوی تراز شرکت تابعه (با ردیف‌های فعلی اگر باشد). مبالغ به ارز شرکت. */
export async function downloadEntityTbTemplate(rows: FsEntityTbRow[], fileName: string): Promise<void> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('تراز', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });
  sheet.addRow(HEADERS).font = { bold: true };
  for (const r of rows) {
    sheet.addRow([r.sourceAccCode ?? '', r.sourceAccName ?? '', r.accCode, r.accClass, r.openingDebtor, r.openingCreditor, r.periodDebtor, r.periodCreditor]);
  }
  [16, 34, 16, 30, 16, 16, 16, 16].forEach((w, i) => (sheet.getColumn(i + 1).width = w));
  sheet.getColumn(3).numFmt = '@';
  await save(await workbook.xlsx.writeBuffer(), fileName);
}

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'result' in (value as Record<string, unknown>)) return String((value as { result: unknown }).result);
  if (typeof value === 'object' && 'text' in (value as Record<string, unknown>)) return String((value as { text: unknown }).text);
  return toLatinDigits(String(value)).trim();
}

function num(value: unknown): number {
  const t = text(value).replace(/,/g, '').replace(/٬/g, '');
  if (!t) return 0;
  const neg = /^\(.*\)$/.test(t);
  const n = Number(t.replace(/[()]/g, ''));
  return Number.isFinite(n) ? (neg ? -n : n) : NaN;
}

const CLASS_WORDS: Record<string, number> = { دارایی: 1, بدهی: 1, 'دارایی/بدهی': 1, حقوق: 2, 'حقوق مالکانه': 2, سود: 3, 'سود و زیان': 3 };

/** اولین برگه؛ سطر اول سرستون. ستون‌ها به همان ترتیب الگو. سطر بدون «کد معین سازمان» نادیده. */
export async function readEntityTbFile(file: File): Promise<{ rows: FsEntityTbRow[]; errors: string[] }> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  const rows: FsEntityTbRow[] = [];
  const errors: string[] = [];
  if (!sheet) return { rows, errors: ['فایل برگه ندارد.'] };

  sheet.eachRow((row, n) => {
    if (n === 1) return;
    const accCode = text(row.getCell(3).value);
    if (!accCode) return;
    const classText = text(row.getCell(4).value);
    const accClass = Number(classText) || CLASS_WORDS[classText] || 0;
    const values = [5, 6, 7, 8].map((c) => num(row.getCell(c).value));
    if (![1, 2, 3].includes(accClass)) errors.push(`سطر ${n}: طبقهٔ «${classText}» نامعتبر است (۱، ۲ یا ۳).`);
    if (values.some((v) => Number.isNaN(v))) errors.push(`سطر ${n}: مبلغ نامعتبر.`);
    rows.push({
      sourceAccCode: text(row.getCell(1).value) || null,
      sourceAccName: text(row.getCell(2).value) || null,
      accCode,
      accClass,
      openingDebtor: values[0],
      openingCreditor: values[1],
      periodDebtor: values[2],
      periodCreditor: values[3],
    });
  });

  return { rows, errors: errors.slice(0, 10) };
}
