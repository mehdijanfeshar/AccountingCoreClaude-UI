import MuiPagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { toPersianDigits } from '../lib/format/numbers';

interface PaginationProps {
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (pageNumber: number) => void;
}

/**
 * Wraps MUI's numbered `Pagination` component. Kept 1-based `pageNumber` in
 * the props (unchanged from the pre-MUI version) so callers didn't need to
 * change — MUI's `Pagination` is itself 1-based, unlike `TablePagination`.
 * No page-size control here: neither current API supports it yet.
 */
export function Pagination({ pageNumber, pageSize, totalCount, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

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
      <Typography variant="body2" color="text.secondary">
        صفحه {toPersianDigits(pageNumber)} از {toPersianDigits(totalPages)} ({toPersianDigits(totalCount)} مورد)
      </Typography>
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
