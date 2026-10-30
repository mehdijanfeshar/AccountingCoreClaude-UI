import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import { accountCodesApi } from '../../chart-of-accounts/api';
import { toPersianDigits } from '../../../lib/format/numbers';
import type { AccountCodeDto } from '../../../types/accountCode';

const DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

interface Props {
  value: AccountCodeDto[];
  onChange: (value: AccountCodeDto[]) => void;
  label?: string;
  helperText?: string;
  disabled?: boolean;
}

function optionLabel(a: AccountCodeDto): string {
  return toPersianDigits([a.accCode, a.accCodeName].filter(Boolean).join(' - '));
}

/**
 * انتخاب‌گر چندتایی معین با جست‌وجوی سمت سرور (`GET /api/account-codes?typeCode=3`) — فیلترهای
 * گزارشی که روی چند معین هم‌زمان کار می‌کنند («ارتباط گروه تفصیلی با معین»، «هرم سنی»).
 *
 * هم‌الگوی `features/identity/IdentityTafsiliSelect` (جست‌وجوی سرور با debounce) اما چندتایی و
 * بدون «نمایش موارد بیشتر»: برای یک فیلتر، ۲۰ نتیجهٔ اول کافی است — عبارت دقیق‌تر فهرست را کوتاه
 * می‌کند. معین‌های از‌پیش‌انتخاب‌شده با شیء کامل‌شان نگه داشته می‌شوند، پس حتی اگر در نتیجهٔ
 * جست‌وجوی تازه نباشند، چیپ‌شان از دست نمی‌رود.
 */
export function AccountMultiSelect({ value, onChange, label = 'معین', helperText, disabled }: Props) {
  const [inputValue, setInputValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(inputValue.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const query = useQuery({
    queryKey: ['account-codes-multi-select', debouncedSearch],
    queryFn: () =>
      accountCodesApi.list({ pageNumber: 1, pageSize: PAGE_SIZE, search: debouncedSearch || undefined, typeCode: 3 }),
    enabled: !disabled,
    placeholderData: (previous) => previous,
  });

  const options = query.data?.items ?? [];

  return (
    <Autocomplete
      multiple
      sx={{ minWidth: 280, flexGrow: 1 }}
      size="small"
      options={options}
      value={value}
      loading={query.isLoading}
      disabled={disabled}
      filterOptions={(opts) => opts}
      getOptionLabel={optionLabel}
      isOptionEqualToValue={(option, v) => option.id === v.id}
      onInputChange={(_event, newValue) => setInputValue(newValue)}
      onChange={(_event, selected) => onChange(selected)}
      noOptionsText="موردی یافت نشد"
      loadingText="در حال جستجو..."
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          helperText={helperText}
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
