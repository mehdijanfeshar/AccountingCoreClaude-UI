import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import { DataTable, type DataTableColumn } from './DataTable';
import { Pagination } from './Pagination';
import { ErrorBanner } from './ErrorBanner';
import { vahedInfosApi } from '../lib/api/vahedInfosApi';
import type { VahedInfoDto } from '../types/vahedInfo';

const PAGE_SIZE = 10;

interface VahedInfoPickerDialogProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  onSelect: (vahedInfo: VahedInfoDto) => void;
}

/**
 * Paginated picker for `TB_VAHED_INFO` (organizational unit/branch) rows — used for
 * `WorkShops.branchId`. Mirrors `AccountCodePickerDialog` structure/behaviour: `GET
 * /api/vahed-infos` has no server `search` param either, so the text field below only filters
 * the rows already loaded on the current page (same documented limitation, not a bug).
 */
export function VahedInfoPickerDialog({ open, title = 'انتخاب واحد سازمانی', onClose, onSelect }: VahedInfoPickerDialogProps) {
  const [pageNumber, setPageNumber] = useState(1);
  const [pageFilter, setPageFilter] = useState('');

  const query = useQuery({
    queryKey: ['vahed-infos-picker', pageNumber],
    queryFn: () => vahedInfosApi.list({ pageNumber, pageSize: PAGE_SIZE }),
    enabled: open,
    placeholderData: (previous) => previous,
  });

  const rows = useMemo(() => {
    const items = query.data?.items ?? [];
    if (!pageFilter.trim()) return items;
    const needle = pageFilter.trim().toLowerCase();
    return items.filter(
      (row) =>
        (row.vahedCode ?? '').toLowerCase().includes(needle) ||
        (row.vahedName ?? '').toLowerCase().includes(needle),
    );
  }, [query.data, pageFilter]);

  const columns: DataTableColumn<VahedInfoDto>[] = [
    { key: 'vahedCode', header: 'کد واحد', render: (row) => row.vahedCode ?? '—' },
    { key: 'vahedName', header: 'نام واحد', render: (row) => row.vahedName ?? '—' },
    {
      key: 'action',
      header: '',
      render: (row) => (
        <Button
          size="small"
          variant="outlined"
          onClick={() => {
            onSelect(row);
            onClose();
          }}
        >
          انتخاب
        </Button>
      ),
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            label="فیلتر در صفحه جاری"
            helperText="این فیلتر فقط روی موارد همین صفحه اعمال می‌شود (بک‌اند جستجوی سمت سرور ندارد)."
            value={pageFilter}
            onChange={(e) => setPageFilter(e.target.value)}
          />
        </Box>

        {query.isError && <ErrorBanner error={query.error} />}

        {!query.isError && (
          <>
            <DataTable
              columns={columns}
              rows={rows}
              getRowKey={(row) => row.id}
              isLoading={query.isLoading}
              emptyMessage="هیچ واحدی یافت نشد."
            />
            {query.data && (
              <Pagination
                pageNumber={query.data.pageNumber}
                pageSize={query.data.pageSize}
                totalCount={query.data.totalCount}
                onPageChange={setPageNumber}
              />
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>بستن</Button>
      </DialogActions>
    </Dialog>
  );
}
