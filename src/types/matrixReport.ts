/**
 * Mirrors the backend's گزارش ماتریسی contract — `GET /api/reports/matrix`.
 *
 * <b>Why this does not share `accountReview.ts`'s level type.</b> The backend deliberately declares
 * its own `MatrixDimension` rather than reusing `AccountReviewLevel`, and the reason carries over
 * here: there a level is «در چه سطحی تجمیع کنم» and there is exactly one; here it is «روی این محور
 * چه بگذارم» and there are two independent choices. The numeric values are identical on purpose so
 * the two are trivially comparable, but the types stay separate so the two reports can grow apart.
 */

/**
 * Mirrors `MatrixDimension`. The numbers are the wire contract and match `ACCOUNT_REVIEW_LEVEL` one for
 * one — every one of them is a plain column of `VW_CONSOLIDATE_REPORT`.
 */
export const MATRIX_DIMENSION = {
  group: 1,
  kol: 2,
  moin: 3,
  tafsili1: 4,
  tafsili2: 5,
  tafsili3: 6,
  tafsili4: 7,
  tafsili5: 8,
  tafsili6: 9,
  tafsili7: 10,
} as const;

export type MatrixDimensionValue =
  (typeof MATRIX_DIMENSION)[keyof typeof MATRIX_DIMENSION];

/**
 * The axis pickers' options, split into the two families they belong to — the same split the matrix
 * report's level picker uses, for the same reason: ten flat entries make «معین» and «تفصیلی ۴» look
 * like the same kind of thing.
 */
export const MATRIX_CODING_DIMENSIONS: { value: MatrixDimensionValue; label: string }[] = [
  { value: MATRIX_DIMENSION.group, label: 'گروه' },
  { value: MATRIX_DIMENSION.kol, label: 'کل' },
  { value: MATRIX_DIMENSION.moin, label: 'معین' },
];

export const MATRIX_TAFSILI_DIMENSIONS: { value: MatrixDimensionValue; label: string }[] = [
  { value: MATRIX_DIMENSION.tafsili1, label: 'تفصیلی ۱' },
  { value: MATRIX_DIMENSION.tafsili2, label: 'تفصیلی ۲' },
  { value: MATRIX_DIMENSION.tafsili3, label: 'تفصیلی ۳' },
  { value: MATRIX_DIMENSION.tafsili4, label: 'تفصیلی ۴' },
  { value: MATRIX_DIMENSION.tafsili5, label: 'تفصیلی ۵' },
  { value: MATRIX_DIMENSION.tafsili6, label: 'تفصیلی ۶' },
  { value: MATRIX_DIMENSION.tafsili7, label: 'تفصیلی ۷' },
];

export const MATRIX_ALL_DIMENSIONS = [
  ...MATRIX_CODING_DIMENSIONS,
  ...MATRIX_TAFSILI_DIMENSIONS,
];

export function matrixDimensionLabel(value: MatrixDimensionValue): string {
  return MATRIX_ALL_DIMENSIONS.find((o) => o.value === value)?.label ?? '—';
}

/** Mirrors `MatrixColumnDto` — one distinct value of the column dimension, plus its total. */
export interface MatrixColumn {
  code: string;
  name: string;
  debtor: number;
  creditor: number;
}

/**
 * Mirrors `MatrixCellDto`. Only populated intersections are sent — a cross-tab is nearly always
 * sparse — so a column code absent from a row's `cells` means zero, not missing data.
 */
export interface MatrixCell {
  columnCode: string;
  debtor: number;
  creditor: number;
}

/** Mirrors `MatrixRowDto`. */
export interface MatrixRow {
  code: string;
  name: string;
  cells: MatrixCell[];
  debtor: number;
  creditor: number;
}

/** Mirrors `MatrixResultDto`. */
export interface MatrixResult {
  rowDimension: MatrixDimensionValue;
  rowDimensionLabel: string;
  columnDimension: MatrixDimensionValue;
  columnDimensionLabel: string;
  /** In code order, already truncated server-side if there were too many. */
  columns: MatrixColumn[];
  rows: MatrixRow[];
  /** Grand total بدهکار — over the **whole** filtered set, see `columnsTruncated`. */
  debtor: number;
  /** Grand total بستانکار — over the whole filtered set. */
  creditor: number;
  /** How many distinct column values existed before the cap. */
  totalColumnCount: number;
  /**
   * True when `columns` holds fewer than `totalColumnCount`.
   *
   * ⚠️ When this is set the grand totals still cover everything while the visible cells do not, so
   * the row and column totals will not add up to them. The backend does that on purpose — rebasing
   * the totals onto the visible slice would make a truncated report look complete — which makes it
   * **this page's job** to say so on screen.
   */
  columnsTruncated: boolean;
}

export interface MatrixParams {
  year: string;
  rowDimension: MatrixDimensionValue;
  columnDimension: MatrixDimensionValue;
  fromDate?: string;
  toDate?: string;
  docLife?: number;
  systemTypeId?: string;
  /** «شروع با» on the row dimension's code. */
  rowCodeFilter?: string;
  /** «شروع با» on the column dimension's code — the practical fix for a pivot that is too wide. */
  columnCodeFilter?: string;
}

/**
 * Looks a cell up by column code.
 *
 * Rows arrive with a sparse `cells` array rather than a map, so the grid would otherwise do a
 * linear scan per cell — O(rows × columns × cells). This builds the lookup once per row.
 */
export function cellsByColumn(row: MatrixRow): Map<string, MatrixCell> {
  return new Map(row.cells.map((cell) => [cell.columnCode, cell]));
}
