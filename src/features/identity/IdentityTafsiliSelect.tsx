import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { toPersianDigits } from '../../lib/format/numbers';
import { ApiError } from '../../lib/api/apiError';
import { tafsilisApi } from '../tafsilis/api';

interface Option {
  id: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (tafsiliId: string) => void;
  disabled?: boolean;
  error?: string;
}

const DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

function toOption(t: { id: string; tafsiliCode: string | null; tafsiliName: string | null }): Option {
  return { id: t.id, label: toPersianDigits([t.tafsiliCode, t.tafsiliName].filter(Boolean).join(' - ')) };
}

/**
 * تفصیلیِ گروه ویژگی (`TB_IDENTITYGROUP.TAFSILI_ID`) — اختیاری. با انتخابش، هر ردیف سندی که این
 * تفصیلی را در هر سطحی داشته باشد فرم ویژگی این گروه را می‌خواهد (VoucherLineExtras).
 * هم‌الگوی BeneficiaryTafsiliSelect: جست‌وجوی سمت سرور با debounce و «نمایش موارد بیشتر».
 */
export function IdentityTafsiliSelect({ value, onChange, disabled, error }: Props) {
  const [selected, setSelected] = useState<Option | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [typedQuery, setTypedQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [accumulated, setAccumulated] = useState<Option[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // حالت ویرایش: برچسب تفصیلی ذخیره‌شده.
  const current = useQuery({
    queryKey: ['tafsilis', value],
    queryFn: () => tafsilisApi.getById(value),
    enabled: !!value && selected?.id !== value,
  });

  useEffect(() => {
    if (!value) {
      setSelected(null);
      setInputValue('');
      return;
    }
    if (current.data && current.data.id === value) {
      const option = toOption(current.data);
      setSelected(option);
      setInputValue(option.label);
    }
  }, [value, current.data]);

  useEffect(() => {
    // بدون تغییر عبارت، کلید query عوض نمی‌شود و دادهٔ تازه‌ای نمی‌آید — خالی کردن فهرست یعنی لیست خالی می‌ماند.
    if (typedQuery === debouncedSearch) return;
    const timer = setTimeout(() => {
      setDebouncedSearch(typedQuery);
      setPageNumber(1);
      setAccumulated([]);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [typedQuery]);

  const query = useQuery({
    queryKey: ['tafsilis-search', debouncedSearch, pageNumber],
    queryFn: () =>
      tafsilisApi.list({
        pageNumber,
        pageSize: PAGE_SIZE,
        search: debouncedSearch.trim() || undefined,
      }),
    enabled: !disabled,
    placeholderData: (previous) => previous,
  });

  useEffect(() => {
    if (!query.data || query.isPlaceholderData) return;
    setTotalCount(query.data.totalCount);
    const items = query.data.items.map(toOption);
    setAccumulated((previous) => {
      if (pageNumber === 1) return items;
      const seen = new Set(previous.map((item) => item.id));
      return [...previous, ...items.filter((item) => !seen.has(item.id))];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, query.isPlaceholderData, pageNumber]);

  const hasMore = accumulated.length < totalCount;
  const fetchErrorMessage = query.isError
    ? query.error instanceof ApiError
      ? (query.error.detail ?? query.error.title)
      : 'دریافت فهرست تفصیلی با خطا مواجه شد.'
    : null;

  return (
    <Stack spacing={0.5}>
      <Autocomplete
        options={accumulated}
        value={selected}
        loading={query.isLoading}
        disabled={disabled}
        inputValue={inputValue}
        filterOptions={(options) => options}
        getOptionLabel={(option) => option.label}
        isOptionEqualToValue={(option, v) => option.id === v.id}
        onInputChange={(_event, newValue, reason) => {
          setInputValue(newValue);
          if (reason === 'input') setTypedQuery(newValue);
        }}
        onChange={(_event, option) => {
          setSelected(option);
          setInputValue(option?.label ?? '');
          setTypedQuery('');
          onChange(option?.id ?? '');
        }}
        noOptionsText={fetchErrorMessage ?? 'موردی یافت نشد'}
        loadingText="در حال جستجو..."
        renderInput={(params) => (
          <TextField
            {...params}
            label="تفصیلی"
            required
            error={!!fetchErrorMessage || !!error}
            helperText={
              fetchErrorMessage ??
              error ??
              'در ثبت سند، هر ردیفی که این تفصیلی را (در هر سطح) داشته باشد فرم این ویژگی را می‌خواهد.'
            }
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
