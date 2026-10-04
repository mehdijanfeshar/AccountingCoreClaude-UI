import { toLatinDigits } from '../../lib/format/numbers';
import type { FsAccountMappingDto, FsMappingAssignment } from '../../types/fsTemplate';

const HEADERS = ['کد معین', 'نام معین', 'کد قالب', 'کد ردیف', 'عنوان ردیف (فقط برای راهنما)', 'پیشنهاد سامانه'];

/**
 * بخش ۴۵-و — فایل Excel نگاشت فعلی برای ویرایش و ورود دوباره: هر معین × هر ردیف صورت اصلی (بدون [D]/[C]) یک
 * سطر؛ معین بی‌نگاشت با قالب/ردیف خالی و ستون «پیشنهاد سامانه». فقط ستون‌های ۱، ۳ و ۴ هنگام ورود خوانده می‌شوند.
 */
export async function downloadMappingTemplate(rows: FsAccountMappingDto[], fileName: string): Promise<void> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('نگاشت حساب‌ها', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });

  sheet.addRow(HEADERS).font = { bold: true };
  for (const m of rows) {
    const main = m.matches.filter((x) => !x.isNote && x.side === null);
    const hint = m.suggestion ? `${m.suggestion.templateCode} / ${m.suggestion.rowCode} — ${m.suggestion.rowTitle ?? ''}` : '';
    if (main.length === 0) sheet.addRow([m.accCode, m.accName ?? '', '', '', '', hint]);
    for (const x of main) sheet.addRow([m.accCode, m.accName ?? '', x.templateCode, x.rowCode, x.rowTitle ?? '', '']);
  }

  [14, 36, 18, 12, 36, 40].forEach((w, i) => (sheet.getColumn(i + 1).width = w));
  sheet.getColumn(1).numFmt = '@';

  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'text' in (value as Record<string, unknown>)) return String((value as { text: unknown }).text);
  if (typeof value === 'object' && 'result' in (value as Record<string, unknown>)) return String((value as { result: unknown }).result);
  return toLatinDigits(String(value)).trim();
}

/**
 * خواندن اولین برگهٔ فایل: سطر اول سرستون است؛ ستون‌ها با عنوان («کد معین»، «کد قالب»، «کد ردیف») پیدا
 * می‌شوند وگرنه ستون‌های ۱، ۳ و ۴ (همان قالب دانلودی). سطرهای بدون قالب یا ردیف نادیده گرفته می‌شوند.
 */
export async function readMappingFile(file: File): Promise<FsMappingAssignment[]> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const header = (sheet.getRow(1).values as unknown[]).map(cellText);
  const find = (title: string, fallback: number) => {
    const i = header.findIndex((h) => h === title);
    return i > 0 ? i : fallback;
  };
  const accCol = find('کد معین', 1);
  const tplCol = find('کد قالب', 3);
  const rowCol = find('کد ردیف', 4);

  const items: FsMappingAssignment[] = [];
  sheet.eachRow((row, n) => {
    if (n === 1) return;
    const accCode = cellText(row.getCell(accCol).value);
    const templateCode = cellText(row.getCell(tplCol).value);
    const rowCode = cellText(row.getCell(rowCol).value);
    if (accCode && templateCode && rowCode) items.push({ accCode, templateCode, rowCode });
  });
  return items;
}

/** سطرهایی که با نگاشت فعلی فرقی ندارند کنار می‌روند تا فقط تغییرها به سرور برود. */
export function onlyChanges(items: FsMappingAssignment[], current: FsAccountMappingDto[]): FsMappingAssignment[] {
  const byAcc = new Map(current.map((m) => [m.accCode, m]));
  return items.filter((i) => {
    const m = byAcc.get(i.accCode);
    return !m?.matches.some(
      (x) => !x.isNote && x.side === null && x.templateCode.toUpperCase() === i.templateCode.toUpperCase() && x.rowCode.toUpperCase() === i.rowCode.toUpperCase(),
    ) || (m?.doubleCounted ?? false);
  });
}
