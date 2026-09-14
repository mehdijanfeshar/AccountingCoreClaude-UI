import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import DatePicker from 'react-multi-date-picker';
import DateObject from 'react-date-object';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Typography from '@mui/material/Typography';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import FilterAltOffOutlinedIcon from '@mui/icons-material/FilterAltOffOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ListToolbar } from '../../components/ListToolbar';
import { MonoCode } from '../../components/MonoCode';
import { Pagination } from '../../components/Pagination';
import { ErrorBanner } from '../../components/ErrorBanner';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import { sysTypesApi } from '../../lib/api/sysTypesApi';
import { useSession } from '../../lib/session/SessionContext';
import { voucherHeadsApi } from './api';
import type { VoucherHeadDto } from '../../types/voucherHead';

const PAGE_SIZE = 20;

interface Filters {
  year: string;
  docNumFrom: string;
  docNumTo: string;
  dateDocFrom: string;
  dateDocTo: string;
  systemTypeId: string;
}

const EMPTY_FILTERS: Omit<Filters, 'year'> = {
  docNumFrom: '',
  docNumTo: '',
  dateDocFrom: '',
  dateDocTo: '',
  systemTypeId: '',
};

/** Compact Jalali date field storing the Legacy `YYYYMMDD` string the API expects. */
function DateFilterField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <DatePicker
      calendar={persian}
      locale={persian_fa}
      format="YYYY/MM/DD"
      value={value ? new DateObject({ date: value, format: 'YYYYMMDD', calendar: persian, locale: persian_fa }) : undefined}
      onChange={(date) => onChange(date ? toLatinDigits(date.format('YYYYMMDD')) : '')}
      render={(shown, openCalendar) => (
        <TextField
          size="small"
          label={label}
          value={shown}
          onClick={openCalendar}
          onFocus={openCalendar}
          sx={{ width: 148 }}
          slotProps={{
            htmlInput: { readOnly: true },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <CalendarMonthOutlinedIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            },
          }}
        />
      )}
    />
  );
}

/**
 * کارتابل اسناد — `GET /api/voucher-heads`.
 *
 * Every filter here is applied **server-side** across all pages (year, DOC_NUM range, DATE_DOC
 * range, نوع سند), so the row count in the toolbar is the true match count, not "matches on this
 * page". The organizational unit is deliberately absent: it is not caller-controllable — the
 * backend scopes every query to the caller's own unit (CLAUDE.md IDOR risk #1).
 */
