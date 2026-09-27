/**
 * Print rules for گزارش ماتریسی, scoped to this page.
 *
 * <b>Why this is not the matrix report's stylesheet with a different id.</b> That report has seven
 * fixed columns and fits A4 portrait. This one's column count comes from the data, so a pivot of
 * eight معین values is already sixteen amount columns plus the two row columns. Portrait would
 * either overflow the page or shrink the digits past reading size, so this sheet is **landscape**
 * and lets the browser scale a wide grid down rather than clipping it.
 *
 * Everything else follows the same reasoning as the matrix stylesheet:
 * - `thead { display: table-header-group }` repeats the header on every page — and here that matters
 *   more than anywhere else, because without it page two of a cross-tab is a grid of numbers with no
 *   way to tell which column is which.
 * - `break-inside: avoid` stops a row being sliced across a page boundary.
 * - App chrome is hidden by visibility rather than by each component remembering to hide itself.
 * - Colours are forced to print: browsers strip backgrounds by default, which would erase the
 *   header tint that separates the بدهکار/بستانکار pairs from each other.
 */
export const MATRIX_REPORT_PRINT_STYLES = `
@media print {
  @page {
    /* Landscape, unlike every other report here — the grid is as wide as the data makes it. */
    size: A4 landscape;
    margin: 10mm 8mm;
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

  /* On screen the grid scrolls inside a bounded box; on paper it must be allowed its full width
     instead of being clipped to the box it happened to have on screen. */
  #matrix-report-print-root .matrix-scroll {
    overflow: visible !important;
    max-height: none !important;
  }

  /* Sticky columns are a scrolling affordance. On paper there is no scrolling, and a sticky cell
     can end up painted over its neighbour. */
  #matrix-report-print-root th,
  #matrix-report-print-root td {
    position: static !important;
  }

  #matrix-report-print-root table {
    width: 100%;
    border-collapse: collapse;
    /* Smaller than the other reports on purpose: the column count is not ours to choose. */
    font-size: 8pt;
  }

  #matrix-report-print-root thead {
    display: table-header-group;
  }

  #matrix-report-print-root tr {
    break-inside: avoid;
  }

  #matrix-report-print-root th,
  #matrix-report-print-root td {
    border: 1px solid #cbd5e1;
    padding: 3px 4px;
  }

  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
`;
