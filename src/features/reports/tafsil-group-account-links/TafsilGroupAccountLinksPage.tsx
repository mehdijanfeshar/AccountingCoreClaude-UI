import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { PageHeader } from '../../../components/PageHeader';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { MonoCode } from '../../../components/MonoCode';
import { DataTable, type DataTableColumn } from '../../../components/DataTable';
import { AccountMultiSelect } from '../_shared/AccountMultiSelect';
import { TafsiliFilterSelect, type TafsiliFilterOption } from '../_shared/TafsiliFilterSelect';
import { levelTafsilsApi } from '../../../lib/api/levelTafsilsApi';
import { tafsilGroupsApi } from '../../tafsil-groups/api';
import { tafsilGroupAccountLinksReportApi, type TafsilGroupAccountLinkReportRowDto } from './api';
import type { AccountCodeDto } from '../../../types/accountCode';
import type { LevelTafsilDto } from '../../../types/levelTafsil';
import type { TafsilGroupDto } from '../../../types/tafsilGroup';

const LOOKUP_PAGE = { pageNumber: 1, pageSize: 200 };

interface Draft {
  accounts: AccountCodeDto[];
  level: LevelTafsilDto | null;
  group: TafsilGroupDto | null;
  tafsili: TafsiliFilterOption | null;
}

const EMPTY_DRAFT: Draft = { accounts: [], level: null, group: null, tafsili: null };

/**
 * ارتباط گروه تفصیلی با معین — فراگیر روی همهٔ معین‌ها (`GET
 * /api/reports/tafsil-group-account-links`)، برخلاف تبِ تک‌معینی «ارتباط معین با گروه تفصیلی»
 * (اطلاعات پایه). بدون فیلتر، همهٔ ردیف‌ها می‌آید؛ بدون صفحه‌بندی سمت سرور و بدون دامنهٔ واحد.
 */
export function TafsilGroupAccountLinksPage() {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [applied, setApplied] = useState<Draft>(EMPTY_DRAFT);

  const levelsQuery = useQuery({
    queryKey: ['level-tafsils-lookup'],
    queryFn: () => levelTafsilsApi.list(LOOKUP_PAGE),
  });
  const groupsQuery = useQuery({
    queryKey: ['tafsil-groups-lookup'],
    queryFn: () => tafsilGroupsApi.list(LOOKUP_PAGE),
  });
  const levelOptions = levelsQuery.data?.items ?? [];
  const groupOptions = groupsQuery.data?.items ?? [];

  const filter = {
    accountIds: applied.accounts.map((a) => a.id),
    levelId: applied.level?.id,
    tafsilGroupId: applied.group?.id,
    tafsiliId: applied.tafsili?.id,
  };

  const query = useQuery({
    queryKey: ['tafsil-group-account-links-report', filter],
    queryFn: () => tafsilGroupAccountLinksReportApi.get(filter),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setApplied(draft);
  }

  function clear() {
    setDraft(EMPTY_DRAFT);
    setApplied(EMPTY_DRAFT);
  }

  const columns: DataTableColumn<TafsilGroupAccountLinkReportRowDto>[] = [
    { key: 'moeinCode', header: 'کد معین', width: 110, frozen: true, render: (r) => <MonoCode value={r.moeinCode} /> },
    { key: 'moeinTitle', header: 'عنوان معین', render: (r) => r.moeinTitle ?? '—' },
    { key: 'levelTitle', header: 'سطح تفصیلی', render: (r) => r.levelTitle },
    { key: 'groupCode', header: 'کد گروه تفصیلی', render: (r) => <MonoCode value={r.groupCode} /> },
    { key: 'groupTitle', header: 'عنوان گروه تفصیلی', render: (r) => r.groupTitle },
  ];

  return (
    <section>
      <PageHeader
        icon={<LinkOutlinedIcon />}
        title="ارتباط گروه تفصیلی با معین"
        description="هر معین، سطح و گروه تفصیلی مجازش — روی همهٔ معین‌ها با هر فیلتری که بخواهید."
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }} component="form" onSubmit={submit}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap', alignItems: { md: 'center' } }}>
          <AccountMultiSelect
            label="معین"
            value={draft.accounts}
            onChange={(accounts) => setDraft((d) => ({ ...d, accounts }))}
          />
          <Autocomplete
            size="small"
            sx={{ minWidth: 200 }}
            options={levelOptions}
            value={draft.level}
            getOptionLabel={(o) => `${o.levelCode} - ${o.levelName}`}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            onChange={(_e, selected) => setDraft((d) => ({ ...d, level: selected }))}
            renderInput={(params) => <TextField {...params} label="سطح تفصیلی" />}
          />
          <Autocomplete
            size="small"
            sx={{ minWidth: 200 }}
            options={groupOptions}
            value={draft.group}
            getOptionLabel={(o) => `${o.tafsilGroupCode ?? ''} - ${o.tafsilGroupName ?? ''}`}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            onChange={(_e, selected) => setDraft((d) => ({ ...d, group: selected }))}
            renderInput={(params) => <TextField {...params} label="گروه تفصیلی" />}
          />
          <TafsiliFilterSelect value={draft.tafsili} onChange={(tafsili) => setDraft((d) => ({ ...d, tafsili }))} />
          <Stack direction="row" spacing={1}>
            <Button type="submit" variant="contained" startIcon={<SearchOutlinedIcon />}>
              جستجو
            </Button>
            <Button onClick={clear}>پاک کردن</Button>
          </Stack>
        </Stack>
      </Paper>

      {query.isError && <ErrorBanner error={query.error} />}

      {!query.isError && (
        <DataTable
          variant="report"
          columns={columns}
          rows={query.data ?? []}
          getRowKey={(r) => `${r.accountId}-${r.levelId}-${r.tafsilGroupId}`}
          isLoading={query.isLoading}
          emptyMessage="با این فیلتر، ارتباطی پیدا نشد."
        />
      )}
    </section>
  );
}
