import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import { tafsilisApi } from '../../tafsilis/api';
import { toPersianDigits } from '../../../lib/format/numbers';

export interface TafsiliFilterOption {
  id: string;
  label: string;
}

const DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

function toOption(t: { id: string; tafsiliCode: string | null; tafsiliName: string | null }): TafsiliFilterOption {
  return { id: t.id, label: toPersianDigits([t.tafsiliCode, t.tafsiliName].filter(Boolean).join(' - ')) };
}

interface Props {
  value: TafsiliFilterOption | null;
  onChange: (option: TafsiliFilterOption | null) => void;
  label?: string;
}

/**
 * انتخاب‌گر تفصیلی (اختیاری) با جست‌وجوی سمت سرور (`GET /api/tafsilis?search=`) — برای فیلترِ
 * گزارش «ارتباط گروه تفصیلی با معین». هم‌الگوی `features/identity/IdentityTafsiliSelect` اما
 * تک‌انتخابی و بدون الزام (آن یکی همیشه یک تفصیلی لازم دارد، این یکی فقط یک فیلتر اختیاری است).
 */
export function TafsiliFilterSelect({ value, onChange, label = 'تفصیلی' }: Props) {
  const [inputValue, setInputValue] = useState(value?.label ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(inputValue.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const query = useQuery({
    queryKey: ['tafsilis-filter-select', debouncedSearch],
    queryFn: () => tafsilisApi.list({ pageNumber: 1, pageSize: PAGE_SIZE, search: debouncedSearch || undefined }),
    placeholderData: (previous) => previous,
  });

  const options = (query.data?.items ?? []).map(toOption);

  return (
    <Autocomplete
      sx={{ minWidth: 220 }}
      size="small"
      options={options}
      value={value}
      loading={query.isLoading}
      filterOptions={(opts) => opts}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, v) => option.id === v.id}
      inputValue={inputValue}
      onInputChange={(_event, newValue) => setInputValue(newValue)}
      onChange={(_event, option) => onChange(option)}
      noOptionsText="موردی یافت نشد"
      loadingText="در حال جستجو..."
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps.input,
              endAdornment: (
                <>
                  {query.isFetching ? <CircularProgress color="inherit" size={16} /> : null}
                  {params.slotProps.input.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  );
}
