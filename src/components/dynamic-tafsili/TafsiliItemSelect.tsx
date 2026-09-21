import { useEffect, useMemo, useState } from 'react';
import { toPersianDigits } from '../../lib/format/numbers';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTafsiliLevelItems } from './useTafsiliLevelItems';
import { ApiError } from '../../lib/api/apiError';
import type { TafsiliLevelDto, TafsiliLookupItemDto } from '../../types/tafsili';

export interface TafsiliSelection {
  levelId: string;
  tafsiliId: string;
  label: string;
}

interface TafsiliItemSelectProps {
  accountCodeId: string;
  level: TafsiliLevelDto;
  value: TafsiliSelection | null;
  onChange: (value: TafsiliSelection | null) => void;
  error?: string;
}

const DEBOUNCE_MS = 300;

/**
 * Async, server-searched, server-paginated select for one active تفصیلی level.
 *
 * Deliberately does NOT preload every item for the level (can be hundreds — see task
 * spec) — it debounces the typed text (≈300ms) and re-queries
 * `GET /api/account-codes/{accountCodeId}/tafsili-levels/{levelId}/items`. Pages beyond the
 * first are reachable via the "نمایش موارد بیشتر" button, which accumulates results rather
 * than replacing them so a user's earlier scroll position/selection stays valid.
 */
export function TafsiliItemSelect({ accountCodeId, level, value, onChange, error }: TafsiliItemSelectProps) {
  // `inputValue` is the raw displayed text (kept in sync for every MUI `onInputChange`
  // reason — typing, selecting, clearing, blur-revert). `typedQuery` only changes when the
  // user actually types (`reason === 'input'`) and is the ONLY thing that drives the
  // debounced server search below — without this split, selecting an option (which MUI
  // fires as an `onInputChange` with reason `'reset'`) would either fail to show the
  // selected label or spuriously re-trigger a search for that label.
  const [inputValue, setInputValue] = useState(value?.label ?? '');
  const [typedQuery, setTypedQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [accumulated, setAccumulated] = useState<TafsiliLookupItemDto[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(typedQuery);
      setPageNumber(1);
      setAccumulated([]);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [typedQuery]);

  const query = useTafsiliLevelItems(accountCodeId, level.levelId, debouncedSearch, pageNumber);

  /**
   * The total is tracked here, from the same response that produced `accumulated`, instead of
   * being read straight off `query.data`.
   *
   * <b>Reading it off the query is what produced «۰ از ۳».</b> `placeholderData` deliberately
   * keeps the previous response while a new key is in flight, so `query.data.totalCount` could
   * describe an older account, level or search than the options actually on screen — a footer
   * insisting three items exist above an empty list. Two numbers from two different responses look
   * like the server contradicting itself, which is far harder to diagnose than an empty list.
   */
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    // Placeholder data belongs to the previous key; adopting it would put another account's
    // تفصیلی into this row's dropdown.
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
      : 'دریافت فهرست تفصیلی با خطا مواجه شد.'
    : null;

  const selectedOption = useMemo<TafsiliLookupItemDto | null>(() => {
    if (!value) return null;
    return { id: value.tafsiliId, tafsiliCode: null, tafsiliName: null, label: value.label };
  }, [value]);

  return (
    <Stack spacing={0.5}>
      <Autocomplete
        options={accumulated}
        value={selectedOption}
        loading={query.isLoading}
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
          onChange({ levelId: level.levelId, tafsiliId: selected.id, label: selected.label });
          setInputValue(selected.label);
          setTypedQuery('');
        }}
        noOptionsText={fetchErrorMessage ?? 'موردی یافت نشد'}
        loadingText="در حال جستجو..."
        renderInput={(params) => (
          <TextField
            {...params}
            label={`${level.levelName} (تفصیلی سطح ${level.code})`}
            required
            error={!!error || !!fetchErrorMessage}
            helperText={fetchErrorMessage ?? error}
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

      {/*
        An empty dropdown says nothing about why it is empty, and the two reasons need different
        actions from the user: a search that matched nothing is theirs to change, while a level
        with no تفصیلی at all means this account has none linked for this level and no amount of
        typing will help. Only shown once a real (non-placeholder) response has arrived, so it
        never contradicts a list that is still loading.
      */}
      {!query.isFetching && !fetchErrorMessage && totalCount === 0 && accumulated.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          {debouncedSearch
            ? 'موردی با این جست‌وجو پیدا نشد.'
            : 'برای این حساب در این سطح، تفصیلی تعریف نشده است.'}
        </Typography>
      )}
    </Stack>
  );
}
