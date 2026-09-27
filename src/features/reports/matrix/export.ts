import {
  cellsByColumn,
  matrixDimensionLabel,
  type MatrixResult,
} from '../../../types/matrixReport';

export interface MatrixReportContext {
  year: string;
  fromDate: string;
  toDate: string;
  unitLabel: string;
  /** «شروع با» narrowings, already formatted — or '' when neither axis was narrowed. */
  filterLabel: string;
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
 * fact is why this lives in its own module rather than inside the page component.
 *
 * <b>Why this could not be copied from the matrix export.</b> There the sheet has a fixed seven
 * columns and one header row, so the whole layout is literal. Here the column set comes from the
 * data: the header is two rows deep (each dimension value spanning its own بدهکار/بستانکار pair),
 * every merge and every column width is computed, and cells are addressed by number rather than by
 * letter because a wide pivot runs past column Z.
 *
 * The sheet mirrors the on-screen grid: same columns, same order, same totals — including the
 * truncation notice, which must travel with the file. A sheet that silently drops the caveat the
 * screen carried is exactly the "truncated report that looks complete" the backend refused to
 * produce.
 */
export async function exportMatrixToExcel(
  result: MatrixResult,
  context: MatrixReportContext,
): Promise<void> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();

  const rowLabel = matrixDimensionLabel(result.rowDimension);
  const columnLabel = matrixDimensionLabel(result.columnDimension);

  const sheet = workbook.addWorksheet('گزارش ماتریسی', {
    // Freeze both ways: the two row-identity columns and the two header rows. On a pivot this is
    // not a nicety — scrolled to the middle of a wide grid, an unfrozen sheet shows numbers with
    // neither a row nor a column label in view.
    views: [{ rightToLeft: true, state: 'frozen', xSplit: 2, ySplit: 5 }],
  });

  /** 1-based column index of the بدهکار cell for the i-th data column. */
  const amountStart = (index: number) => 3 + index * 2;
  const totalStart = amountStart(result.columns.length);
  const lastColumn = totalStart + 1;

  sheet.mergeCells(1, 1, 1, lastColumn);
  sheet.getCell(1, 1).value = `گزارش ماتریسی — سطر: ${rowLabel} × ستون: ${columnLabel}`;
  sheet.getCell(1, 1).font = { bold: true, size: 14 };
  sheet.getCell(1, 1).alignment = { horizontal: 'center' };

  sheet.mergeCells(2, 1, 2, lastColumn);
  sheet.getCell(2, 1).value =
    `واحد: ${context.unitLabel || '—'}   |   سال مالی: ${context.year}   |   دوره: ${describeMatrixPeriod(context)}` +
    (context.filterLabel ? `   |   ${context.filterLabel}` : '');
  sheet.getCell(2, 1).alignment = { horizontal: 'center' };

  // The caveat, in the sheet itself. `columnsTruncated` means the grand totals cover the whole
  // filtered set while the visible columns do not, so the two deliberately disagree.
  sheet.mergeCells(3, 1, 3, lastColumn);
  if (result.columnsTruncated) {
    sheet.getCell(3, 1).value =
      `⚠️ از ${result.totalColumnCount} ستون، تنها ${result.columns.length} ستون پرگردش‌تر نمایش داده شده است.` +
      ' جمع کل، کل دادهٔ فیلترشده را پوشش می‌دهد و با جمع ستون‌های همین برگه برابر نیست.';
    sheet.getCell(3, 1).font = { bold: true, color: { argb: 'FFB91C1C' } };
    sheet.getCell(3, 1).alignment = { horizontal: 'center', wrapText: true };
    sheet.getRow(3).height = 28;
  }

  const headerTop = sheet.getRow(4);
  const headerBottom = sheet.getRow(5);

  sheet.mergeCells(4, 1, 5, 1);
  sheet.getCell(4, 1).value = `کد ${rowLabel}`;
  sheet.mergeCells(4, 2, 5, 2);
  sheet.getCell(4, 2).value = `عنوان ${rowLabel}`;

  result.columns.forEach((column, index) => {
    const start = amountStart(index);
    sheet.mergeCells(4, start, 4, start + 1);
    sheet.getCell(4, start).value = column.name ? `${column.code} — ${column.name}` : column.code;
    headerBottom.getCell(start).value = 'بدهکار';
    headerBottom.getCell(start + 1).value = 'بستانکار';
  });

  sheet.mergeCells(4, totalStart, 4, totalStart + 1);
  sheet.getCell(4, totalStart).value = 'جمع سطر';
  headerBottom.getCell(totalStart).value = 'بدهکار';
  headerBottom.getCell(totalStart + 1).value = 'بستانکار';

  [headerTop, headerBottom].forEach((row) => {
    row.font = { bold: true };
    row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    for (let column = 1; column <= lastColumn; column += 1) {
      row.getCell(column).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' },
      };
      row.getCell(column).border = { bottom: { style: 'thin' }, left: { style: 'hair' } };
    }
  });
  headerTop.height = 32;

  result.rows.forEach((row) => {
    const lookup = cellsByColumn(row);
    const values: (string | number | null)[] = [row.code, row.name];

    result.columns.forEach((column) => {
      const cell = lookup.get(column.code);
      // A missing intersection is a real zero, but writing 0 into every empty cell of a sparse grid
      // buries the populated ones. Blank keeps the sheet readable and still sums correctly.
      values.push(cell && cell.debtor !== 0 ? cell.debtor : null);
      values.push(cell && cell.creditor !== 0 ? cell.creditor : null);
    });

    values.push(row.debtor, row.creditor);
    sheet.addRow(values);
  });

  const totalValues: (string | number | null)[] = [`جمع ستون (${result.rows.length} سطر)`, ''];
  result.columns.forEach((column) => {
    totalValues.push(column.debtor, column.creditor);
  });
  totalValues.push(result.debtor, result.creditor);

  const totalRow = sheet.addRow(totalValues);
  totalRow.font = { bold: true };
  for (let column = 1; column <= lastColumn; column += 1) {
    totalRow.getCell(column).border = { top: { style: 'double' } };
  }

  sheet.getColumn(1).width = 18;
  sheet.getColumn(2).width = 34;
  for (let column = 3; column <= lastColumn; column += 1) {
    sheet.getColumn(column).numFmt = '#,##0';
    sheet.getColumn(column).width = 15;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `matrix-report-${context.year}-${result.rowDimension}x${result.columnDimension}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * PDF via the browser's own print pipeline — the same deliberate choice the other report exports
 * document: a JS PDF library does not shape or reorder Persian, so it produces disconnected letters
 * in reverse order. The browser already shapes text correctly, repeats table headers across pages,
 * and writes real selectable text.
 */
export function exportMatrixToPdf(): void {
  window.print();
}
