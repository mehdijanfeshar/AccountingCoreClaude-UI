import { formatLegacyJalaliDate } from '../../lib/format/dates';
import type { VoucherHeadDto } from '../../types/voucherHead';
import { getDocLifeLabel, voucherHeadsApi, type VoucherHeadListParams } from './api';

/** سقف ردیف‌های خروجی — بیشتر از این را باید با فیلتر کوچک کرد، نه با یک فایل چند ده هزار ردیفی. */
export const VOUCHER_EXPORT_LIMIT = 5000;
const FETCH_PAGE_SIZE = 200;

/**
 * همهٔ اسناد فیلترشدهٔ کارتابل (نه فقط صفحهٔ جاری)، صفحه‌به‌صفحه با سقف سرور (۲۰۰)، تا
 * <see cref="VOUCHER_EXPORT_LIMIT"/>. `truncated` یعنی بیش از سقف بود و فقط ابتدای آن آمده است.
 */
export async function fetchAllVoucherHeads(
  params: Omit<VoucherHeadListParams, 'pageNumber' | 'pageSize'>,
): Promise<{ rows: VoucherHeadDto[]; totalCount: number; truncated: boolean }> {
  const rows: VoucherHeadDto[] = [];
  let totalCount = 0;
  for (let page = 1; rows.length < VOUCHER_EXPORT_LIMIT; page++) {
    const result = await voucherHeadsApi.list({ ...params, pageNumber: page, pageSize: FETCH_PAGE_SIZE });
    totalCount = result.totalCount;
    rows.push(...result.items);
    if (result.items.length < FETCH_PAGE_SIZE || rows.length >= totalCount) break;
  }
  return { rows: rows.slice(0, VOUCHER_EXPORT_LIMIT), totalCount, truncated: totalCount > VOUCHER_EXPORT_LIMIT };
}

export interface VoucherHeadsExportContext {
  /** «واحد ... | سال ... | وضعیت ... | فیلترها» — یک خط توضیح بالای برگه. */
  subtitle: string;
  sysTypeName: (id: string | null) => string;
  year: string;
}

/** خروجی اکسل کارتابل اسناد. ExcelJS فقط هنگام کلیک بارگذاری می‌شود (حدود یک مگابایت). */
export async function exportVoucherHeadsToExcel(rows: VoucherHeadDto[], context: VoucherHeadsExportContext): Promise<void> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('کارتابل اسناد', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 4 }] });

  sheet.mergeCells('A1:I1');
  sheet.getCell('A1').value = 'کارتابل اسناد';
  sheet.getCell('A1').font = { bold: true, size: 14 };
  sheet.getCell('A1').alignment = { horizontal: 'center' };
  sheet.mergeCells('A2:I2');
  sheet.getCell('A2').value = context.subtitle;
  sheet.getCell('A2').alignment = { horizontal: 'center' };
  sheet.addRow([]);

  const header = sheet.addRow(['شماره سند', 'شماره عطف', 'تاریخ سند', 'شرح سند', 'جمع بدهکار', 'جمع بستانکار', 'نوع سند', 'سال مالی', 'وضعیت']);
  header.font = { bold: true };
  header.alignment = { horizontal: 'center' };
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.border = { bottom: { style: 'thin' } };
  });

  let debtor = 0;
  let creditor = 0;
  rows.forEach((row) => {
    debtor += Number(row.totalDebtor ?? 0);
    creditor += Number(row.totalCreditor ?? 0);
    sheet.addRow([
      row.docNum ?? '',
      row.atfNum?.trim() ?? '',
      row.dateDoc ? formatLegacyJalaliDate(row.dateDoc) : '',
      row.headDesc ?? '',
      Number(row.totalDebtor ?? 0),
      Number(row.totalCreditor ?? 0),
      context.sysTypeName(row.systemTypeId),
      row.year ?? '',
      getDocLifeLabel(row.docLife),
    ]);
  });

  const total = sheet.addRow(['جمع', '', '', `${rows.length} سند`, debtor, creditor, '', '', '']);
  total.font = { bold: true };
  total.eachCell((cell) => {
    cell.border = { top: { style: 'double' } };
  });

  ['E', 'F'].forEach((c) => {
    sheet.getColumn(c).numFmt = '#,##0';
    sheet.getColumn(c).width = 18;
  });
  sheet.getColumn('A').width = 12;
  sheet.getColumn('B').width = 22;
  sheet.getColumn('C').width = 13;
  sheet.getColumn('D').width = 45;
  sheet.getColumn('G').width = 20;
  sheet.getColumn('H').width = 10;
  sheet.getColumn('I').width = 14;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `voucher-cartable-${context.year}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
