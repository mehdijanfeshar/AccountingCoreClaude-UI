/**
 * Print rules for the trial balance, scoped to this page.
 *
 * Everything the browser prints here also becomes the PDF (via "Save as PDF"), so these rules are
 * not cosmetic: they are what separates a usable financial report from a screenshot of an app with
 * a sidebar in the corner.
 *
 * The parts that matter and why:
 * - `thead { display: table-header-group }` repeats the grouped header on every page. Without it,
 *   page two of a معین-level report is a wall of unlabelled numbers.
 * - `break-inside: avoid` on rows stops a row being sliced across a page boundary.
 * - Screen chrome (sidebar, filter panel, buttons, tabs) is removed rather than hidden behind a
 *   media query on the component, so nothing depends on a component remembering to hide itself.
 * - Colours are forced to print. Browsers strip backgrounds by default, which would erase exactly
 *   the tints and rules that make the column groups readable.
 */
export const TRIAL_BALANCE_PRINT_STYLES = `
@media print {
  @page {
    size: A4 landscape;
    margin: 12mm 10mm;
  }

  /* Everything outside the report is app furniture; a printed report should not carry it. */
  body * {
    visibility: hidden;
  }

  #trial-balance-print-root,
  #trial-balance-print-root * {
    visibility: visible;
  }

  #trial-balance-print-root {
    position: absolute;
    inset-inline-start: 0;
    top: 0;
    width: 100%;
    padding: 0;
    margin: 0;
  }

  .tb-no-print {
    display: none !important;
  }

  .tb-print-only {
    display: block !important;
  }

  /* Keep the tints and the group rules — they are the report's structure, not decoration. */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* On screen the table scrolls inside a fixed-height box; on paper it must flow. */
  .tb-scroll {
    max-height: none !important;
    overflow: visible !important;
    border: none !important;
  }

  table {
    width: 100% !important;
    min-width: 0 !important;
    font-size: 9pt;
    border-collapse: collapse;
  }

  thead {
    display: table-header-group;
  }

  tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* A sticky totals row makes no sense on paper — it belongs at the end of the data. */
  tbody tr[style*="sticky"],
  .tb-totals-row {
    position: static !important;
  }

  th, td {
    padding: 2pt 4pt !important;
  }
}

@media screen {
  .tb-print-only {
    display: none !important;
  }
}
`;
