import { buildColumnGroups, type TrialBalanceTotals } from './columns';
import {
  TRIAL_BALANCE_LEVEL_LABELS,
  type TrialBalanceLevel,
  type TrialBalanceRow,
  type TrialBalanceVariant,
} from '../../../types/trialBalance';

export interface ReportContext {
  variant: TrialBalanceVariant;
  level: TrialBalanceLevel;
  year: string;
  fromDate: string;
  toDate: string;
  docLifeLabel: string;
  codeFilter: string;
  unitLabel: string;
}

/** Jalali YYYYMMDD → YYYY/MM/DD. Display only; the backend never sees this form. */
function formatJalali(value: string): string {
  if (value.length !== 8) return value;
  return `${value.slice(0, 4)}/${value.slice(4, 6)}/${value.slice(6, 8)}`;
}

export function describePeriod(context: ReportContext): string {
  if (context.fromDate && context.toDate) {
    return `از ${formatJalali(context.fromDate)} تا ${formatJalali(context.toDate)}`;
  }
  if (context.fromDate) return `از ${formatJalali(context.fromDate)}`;
  if (context.toDate) return `تا ${formatJalali(context.toDate)}`;
  return 'تمام سال';
}

export function buildFileName(context: ReportContext): string {
  const parts = ['trial-balance', String(context.variant), context.year];
  if (context.fromDate) parts.push(context.fromDate);
  if (context.toDate) parts.push(context.toDate);
  return parts.join('-');
}

/**
 * Builds the .xlsx.
 *
 * <b>Loaded on demand, never at startup.</b> ExcelJS is around a megabyte; importing it at module
 * scope would make every page in the app pay for a button most sessions never press. The dynamic
 * import here is the reason this is a separate module from the page.
 *
 * The sheet mirrors the on-screen grid deliberately — same column order, same grouped header, same
 * totals row — because an export that quietly disagrees with the screen it came from is worse than
 * no export: nobody notices until they reconcile a printed page against the app.
 */
export async function exportToExcel(
  rows: TrialBalanceRow[],
  totals: TrialBalanceTotals,
  context: ReportContext,
): Promise<void> {
  const ExcelJS = await import('exceljs');

  const groups = buildColumnGroups(context.variant);
  const leaves = groups.flatMap((g) => g.columns);

  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('تراز آزمایشی', {
    // Right-to-left sheet: Excel mirrors column order and gridlines. Without this the report
    // opens looking like a mistake to a Persian reader.
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 6 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const columnCount = leaves.length + 2;

  // --- Title block -------------------------------------------------------------------------
  const title = sheet.addRow([`تراز آزمایشی ${context.variant} ستونی`]);
  title.font = { bold: true, size: 14 };
  sheet.mergeCells(1, 1, 1, columnCount);
  title.alignment = { horizontal: 'center' };

  const meta = sheet.addRow([
    `واحد: ${context.unitLabel || '—'}   |   سال مالی: ${context.year}   |   دوره: ${describePeriod(context)}`,
  ]);
  sheet.mergeCells(2, 1, 2, columnCount);
  meta.alignment = { horizontal: 'center' };
  meta.font = { size: 10 };

  const meta2 = sheet.addRow([
    `سطح: ${TRIAL_BALANCE_LEVEL_LABELS[context.level]}   |   وضعیت سند: ${context.docLifeLabel}` +
      (context.codeFilter ? `   |   فیلتر کد: ${context.codeFilter}` : ''),
  ]);
  sheet.mergeCells(3, 1, 3, columnCount);
  meta2.alignment = { horizontal: 'center' };
  meta2.font = { size: 10 };

  sheet.addRow([]);

  // --- Grouped header ----------------------------------------------------------------------
  const groupRowIndex = 5;
  const leafRowIndex = 6;

  const groupCells: string[] = ['کد حساب', 'شرح حساب'];
  groups.forEach((group) => {
    group.columns.forEach((_, i) => groupCells.push(i === 0 ? group.label : ''));
  });
  sheet.addRow(groupCells);

  const leafCells: string[] = ['', ''];
  groups.forEach((group) => group.columns.forEach((c) => leafCells.push(c.shortHeader)));
  sheet.addRow(leafCells);

  sheet.mergeCells(groupRowIndex, 1, leafRowIndex, 1);
  sheet.mergeCells(groupRowIndex, 2, leafRowIndex, 2);

  let cursor = 3;
  groups.forEach((group) => {
    sheet.mergeCells(groupRowIndex, cursor, groupRowIndex, cursor + group.columns.length - 1);
    cursor += group.columns.length;
  });

  [groupRowIndex, leafRowIndex].forEach((rowIndex) => {
    const row = sheet.getRow(rowIndex);
    row.font = { bold: true };
    row.alignment = { horizontal: 'center', vertical: 'middle' };
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  });

  // --- Data --------------------------------------------------------------------------------
  rows.forEach((row) => {
    const values: (string | number)[] = [row.code, row.description ?? ''];
    leaves.forEach((column) => values.push(column.get(row) ?? 0));

    const added = sheet.addRow(values);
    added.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = { bottom: { style: 'hair' } };
      if (colNumber > 2) {
        // Numbers stay numbers. Pre-formatting them as text is the classic way an "Excel export"
        // arrives unable to be summed, which defeats the point of exporting to Excel at all.
        cell.numFmt = '#,##0;[Red]-#,##0';
      }
    });
  });

  // --- Totals ------------------------------------------------------------------------------
  const totalValues: (string | number)[] = [`جمع کل (${rows.length} حساب)`, ''];
  leaves.forEach((column) => totalValues.push(column.total(totals)));

  const totalRow = sheet.addRow(totalValues);
  sheet.mergeCells(totalRow.number, 1, totalRow.number, 2);
  totalRow.font = { bold: true };
  totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.border = { top: { style: 'double' }, bottom: { style: 'thin' } };
    if (colNumber > 2) cell.numFmt = '#,##0;[Red]-#,##0';
  });

  sheet.getColumn(1).width = 16;
  sheet.getColumn(2).width = 34;
  for (let i = 3; i <= columnCount; i++) sheet.getColumn(i).width = 16;

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${buildFileName(context)}.xlsx`,
  );
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * PDF is produced through the browser's own print pipeline rather than a PDF library, and that is
 * a deliberate choice rather than a shortcut.
 *
 * Persian is right-to-left and cursive: every letter changes shape depending on its neighbours.
 * jsPDF, pdfmake and their table plugins embed a font but do none of that shaping or bidi
 * reordering, so Persian arrives as disconnected letters in reverse order — technically a PDF,
 * useless as a report. The workarounds (arabic-reshaper + bidi preprocessing) are fragile and break
 * on mixed digits, which this report is full of. Rasterising the DOM with html2canvas avoids the
 * shaping problem by turning the page into a picture, at the cost of selectable text, searchable
 * content and crisp printing — exactly what a financial report needs to keep.
 *
 * The browser already shapes and reorders Persian correctly, paginates tables with repeating
 * headers, and writes a real PDF with selectable text. "Save as PDF" in the print dialog is that
 * pipeline. The print stylesheet in `printStyles.ts` is what makes the output look like a report
 * rather than a screenshot of an app.
 */
export function exportToPdf(): void {
  window.print();
}
