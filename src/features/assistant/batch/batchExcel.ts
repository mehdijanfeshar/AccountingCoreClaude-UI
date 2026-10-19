import { tafsiliApi } from '../../chart-of-accounts/api';
import { normalizeNumericInput, toLatinDigits, toPersianDigits } from '../../../lib/format/numbers';
import { DATE_KEY, orderedParameters, voucherDateKey } from '../assistantState';
import { jalaliToGregorian } from '../draftMapping';
import type { OperationInput, TemplateParameterDto, TemplateSummaryDto } from '../types';
import type { TafsiliLookupItemDto } from '../../../types/tafsili';

/**
 * ثبت گروهی حسابیار از اکسل: هر سطر فایل = جواب سؤال‌های یک الگو. فایل نمونه از روی سؤال‌های الگو ساخته
 * می‌شود؛ تفصیلی‌ها با «کد» نوشته می‌شوند و برای هرکدام یک برگهٔ فهرست (همان قاعدهٔ دید واحد) کنار فایل است.
 * سند را همیشه سرور از الگو می‌سازد — اینجا فقط سطر به جواب تبدیل می‌شود.
 */

export interface BatchColumn {
  /** کلید پارامتر الگو، یا {@link DATE_KEY} برای «تاریخ سند» وقتی الگو سؤال تاریخ ندارد. */
  key: string;
  header: string;
  /** عنوان یکتای سؤال (برای نام برگه و پیام‌ها). */
  label: string;
  type: 1 | 2 | 3 | 4 | 5;
  parameter: TemplateParameterDto | null;
  required: boolean;
}

export interface DetailList {
  levelId: string;
  items: TafsiliLookupItemDto[];
}

export interface BatchRow {
  /** شمارهٔ سطر در اکسل (برای پیام‌ها). */
  rowNo: number;
  raw: Record<string, string>;
  input: OperationInput | null;
  /** عنوان تفصیلی‌ها برای نمایش. */
  labels: Record<string, string>;
  problems: string[];
}

const MAX_LIST_PAGES = 10; // ۲۰۰۰ تفصیلی در برگهٔ فهرست؛ بیشتر از آن با جستجوی کد پیدا می‌شود

export function batchColumns(template: TemplateSummaryDto): BatchColumn[] {
  const cols: BatchColumn[] = [];
  if (voucherDateKey(template) === DATE_KEY) {
    cols.push({ key: DATE_KEY, header: 'تاریخ سند (۱۴۰۴/۰۷/۰۱)', label: 'تاریخ سند', type: 4, parameter: null, required: true });
  }
  // دو سؤال هم‌عنوان (مثلاً دو «سطح 1») باید سرستون و برگهٔ جدا داشته باشند — فایل با عنوان سرستون خوانده می‌شود.
  const seen = new Map<string, number>();
  for (const p of orderedParameters(template)) {
    const n = (seen.get(p.title) ?? 0) + 1;
    seen.set(p.title, n);
    const label = n === 1 ? p.title : `${p.title} ${toPersianDigits(n)}`;
    const header = p.type === 2 ? `${label} (کد)` : p.type === 4 ? `${label} (۱۴۰۴/۰۷/۰۱)` : p.type === 1 ? `${label} (ریال)` : label;
    cols.push({ key: p.key, header, label, type: p.type, parameter: p, required: p.isRequired });
  }
  return cols;
}

/** فهرست تفصیلی‌های قابل انتخاب یک سؤال (همان معین/سطح الگو و قاعدهٔ دید واحد). */
export async function loadDetailList(p: TemplateParameterDto): Promise<DetailList | null> {
  if (!p.pickerAccountId || p.pickerLevel === null) return null;
  const level = (await tafsiliApi.getLevels(p.pickerAccountId)).find((l) => l.code === p.pickerLevel);
  if (!level) return null;
  const items: TafsiliLookupItemDto[] = [];
  for (let page = 1; page <= MAX_LIST_PAGES; page++) {
    const res = await tafsiliApi.getLevelItems(p.pickerAccountId, level.levelId, { pageNumber: page, pageSize: 200 });
    items.push(...res.items);
    if (items.length >= res.totalCount || res.items.length === 0) break;
  }
  return { levelId: level.levelId, items };
}

