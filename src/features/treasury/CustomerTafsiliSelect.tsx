import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { toPersianDigits } from '../../lib/format/numbers';
import { ApiError } from '../../lib/api/apiError';
import { customerTafsilisApi } from './api';
import type { TafsiliLookupItemDto } from '../../types/tafsili';

interface CustomerTafsiliSelectProps {
  value: TafsiliLookupItemDto | null;
  onChange: (value: TafsiliLookupItemDto | null) => void;
  disabled?: boolean;
}

const DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

/**
 * «تفصیلی مشتری (پرداخت‌کننده)» — دریافت وجه، خزانه‌داری بخش ۴-ج. دقیقاً هم‌الگوی
 * `BeneficiaryTafsiliSelect` (async، debounce، server-paginated با دکمهٔ «نمایش موارد بیشتر») اما
 * سرچشمه‌اش `GET /api/treasury/customer-tafsilis` است — فقط تفصیلی‌های عضو «گروه تفصیلی
 * مشتریانِ» تعریف‌شده در تنظیمات خزانهٔ واحد، جدا از گروه تفصیلی ذی‌نفع. صفحهٔ خالی بدون جست‌وجو
 * (نه خطا) یعنی واحد هنوز گروهی تعریف نکرده — پیام راهنما به‌جای «موردی یافت نشد» نشان داده می‌شود.
 */
export function CustomerTafsiliSelect({ value, onChange, disabled }: CustomerTafsiliSelectProps) {
  const [inputValue, setInputValue] = useState(value?.label ?? '');
  const [typedQuery, setTypedQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [accumulated, setAccumulated] = useState<TafsiliLookupItemDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(typedQuery);
      setPageNumber(1);
      setAccumulated([]);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [typedQuery]);

  const query = useQuery({
    queryKey: ['treasury-customer-tafsilis', debouncedSearch, pageNumber],
    queryFn: () =>
      customerTafsilisApi.list({
        search: debouncedSearch.trim() ? debouncedSearch.trim() : undefined,
        pageNumber,
        pageSize: PAGE_SIZE,
      }),
    enabled: !disabled,
    placeholderData: (previous) => previous,
  });

  useEffect(() => {
    // placeholderData متعلق به کلید قبلی است؛ پذیرفتنش شمارهٔ کل نامرتبط را نشان می‌دهد.
    if (!query.data || query.isPlaceholderData) return;

    setTotalCount(query.data.totalCount);
    setAccumulated((previous) => {
      if (pageNumber === 1) return query.data.items;
      const seen = new Set(previous.map((item) => item.id));
      return [...previous, ...query.data.items.filter((item) => !seen.has(item.id))];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, query.isPlaceholderData, pageNumber]);

  const hasMore = accumulated.length < totalCount;

  const fetchErrorMessage = query.isError
    ? query.error instanceof ApiError
      ? (query.error.detail ?? query.error.title)
      : 'دریافت فهرست تفصیلی مشتریان با خطا مواجه شد.'
    : null;

  const noGroupConfigured =
    !query.isFetching && !fetchErrorMessage && !debouncedSearch && totalCount === 0 && accumulated.length === 0;

  const selectedOption = useMemo<TafsiliLookupItemDto | null>(() => {
    if (!value) return null;
    return { id: value.id, tafsiliCode: value.tafsiliCode, tafsiliName: value.tafsiliName, label: value.label };
  }, [value]);

  const helperText = fetchErrorMessage
    ? fetchErrorMessage
    : noGroupConfigured
      ? 'گروه تفصیلی مشتریان در تنظیمات خزانه تعریف نشده است.'
      : 'پرداخت‌کنندهٔ دریافت وجه.';

  return (
    <Stack spacing={0.5}>
      <Autocomplete
        options={accumulated}
        value={selectedOption}
        loading={query.isLoading}
        disabled={disabled}
        inputValue={inputValue}
        filterOptions={(options) => options}
        getOptionLabel={(option) => option.label}
        isOptionEqualToValue={(option, current) => option.id === current.id}
        onInputChange={(_event, newValue, reason) => {
          setInputValue(newValue);
          if (reason === 'input') setTypedQuery(newValue);
        }}
        onChange={(_event, selected) => {
          if (!selected) {
            onChange(null);
            setInputValue('');
            setTypedQuery('');
            return;
          }
          onChange(selected);
          setInputValue(selected.label);
          setTypedQuery('');
        }}
        noOptionsText={fetchErrorMessage ?? (noGroupConfigured ? helperText : 'موردی یافت نشد')}
        loadingText="در حال جستجو..."
        renderInput={(params) => (
          <TextField
            {...params}
            label="تفصیلی مشتری (پرداخت‌کننده)"
            required
            error={!!fetchErrorMessage}
            helperText={helperText}
            slotProps={{
              input: {
                ...params.slotProps.input,
                endAdornment: (
                  <>
                    {query.isFetching ? <CircularProgress color="inherit" size={16} /> : null}
                    {params.slotProps.input.endAdornment}
                  </>
                ),
              },
              htmlInput: params.slotProps.htmlInput,
              inputLabel: params.slotProps.inputLabel,
            }}
          />
        )}
      />
      {hasMore && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Button size="small" onClick={() => setPageNumber((p) => p + 1)}>
            نمایش موارد بیشتر
          </Button>
          <Typography variant="caption" color="text.secondary">
            {toPersianDigits(accumulated.length)} از {toPersianDigits(totalCount)} مورد
          </Typography>
        </Stack>
      )}
    </Stack>
  );
}
