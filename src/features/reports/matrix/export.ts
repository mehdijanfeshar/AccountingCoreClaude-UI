import { matrixLevelLabel, type MatrixLevelValue, type MatrixReportRow } from '../../../types/matrixReport';

export interface MatrixReportContext {
  level: MatrixLevelValue;
  year: string;
  fromDate: string;
  toDate: string;
  unitLabel: string;
  /**
   * The drill-down path the rows were taken from, already formatted — «گروه ۱ ← کل ۱۰».
   * Without it a sheet of معین rows from inside one کل is indistinguishable from a sheet of every
   * معین in the unit.
   */
  scopeLabel: string;
}

/** Jalali YYYYMMDD → YYYY/MM/DD. Display only; the backend never sees this form. */
function formatJalali(value: string): string {
  if (value.length !== 8) return value;
  return `${value.slice(0, 4)}/${value.slice(4, 6)}/${value.slice(6, 8)}`;
}

export function describeMatrixPeriod(context: MatrixReportContext): string {
  if (context.fromDate && context.toDate) {
    return `از ${formatJalali(context.fromDate)} تا ${formatJalali(context.toDate)}`;
  }
  if (context.fromDate) return `از ${formatJalali(context.fromDate)}`;
  if (context.toDate) return `تا ${formatJalali(context.toDate)}`;
  return 'تمام سال';
}

/**
 * Builds the .xlsx.
 *
 * <b>ExcelJS is imported on demand, never at module scope.</b> It is about a megabyte; importing it
 * eagerly would make every page in the app pay for a button most sessions never press. That single
 * fact is why this lives in its own module rather than inside the page component — same reasoning
 * as the trial balance export.
 *
 * The sheet mirrors the on-screen grid: same columns, same order, same totals row. An export that
 * quietly disagrees with the screen it came from is worse than no export.
 */
export async function exportMatrixToExcel(
  rows: MatrixReportRow[],
  context: MatrixReportContext,
): Promise<void> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('گزارش ماتریسی', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 4 }],
  });

  const levelLabel = matrixLevelLabel(context.level);

  sheet.mergeCells('A1:F1');
  sheet.getCell('A1').value = `گزارش ماتریسی — سطح ${levelLabel}`;
  sheet.getCell('A1').font = { bold: true, size: 14 };
  sheet.getCell('A1').alignment = { horizontal: 'center' };

  sheet.mergeCells('A2:F2');
  sheet.getCell('A2').value =
    `واحد: ${context.unitLabel || '—'}   |   سال مالی: ${context.year}   |   دوره: ${describeMatrixPeriod(context)}` +
    (context.scopeLabel ? `   |   مسیر: ${context.scopeLabel}` : '');
  sheet.getCell('A2').alignment = { horizontal: 'center' };

  sheet.addRow([]);

  const header = sheet.addRow(['کد', 'عنوان', 'سطح', 'بدهکار', 'بستانکار', 'مانده بدهکار', 'مانده بستانکار']);
  header.font = { bold: true };
  header.alignment = { horizontal: 'center' };
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.border = { bottom: { style: 'thin' } };
  });

  rows.forEach((row) => {
    sheet.addRow([
      row.code,
      row.name,
      row.levelLabel,
      row.debtor,
      row.creditor,
      row.debtorBalance,
      row.creditorBalance,
    ]);
  });

  const totals = sumMatrixRows(rows);
  const totalRow = sheet.addRow([
    'جمع کل',
    '',
    '',
    totals.debtor,
    totals.creditor,
    totals.debtorBalance,
    totals.creditorBalance,
  ]);
  totalRow.font = { bold: true };
  totalRow.eachCell((cell) => {
    cell.border = { top: { style: 'double' } };
  });

  // Amount columns get a thousands format so the sheet reads like the grid rather than like raw
  // numbers; Excel keeps them numeric and therefore still summable by the recipient.
  ['D', 'E', 'F', 'G'].forEach((column) => {
    sheet.getColumn(column).numFmt = '#,##0';
    sheet.getColumn(column).width = 16;
  });
  sheet.getColumn('A').width = 16;
  sheet.getColumn('B').width = 38;
  sheet.getColumn('C').width = 10;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `matrix-report-${context.year}-${context.level}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * PDF via the browser's own print pipeline — the same deliberate choice the trial balance export
 * documents at length: a JS PDF library does not shape or reorder Persian, so it produces
 * disconnected letters in reverse order. The browser already shapes text correctly, repeats table
 * headers across pages, and writes real selectable text.
 */
export function exportMatrixToPdf(): void {
  window.print();
}

export function sumMatrixRows(rows: MatrixReportRow[]) {
  return rows.reduce(
    (acc, row) => ({
      debtor: acc.debtor + row.debtor,
      creditor: acc.creditor + row.creditor,
      debtorBalance: acc.debtorBalance + row.debtorBalance,
      creditorBalance: acc.creditorBalance + row.creditorBalance,
    }),
    { debtor: 0, creditor: 0, debtorBalance: 0, creditorBalance: 0 },
  );
}