async function findDetailByCode(p: TemplateParameterDto, list: DetailList, code: string): Promise<TafsiliLookupItemDto | null> {
  const hit = list.items.find((i) => toLatinDigits(i.tafsiliCode ?? '') === code);
  if (hit || !p.pickerAccountId) return hit ?? null;
  const res = await tafsiliApi.getLevelItems(p.pickerAccountId, list.levelId, { search: code, pageNumber: 1, pageSize: 20 });
  return res.items.find((i) => toLatinDigits(i.tafsiliCode ?? '') === code) ?? null;
}

function sheetName(title: string): string {
  return `فهرست ${title}`.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
}

export async function downloadBatchTemplate(template: TemplateSummaryDto, lists: Record<string, DetailList | null>): Promise<void> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const cols = batchColumns(template);
  const sheet = workbook.addWorksheet('ورود اطلاعات', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });
  sheet.addRow(cols.map((c) => c.header));
  sheet.getRow(1).font = { bold: true };
  cols.forEach((c, i) => {
    const col = sheet.getColumn(i + 1);
    col.width = Math.max(16, c.header.length + 4);
    if (c.type !== 1) col.numFmt = '@'; // کد و تاریخ شمسی متن بمانند (صفرهای اول، «/»)
    if (c.required) sheet.getCell(1, i + 1).note = 'الزامی';
  });

  const usedSheets = new Set<string>(['ورود اطلاعات']);
  for (const c of cols.filter((x) => x.type === 2 && x.parameter)) {
    const list = lists[c.key];
    if (!list) continue;
    let name = sheetName(c.label);
    for (let i = 2; usedSheets.has(name); i++) name = sheetName(`${c.label} ${i}`);
    usedSheets.add(name);
    const ref = workbook.addWorksheet(name, { views: [{ rightToLeft: true }] });
    ref.addRow(['کد', 'عنوان']);
    ref.getRow(1).font = { bold: true };
    list.items.forEach((i) => ref.addRow([i.tafsiliCode ?? '', i.tafsiliName ?? '']));
    ref.getColumn(1).width = 18;
    ref.getColumn(2).width = 40;
    ref.getColumn(1).numFmt = '@';
    if (list.items.length > 0) {
      const colIndex = cols.indexOf(c) + 1;
      for (let r = 2; r <= 1000; r++) {
        sheet.getCell(r, colIndex).dataValidation = {
          type: 'list',
          allowBlank: true,
          showErrorMessage: false,
          formulae: [`'${name}'!$A$2:$A$${list.items.length + 1}`],
        };
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `batch-${template.code}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return '';
  if (typeof value === 'object' && 'text' in (value as Record<string, unknown>)) return toLatinDigits(String((value as { text: unknown }).text)).trim();
  if (typeof value === 'object' && 'result' in (value as Record<string, unknown>)) return toLatinDigits(String((value as { result: unknown }).result)).trim();
  return toLatinDigits(String(value)).trim();
}

/** `1404/7/1`، `1404/07/01` یا `14040701` ⇒ `14040701`؛ نامعتبر ⇒ null. */
function parseJalali(text: string): string | null {
  const t = text.replace(/[-.]/g, '/');
  const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(t) ?? /^(\d{4})(\d{2})(\d{2})$/.exec(t);
  if (!m) return null;
  const v = `${m[1]}${m[2].padStart(2, '0')}${m[3].padStart(2, '0')}`;
  return jalaliToGregorian(v) ? v : null;
}

/** سطر اول سرستون است؛ ستون‌ها با عنوان پیدا می‌شوند (ترتیب مهم نیست). سطرهای کاملاً خالی نادیده. */
export async function readBatchFile(file: File, cols: BatchColumn[]): Promise<{ rows: Record<string, string>[]; rowNos: number[]; missingHeaders: string[] }> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  const headerIndex = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, n) => headerIndex.set(cellText(cell.value), n));
  const norm = (s: string) => toLatinDigits(s).trim();
  const colIndex = new Map(cols.map((c) => [c.key, headerIndex.get(norm(c.header)) ?? headerIndex.get(norm(c.parameter?.title ?? c.header))]));
  const missingHeaders = cols.filter((c) => colIndex.get(c.key) === undefined).map((c) => c.header);

  const rows: Record<string, string>[] = [];
  const rowNos: number[] = [];
  sheet.eachRow((row, n) => {
    if (n === 1) return;
    const raw: Record<string, string> = {};
    for (const c of cols) {
      const i = colIndex.get(c.key);
      raw[c.key] = i ? cellText(row.getCell(i).value) : '';
    }
    if (Object.values(raw).every((v) => !v)) return;
    rows.push(raw);
    rowNos.push(n);
  });
  return { rows, rowNos, missingHeaders };
}

/** یک سطر خام ⇒ ورودی Preview/Execute (تاریخ میلادی، مبلغ عدد، تفصیلی Guid). */
export async function toBatchRow(
  template: TemplateSummaryDto,
  cols: BatchColumn[],
  lists: Record<string, DetailList | null>,
  raw: Record<string, string>,
  rowNo: number,
  fallbackDate: string,
): Promise<BatchRow> {
  const problems: string[] = [];
  const labels: Record<string, string> = {};
  const values: Record<string, string | null> = {};
  let voucherDate: string | null = null;
  const dateKey = voucherDateKey(template);

  for (const c of cols) {
    const text = raw[c.key] ?? '';
    if (!text) {
      if (c.type === 4 && c.key === dateKey) voucherDate = fallbackDate; // بدون تاریخ ⇒ تاریخ پیش‌فرض صفحه
      else if (c.required) problems.push(`«${c.label}» خالی است.`);
      continue;
    }
    switch (c.type) {
      case 1: {
        const n = Number(normalizeNumericInput(text).replace(/[,،٬\s]/g, ''));
        if (!Number.isInteger(n) || n <= 0) problems.push(`مبلغ «${text}» عدد صحیح مثبت نیست.`);
        else values[c.key] = String(n);
        break;
      }
      case 2: {
        const list = lists[c.key];
        const hit = list ? await findDetailByCode(c.parameter!, list, text) : null;
        if (!hit) problems.push(`کد «${text}» در فهرست «${c.label}» پیدا نشد.`);
        else {
          values[c.key] = hit.id;
          labels[c.key] = hit.label;
        }
        break;
      }
      case 4: {
        const j = parseJalali(text);
        if (!j) problems.push(`تاریخ «${text}» معتبر نیست (نمونه: ۱۴۰۴/۰۷/۰۱).`);
        else if (c.key === dateKey) voucherDate = j;
        if (j && c.key !== DATE_KEY) values[c.key] = jalaliToGregorian(j);
        break;
      }
      case 5: {
        // سؤال انتخابی: برچسب یا مقدار گزینه؛ «نمی‌دانم» ⇒ unknown.
        const t = text.trim();
        const opt = c.parameter?.options?.find((o) => o.label === t || o.value === t);
        if (opt) values[c.key] = opt.value;
        else if (t === 'نمی‌دانم' || t === 'unknown') values[c.key] = 'unknown';
        else problems.push(`گزینهٔ «${text}» برای «${c.label}» تعریف نشده است.`);
        break;
      }
      default:
        values[c.key] = text;
    }
  }
  return {
    rowNo,
    raw,
    labels,
    problems,
    input: problems.length ? null : { voucherDate: jalaliToGregorian(voucherDate ?? fallbackDate), values },
  };
}

/** اجرای حداکثر `limit` کار هم‌زمان، با حفظ ترتیب نتیجه. */
export async function runPool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
