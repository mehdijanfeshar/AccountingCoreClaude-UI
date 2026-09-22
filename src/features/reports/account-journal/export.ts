import { getDocLifeLabel } from '../../vouchers/api';
import type { AccountJournalRow } from '../../../types/accountJournal';

export interface AccountJournalContext {
  year: string;
  fromDate: string;
  toDate: string;
  unitLabel: string;
  /** Set-wide totals from the server, so the sheet's footer is not a sum of one page. */
  totalDebtor: number;
  totalCreditor: number;
  totalCount: number;
  /** How many rows the sheet actually contains — the current page. */
  exportedCount: number;
}

/** Jalali YYYYMMDD → YYYY/MM/DD. Display only; the backend never sees this form. */
function formatJalali(value: string): string {
  if (value.length !== 8) return value;
  return `${value.slice(0, 4)}/${value.slice(4, 6)}/${value.slice(6, 8)}`;
}

export function describeAccountJournalPeriod(context: AccountJournalContext): string {
  if (context.fromDate && context.toDate) {
    return `از ${formatJalali(context.fromDate)} تا ${formatJalali(context.toDate)}`;
  }
  if (context.fromDate) return `از ${formatJalali(context.fromDate)}`;
  if (context.toDate) return `تا ${formatJalali(context.toDate)}`;
  return 'تمام سال';
}

/**
 * Builds the .xlsx for دفتر روزنامه.
 *
 * ExcelJS is imported on demand — see the voucher-review export for the full reasoning. As there,
 * the header states how many of the matching lines this sheet actually holds, and the footer's
 * totals are the server's whole-set totals rather than a sum of the exported page.
 */
export async function exportAccountJournalToExcel(
  rows: AccountJournalRow[],
  context: AccountJournalContext,
): Promise<void> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('دفتر روزنامه', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 4 }],
  });

  sheet.mergeCells('A1:G1');
  sheet.getCell('A1').value = 'دفتر روزنامه';
  sheet.getCell('A1').font = { bold: true, size: 14 };
  sheet.getCell('A1').alignment = { horizontal: 'center' };

  sheet.mergeCells('A2:G2');
  sheet.getCell('A2').value =
    `واحد: ${context.unitLabel || '—'}   |   سال مالی: ${context.year}   |   دوره: ${describeAccountJournalPeriod(context)}` +
    `   |   ${context.exportedCount} ردیف از ${context.totalCount} ردیف`;
  sheet.getCell('A2').alignment = { horizontal: 'center' };

  sheet.addRow([]);

  const header = sheet.addRow([
    'شماره سند',
    'تاریخ',
    'کد معین',
    'نام حساب',
    'شرح',
    'وضعیت',
    'بدهکار',
    'بستانکار',
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
      row.accountCode,
      row.accountName,
      row.description,
      getDocLifeLabel(row.docLife),
      row.debtor,
      row.creditor,
    ]);
  });

  const totalRow = sheet.addRow([
    'جمع کل (همهٔ ردیف‌های فیلترشده)',
    '',
    '',
    '',
    '',
    '',
    context.totalDebtor,
    context.totalCreditor,
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
  sheet.getColumn('C').width = 12;
  sheet.getColumn('D').width = 32;
  sheet.getColumn('E').width = 40;
  sheet.getColumn('F').width = 12;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `account-journal-${context.year}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

/** PDF via the browser's own print pipeline — see the voucher-review export for why. */
export function exportAccountJournalToPdf(): void {
  window.print();
}
