/**
 * Print rules for گزارش ماتریسی, scoped to this page.
 *
 * Everything printed here also becomes the PDF (via "Save as PDF"), so these rules are not
 * cosmetic — they are what separates a usable financial report from a screenshot of an app with a
 * sidebar in the corner. Same approach as the trial balance's own stylesheet, kept separate
 * because the two reports have different roots and column counts and would otherwise have to agree
 * forever on both.
 *
 * The parts that matter:
 * - `thead { display: table-header-group }` repeats the header on every page; without it, page two
 *   of a معین-level report is a wall of unlabelled numbers.
 * - `break-inside: avoid` stops a row being sliced across a page boundary.
 * - App chrome is hidden by visibility rather than by each component remembering to hide itself.
 * - Colours are forced to print: browsers strip backgrounds by default, which would erase the
 *   header tint and the totals rule.
 */
export const MATRIX_REPORT_PRINT_STYLES = `
@media print {
  @page {
    size: A4 portrait;
    margin: 12mm 10mm;
  }

  body * {
    visibility: hidden;
  }

  #matrix-report-print-root,
  #matrix-report-print-root * {
    visibility: visible;
  }

  #matrix-report-print-root {
    position: absolute;
    inset-inline-start: 0;
    top: 0;
    width: 100%;
    padding: 0;
    margin: 0;
  }

  /* Controls are not part of the report. */
  .matrix-report-no-print {
    display: none !important;
  }

  #matrix-report-print-root table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10pt;
  }

  #matrix-report-print-root thead {
    display: table-header-group;
  }

  #matrix-report-print-root tr {
    break-inside: avoid;
  }

  #matrix-report-print-root th,
  #matrix-report-print-root td {
    border-bottom: 1px solid #cbd5e1;
    padding: 4px 6px;
  }

  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
`;