export function VoucherHeadsListPage() {
  const { financialYear, isConfigured } = useSession();
  const [pageNumber, setPageNumber] = useState(1);
  const [filters, setFilters] = useState<Filters>({ year: financialYear, ...EMPTY_FILTERS });

  // The top-bar fiscal year seeds this page; changing it there resets the page's year filter.
  useEffect(() => {
    setFilters((previous) => ({ ...previous, year: financialYear }));
    setPageNumber(1);
  }, [financialYear]);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPageNumber(1);
  }

  const sysTypesQuery = useQuery({
    queryKey: ['sys-types'],
    queryFn: () => sysTypesApi.list(),
    enabled: isConfigured,
  });
  const sysTypes = sysTypesQuery.data ?? [];

  const query = useQuery({
    queryKey: ['voucher-heads', pageNumber, PAGE_SIZE, filters],
    queryFn: () =>
      voucherHeadsApi.list({
        pageNumber,
        pageSize: PAGE_SIZE,
        year: filters.year || undefined,
        docNumFrom: filters.docNumFrom || undefined,
        docNumTo: filters.docNumTo || undefined,
        dateDocFrom: filters.dateDocFrom || undefined,
        dateDocTo: filters.dateDocTo || undefined,
        systemTypeId: filters.systemTypeId || undefined,
      }),
    placeholderData: (previous) => previous,
    enabled: isConfigured,
  });

  const sysTypeNameById = new Map(sysTypes.map((t) => [t.id, t.sysName ?? t.sysCode]));

  const columns: DataTableColumn<VoucherHeadDto>[] = [
    { key: 'docNum', header: 'شماره سند', render: (row) => <MonoCode value={row.docNum} /> },
    { key: 'dateDoc', header: 'تاریخ سند', render: (row) => formatLegacyJalaliDate(row.dateDoc) },
    { key: 'headDesc', header: 'شرح سند', render: (row) => row.headDesc ?? '—' },
    {
      key: 'systemType',
      header: 'نوع سند',
      render: (row) =>
        row.systemTypeId ? (
          (sysTypeNameById.get(row.systemTypeId) ?? '—')
        ) : (
          <Typography variant="body2" color="text.disabled">
            —
          </Typography>
        ),
    },
    { key: 'year', header: 'سال مالی', render: (row) => (row.year ? toPersianDigits(row.year) : '—') },
  ];

  const hasExtraFilter = Boolean(
    filters.docNumFrom || filters.docNumTo || filters.dateDocFrom || filters.dateDocTo || filters.systemTypeId,
  );

  function clearFilters() {
    setFilters((previous) => ({ ...previous, ...EMPTY_FILTERS }));
    setPageNumber(1);
  }

  return (
    <section>
      <PageHeader
        eyebrow="عملیات"
        icon={<DescriptionOutlinedIcon />}
        accentColor="secondary"
        title="اسناد حسابداری"
        description="کارتابل سرسند اسناد — همهٔ فیلترها روی کل اسناد واحد شما اعمال می‌شوند، نه فقط صفحهٔ جاری."
        actions={
          <Button variant="contained" color="secondary" startIcon={<AddOutlinedIcon />} component={RouterLink} to="/operation/vouchers/new">
            صدور سند جدید
          </Button>
        }
      />

      {!isConfigured && (
        <Box
          role="status"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            py: 6,
            color: 'text.secondary',
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <EventOutlinedIcon sx={{ fontSize: 32, opacity: 0.5 }} />
          <Typography variant="body2">برای مشاهدهٔ اسناد، ابتدا سال مالی را از نوار بالا انتخاب کنید.</Typography>
        </Box>
      )}

      {query.isError && <ErrorBanner error={query.error} />}

      {isConfigured && !query.isError && (
        <>
          <ListToolbar summary={query.data ? `${toPersianDigits(query.data.totalCount)} سند` : ''}>
            <TextField
              size="small"
              label="سال مالی"
              value={filters.year}
              onChange={(event) => setFilter('year', toLatinDigits(event.target.value))}
              sx={{ width: 116 }}
              slotProps={{
                htmlInput: { maxLength: 4, inputMode: 'numeric' },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <EventOutlinedIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              size="small"
              label="از شماره سند"
              value={filters.docNumFrom}
              onChange={(event) => setFilter('docNumFrom', toLatinDigits(event.target.value))}
              sx={{ width: 140 }}
              slotProps={{
                htmlInput: { maxLength: 10, inputMode: 'numeric' },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <TagOutlinedIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              size="small"
              label="تا شماره سند"
              value={filters.docNumTo}
              onChange={(event) => setFilter('docNumTo', toLatinDigits(event.target.value))}
              sx={{ width: 140 }}
              slotProps={{
                htmlInput: { maxLength: 10, inputMode: 'numeric' },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <TagOutlinedIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <DateFilterField
              label="از تاریخ سند"
              value={filters.dateDocFrom}
              onChange={(value) => setFilter('dateDocFrom', value)}
            />
            <DateFilterField
              label="تا تاریخ سند"
              value={filters.dateDocTo}
              onChange={(value) => setFilter('dateDocTo', value)}
            />
            <TextField
              select
              size="small"
              label="نوع سند"
              value={filters.systemTypeId}
              onChange={(event) => setFilter('systemTypeId', event.target.value)}
              sx={{ width: 180 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <CategoryOutlinedIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                },
              }}
            >
              <MenuItem value="">همه</MenuItem>
              {sysTypes.map((type) => (
                <MenuItem key={type.id} value={type.id}>
                  {type.sysName ?? type.sysCode}
                </MenuItem>
              ))}
            </TextField>
            {hasExtraFilter && (
              <Button size="small" variant="text" startIcon={<FilterAltOffOutlinedIcon />} onClick={clearFilters}>
                پاک کردن فیلترها
              </Button>
            )}
          </ListToolbar>

          <DataTable
            columns={columns}
            rows={query.data?.items ?? []}
            getRowKey={(row) => row.id}
            isLoading={query.isLoading}
            emptyMessage={
              hasExtraFilter ? 'سندی با این فیلترها یافت نشد.' : 'برای این سال مالی هنوز سندی ثبت نشده است.'
            }
            emptyAction={
              hasExtraFilter ? (
                <Button size="small" variant="text" startIcon={<FilterAltOffOutlinedIcon />} onClick={clearFilters}>
                  پاک کردن فیلترها
                </Button>
              ) : (
                <Button
                  size="small"
                  variant="outlined"
                  color="secondary"
                  startIcon={<AddOutlinedIcon />}
                  component={RouterLink}
                  to="/operation/vouchers/new"
                >
                  صدور اولین سند
                </Button>
              )
            }
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
    </section>
  );
}
