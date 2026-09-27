/**
 * Print rules for مرور حساب‌ها, scoped to this page.
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
export const ACCOUNT_REVIEW_PRINT_STYLES = `
@media print {
  @page {
    size: A4 portrait;
    margin: 12mm 10mm;
  }

  body * {
    visibility: hidden;
  }

  #account-review-print-root,
  #account-review-print-root * {
    visibility: visible;
  }

  #account-review-print-root {
    position: absolute;
    inset-inline-start: 0;
    top: 0;
    width: 100%;
    padding: 0;
    margin: 0;
  }

  /* Controls are not part of the report. */
  .account-review-no-print {
    display: none !important;
  }

  #account-review-print-root table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10pt;
  }

  #account-review-print-root thead {
    display: table-header-group;
  }

  #account-review-print-root tr {
    break-inside: avoid;
  }

  #account-review-print-root th,
  #account-review-print-root td {
    border-bottom: 1px solid #cbd5e1;
    padding: 4px 6px;
  }

  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
`;
