import { getDocLifeLabel } from '../../vouchers/api';
import { isVoucherBalanced, type VoucherReviewRow } from '../../../types/voucherReview';

export interface VoucherReviewContext {
  year: string;
  fromDate: string;
  toDate: string;
  unitLabel: string;
  /** Set-wide figures from the server, so the sheet's footer is not a sum of one page. */
  totalDebtor: number;
  totalCreditor: number;
  unbalancedCount: number;
  totalCount: number;
  /** How many rows the sheet actually contains — the current page. */
  exportedCount: number;
}

/** Jalali YYYYMMDD → YYYY/MM/DD. Display only; the backend never sees this form. */
function formatJalali(value: string): string {
  if (value.length !== 8) return value;
  return `${value.slice(0, 4)}/${value.slice(4, 6)}/${value.slice(6, 8)}`;
}

export function describeVoucherReviewPeriod(context: VoucherReviewContext): string {
  if (context.fromDate && context.toDate) {
    return `از ${formatJalali(context.fromDate)} تا ${formatJalali(context.toDate)}`;
  }
  if (context.fromDate) return `از ${formatJalali(context.fromDate)}`;
  if (context.toDate) return `تا ${formatJalali(context.toDate)}`;
  return 'تمام سال';
}

/**
 * Builds the .xlsx for مرور اسناد.
 *
 * <b>ExcelJS is imported on demand, never at module scope.</b> It is about a megabyte; importing it
 * eagerly would make every page in the app pay for a button most sessions never press — the same
 * reasoning as the other report exports.
 *
 * <b>The sheet says what it contains.</b> This report is paged, so the rows exported are the rows
 * on screen. The header states that explicitly and the footer carries the server's whole-set
 * totals, labelled as such. A sheet that showed twenty rows under a total covering nine hundred
 * would be worse than no export at all.
 */
export async function exportVoucherReviewToExcel(
  rows: VoucherReviewRow[],
  context: VoucherReviewContext,
): Promise<void> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('مرور اسناد', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 4 }],
  });

  sheet.mergeCells('A1:H1');
  sheet.getCell('A1').value = 'مرور اسناد';
  sheet.getCell('A1').font = { bold: true, size: 14 };
  sheet.getCell('A1').alignment = { horizontal: 'center' };

  sheet.mergeCells('A2:H2');
  sheet.getCell('A2').value =
    `واحد: ${context.unitLabel || '—'}   |   سال مالی: ${context.year}   |   دوره: ${describeVoucherReviewPeriod(context)}` +
    `   |   ${context.exportedCount} سند از ${context.totalCount} سند`;
  sheet.getCell('A2').alignment = { horizontal: 'center' };

  sheet.addRow([]);

  const header = sheet.addRow([
    'شماره سند',
    'تاریخ',
    'شماره عطف',
    'نوع سند',
    'وضعیت',
    'شرح',
    'بدهکار',
    'بستانکار',
    'تراز',
  ]);
  header.font = { bold: true };
  header.alignment = { horizontal: 'center' };
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.border = { bottom: { style: 'thin' } };
  });

  rows.forEach((row) => {
    sheet.addRow([
      row.voucherNumber,
      formatJalali(row.voucherDate),
      row.atfNo,
      row.systemName,
      getDocLifeLabel(row.docLife),
      row.description,
      row.debtor,
      row.creditor,
      isVoucherBalanced(row) ? 'متوازن' : 'نامتوازن',
    ]);
  });

  const totalRow = sheet.addRow([
    'جمع کل (همهٔ اسناد فیلترشده)',
    '',
    '',
    '',
    '',
    '',
    context.totalDebtor,
    context.totalCreditor,
    context.unbalancedCount === 0 ? 'متوازن' : `${context.unbalancedCount} سند نامتوازن`,
  ]);
  totalRow.font = { bold: true };
  totalRow.eachCell((cell) => {
    cell.border = { top: { style: 'double' } };
  });

  ['G', 'H'].forEach((column) => {
    sheet.getColumn(column).numFmt = '#,##0';
    sheet.getColumn(column).width = 18;
  });
  sheet.getColumn('A').width = 12;
  sheet.getColumn('B').width = 14;
  sheet.getColumn('C').width = 14;
  sheet.getColumn('D').width = 20;
  sheet.getColumn('E').width = 12;
  sheet.getColumn('F').width = 40;
  sheet.getColumn('I').width = 20;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `voucher-review-${context.year}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * PDF via the browser's own print pipeline — the same deliberate choice the other report exports
 * document: a JS PDF library does not shape or reorder Persian, so it produces disconnected
 * letters in reverse order. The browser already shapes text correctly, repeats table headers
 * across pages, and writes real selectable text.
 */
export function exportVoucherReviewToPdf(): void {
  window.print();
}
