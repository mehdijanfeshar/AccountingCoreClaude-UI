import { getLedgerRowTypeLabel } from './pettyCashLedgerRowType';
import type { PettyCashFundLedgerDto } from '../../types/pettyCash';

export interface PettyCashLedgerExportContext {
  fundLabel: string;
  fromDate: string;
  toDate: string;
}

/** Jalali YYYYMMDD → YYYY/MM/DD. Display only. */
function formatJalali(value: string): string {
  if (value.length !== 8) return value;
  return `${value.slice(0, 4)}/${value.slice(4, 6)}/${value.slice(6, 8)}`;
}

/**
 * خروجی Excel گزارش گردش تنخواه — همان الگوی `features/reports/account-journal/export.ts`
 * (ExcelJS به‌صورت on-demand import می‌شود). ردیف «مانده ابتدای بازه» و «مانده پایان بازه» هم به
 * شیت اضافه می‌شوند، دقیقاً مثل چیزی که خودِ صفحه نشان می‌دهد.
 */
export async function exportPettyCashLedgerToExcel(
  ledger: PettyCashFundLedgerDto,
  context: PettyCashLedgerExportContext,
): Promise<void> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('گردش تنخواه', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 4 }],
  });

  sheet.mergeCells('A1:F1');
  sheet.getCell('A1').value = 'گزارش گردش تنخواه';
  sheet.getCell('A1').font = { bold: true, size: 14 };
  sheet.getCell('A1').alignment = { horizontal: 'center' };

  sheet.mergeCells('A2:F2');
  const period =
    context.fromDate && context.toDate
      ? `از ${formatJalali(context.fromDate)} تا ${formatJalali(context.toDate)}`
      : context.fromDate
        ? `از ${formatJalali(context.fromDate)}`
        : context.toDate
          ? `تا ${formatJalali(context.toDate)}`
          : 'تمام بازه';
  sheet.getCell('A2').value = `تنخواه: ${context.fundLabel}   |   دوره: ${period}`;
  sheet.getCell('A2').alignment = { horizontal: 'center' };

  sheet.addRow([]);

  const header = sheet.addRow(['تاریخ', 'نوع', 'شرح', 'مرجع', 'دریافت', 'پرداخت', 'مانده']);
  header.font = { bold: true };
  header.alignment = { horizontal: 'center' };
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.border = { bottom: { style: 'thin' } };
  });

  sheet.addRow(['', '', 'مانده ابتدای بازه', '', '', '', ledger.openingBalance]);

  ledger.rows.forEach((row) => {
    sheet.addRow([
      formatJalali(row.date),
      getLedgerRowTypeLabel(row.type),
      row.description ?? '',
      row.reference,
      row.receipt ?? '',
      row.payment ?? '',
      row.balance,
    ]);
  });

  const closingRow = sheet.addRow(['', '', 'مانده پایان بازه', '', ledger.totalReceipt, ledger.totalPayment, ledger.closingBalance]);
  closingRow.font = { bold: true };
  closingRow.eachCell((cell) => {
    cell.border = { top: { style: 'double' } };
  });

  ['E', 'F', 'G'].forEach((column) => {
    sheet.getColumn(column).numFmt = '#,##0';
    sheet.getColumn(column).width = 16;
  });
  sheet.getColumn('A').width = 12;
  sheet.getColumn('B').width = 14;
  sheet.getColumn('C').width = 34;
  sheet.getColumn('D').width = 16;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'petty-cash-ledger.xlsx';
  link.click();
  URL.revokeObjectURL(url);
}
