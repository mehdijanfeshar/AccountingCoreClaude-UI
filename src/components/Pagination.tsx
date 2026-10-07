import MenuItem from '@mui/material/MenuItem';
import MuiPagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { toPersianDigits } from '../lib/format/numbers';

/**
 * Rows-per-page choices offered by default.
 *
 * ⚠️ <b>200 is a hard ceiling, not a matter of taste.</b> Every paged query validator on the backend
 * declares `MaxPageSize = 200` and enforces it with `InclusiveBetween(1, MaxPageSize)`, which
 * <b>rejects</b> an over-large page with a 400 rather than clamping it. Adding a bigger option here
 * would turn a dropdown entry into an error message. If a larger page is ever wanted, raise the
 * server constant first and re-check the integer-overflow guard its doc comment describes.
 */
export const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];

interface PaginationProps {
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (pageNumber: number) => void;
  /**
   * Supply this and a rows-per-page control appears beside the page counter. Leave it out and the
   * bar renders exactly as it always has — which is why the call sites that keep a fixed page size
   * did not have to change.
   *
   * The handler is expected to send the reader back to page 1: page 7 of a 20-row listing usually
   * does not exist once a page holds 200, and landing on an empty page reads as «داده‌ای نیست».
   */
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  /**
   * Adds «همه» to the selector — only for grids paged on the client, where showing every row costs no
   * server request. Chosen, it arrives as {@link ALL_ROWS}.
   */
  allowAll?: boolean;
}

/** Page size meaning «every row» — see `allowAll`. */
export const ALL_ROWS = -1;

/**
 * Wraps MUI's numbered `Pagination` component. Kept 1-based `pageNumber` in
 * the props (unchanged from the pre-MUI version) so callers didn't need to
 * change — MUI's `Pagination` is itself 1-based, unlike `TablePagination`.
 */
export function Pagination({
  pageNumber,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  allowAll = false,
}: PaginationProps) {
  const totalPages = pageSize === ALL_ROWS ? 1 : Math.max(1, Math.ceil(totalCount / pageSize));

  // The size shown is the one the server reported, which need not be one of the offered values.
  // Folding it in keeps the select showing the size actually in force instead of rendering blank.
  const options = pageSizeOptions.includes(pageSize) || pageSize === ALL_ROWS
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((a, b) => a - b);

  return (
    <Stack
      component="nav"
      aria-label="صفحه‌بندی"
      direction="row"
      sx={{
        mt: 2,
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        {onPageSizeChange && (
          <TextField
            select
            size="small"
            label="تعداد در صفحه"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            sx={{ width: 130 }}
          >
            {options.map((option) => (
              <MenuItem key={option} value={option}>
                {toPersianDigits(option)}
              </MenuItem>
            ))}
            {allowAll && <MenuItem value={ALL_ROWS}>همه</MenuItem>}
          </TextField>
        )}

        <Typography variant="body2" color="text.secondary">
          صفحه {toPersianDigits(pageNumber)} از {toPersianDigits(totalPages)} (
          {toPersianDigits(totalCount)} مورد)
        </Typography>
      </Stack>

      <MuiPagination
        page={pageNumber}
        count={totalPages}
        onChange={(_event, page) => onPageChange(page)}
        color="primary"
        shape="rounded"
        size="small"
      />
    </Stack>
  );
}
