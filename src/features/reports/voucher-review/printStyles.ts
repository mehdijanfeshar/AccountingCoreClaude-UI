/**
 * Print rules for مرور اسناد, scoped to this page.
 *
 * Everything printed here also becomes the PDF (via "Save as PDF"), so these rules are not
 * cosmetic — they are what separates a usable financial report from a screenshot of an app with a
 * sidebar in the corner. Kept as its own stylesheet rather than shared with the other reports
 * because each has a different print root and column count, and a shared sheet would force all of
 * them to agree forever on both.
 *
 * The parts that matter:
 * - `thead { display: table-header-group }` repeats the header on every page; without it, page two
 *   is a wall of unlabelled numbers.
 * - `break-inside: avoid` stops a row being sliced across a page boundary.
 * - App chrome is hidden by visibility rather than by each component remembering to hide itself.
 * - Colours are forced to print: browsers strip backgrounds by default, which would erase the
 *   header tint and the totals rule.
 *
 * ⚠️ Printing covers the page on screen, which is one page of the report. That is stated on the
 * printed sheet itself rather than left for the reader to discover.
 */
export const VOUCHER_REVIEW_PRINT_STYLES = `
@media print {
  @page {
    size: A4 portrait;
    margin: 12mm 10mm;
  }

  body * {
    visibility: hidden;
  }

  #voucher-review-print-root,
  #voucher-review-print-root * {
    visibility: visible;
  }

  #voucher-review-print-root {
    position: absolute;
    inset-inline-start: 0;
    top: 0;
    width: 100%;
    padding: 0;
    margin: 0;
  }

  .voucher-review-no-print {
    display: none !important;
  }

  #voucher-review-print-root table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.5pt;
  }

  #voucher-review-print-root thead {
    display: table-header-group;
  }

  #voucher-review-print-root tr {
    break-inside: avoid;
  }

  #voucher-review-print-root th,
  #voucher-review-print-root td {
    border-bottom: 1px solid #cbd5e1;
    padding: 4px 6px;
  }

  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
`;
