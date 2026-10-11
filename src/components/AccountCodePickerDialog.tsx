import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { DataTable, type DataTableColumn } from './DataTable';
import { Pagination } from './Pagination';
import { ErrorBanner } from './ErrorBanner';
import { accountCodesApi } from '../features/chart-of-accounts/api';
import { toLatinDigits } from '../lib/format/numbers';
import type { AccountCodeDto } from '../types/accountCode';

const PAGE_SIZE = 10;

interface AccountCodePickerDialogProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  onSelect: (account: AccountCodeDto) => void;
  /** Excludes a row from being selectable (e.g. an account cannot be its own parent). */
  excludeId?: string;
  /**
   * Optional extra restriction on which fetched rows are selectable (e.g. by `accCode.length` to
   * scope the picker to one کدینگ level — see `AccountCodeLevelTab.tsx`). Applied client-side on
   * top of whatever page is currently loaded (the text search below, unlike this, is server-side):
   * it narrows the CURRENT page's rows, it does not ask the server for a different page.
   */
  filterRows?: (account: AccountCodeDto) => boolean;
  /**
   * لیست ثبت سند: فقط حساب‌های معینِ مجاز برای نوع واحد کاربر در این تاریخ سند (ماتریس دسترسی
   * کدینگ) — از `GET /api/account-codes/entry-moins`، با همان قاعده‌ای که ذخیرهٔ سند را کنترل می‌کند.
   * `undefined` = همهٔ حساب‌ها (مثلاً انتخاب حساب والد در کدینگ).
   */
  voucherEntry?: { dateDoc: string };
  /**
   * سطح‌های کدینگ قابل انتخاب (۱ گروه، ۲ کل، ۳ معین) — فیلتر سمت سرور. بیش از یکی ⇒ تب‌ها، پیش‌فرض آخرین.
   * `undefined` = همهٔ سطح‌ها با هم (رفتار قبلی).
   */
  levels?: AccountLevel[];
}

type AccountLevel = 1 | 2 | 3;

const ACCOUNT_LEVEL_LABELS: Record<AccountLevel, string> = { 1: 'گروه', 2: 'کل', 3: 'معین' };

/**
 * Shared paginated picker for `TB_ACCOUNTCODE` rows — used both for "کد حساب والد" on the
 * chart-of-accounts form and for "حساب معین" on a voucher line. Never accepts a raw guid
 * text input per task spec.
 *
 * The search box queries the server (`GET /api/account-codes?search=`) across the whole chart:
 * a code that starts with the text, or a title that contains it. It used to filter only the
 * loaded page, so «3030» on page 1 of 15 found nothing even when the account existed.
 */
export function AccountCodePickerDialog({
  open,
  title = 'انتخاب حساب',
  onClose,
  onSelect,
  excludeId,
  filterRows,
  voucherEntry,
  levels,
}: AccountCodePickerDialogProps) {
  // سطح کدینگ: با چند سطح ⇒ تب (پیش‌فرض آخرین، معمولاً معین)؛ با یک سطح ⇒ فقط همان، بی‌تب.
  const [level, setLevel] = useState<AccountLevel | undefined>(() => levels?.[levels.length - 1]);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');

  // A short pause before asking the server, so typing «3030» is one request, not four.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(toLatinDigits(searchText.trim()));
      setPageNumber(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchText]);

  const query = useQuery({
    queryKey: ['account-codes-picker', pageNumber, pageSize, search, voucherEntry?.dateDoc ?? null, level ?? null],
    queryFn: () =>
      voucherEntry
        ? accountCodesApi.entryMoins({ pageNumber, pageSize, search: search || undefined, dateDoc: voucherEntry.dateDoc })
        : accountCodesApi.list({ pageNumber, pageSize, search: search || undefined, typeCode: level }),
    enabled: open,
    placeholderData: (previous) => previous,
  });

  const rows = useMemo(() => {
    const items = query.data?.items ?? [];
    let filtered = items.filter((row) => row.id !== excludeId);
    if (filterRows) {
      filtered = filtered.filter(filterRows);
    }
    return filtered;
  }, [query.data, excludeId, filterRows]);

  const columns: DataTableColumn<AccountCodeDto>[] = [
    { key: 'accCode', header: 'کد حساب', render: (row) => row.accCode ?? '—' },
    { key: 'accCodeName', header: 'عنوان حساب', render: (row) => row.accCodeName ?? '—' },
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
      {levels && levels.length > 1 && (
        <Tabs
          value={level}
          onChange={(_, value: AccountLevel) => {
            setLevel(value);
            setPageNumber(1);
          }}
          sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          {levels.map((l) => (
            <Tab key={l} value={l} label={ACCOUNT_LEVEL_LABELS[l]} />
          ))}
        </Tabs>
      )}
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            autoFocus
            label="جستجوی کد یا عنوان حساب"
            helperText={
              voucherEntry
                ? 'فقط حساب‌های معینِ مجاز برای واحد شما در تاریخ این سند: کدی که با این عدد شروع شود، یا عنوانی که این متن را داشته باشد.'
                : 'در همهٔ حساب‌ها جستجو می‌شود: کدی که با این عدد شروع شود، یا عنوانی که این متن را داشته باشد.'
            }
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </Box>

        {query.isError && <ErrorBanner error={query.error} />}

        {!query.isError && (
          <>
            <DataTable
              pageable={false}
              columns={columns}
              rows={rows}
              getRowKey={(row) => row.id}
              isLoading={query.isLoading}
              emptyMessage={
                search
                  ? `حسابی با «${searchText.trim()}» پیدا نشد.`
                  : voucherEntry
                    ? 'هیچ معینی برای واحد شما در تاریخ این سند مجاز نشده است («اطلاعات پایه › دسترسی کدینگ حسابداری»).'
                    : 'هیچ حسابی یافت نشد.'
              }
            />
            {query.data && (
              <Pagination
                pageNumber={query.data.pageNumber}
                pageSize={pageSize}
                totalCount={query.data.totalCount}
                onPageChange={setPageNumber}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPageNumber(1);
        }}
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
