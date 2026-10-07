import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ErrorBanner } from '../../components/ErrorBanner';
import { MonoCode } from '../../components/MonoCode';
import { Pagination } from '../../components/Pagination';
import { useSession } from '../../lib/session/SessionContext';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import { FS_FRAMEWORK_OPTIONS, type FsAccountMappingDto, type FsFrameworkValue, type FsMappingAssignment } from '../../types/fsTemplate';
import { fsTemplatesApi } from './api';
import { FsMappingApplyDialog } from './FsMappingApplyDialog';
import { downloadMappingTemplate } from './mappingExcel';

type Filter = 'all' | 'unmapped' | 'double' | 'mapped';

const PAGE_SIZE = 50;

/**
 * نگاشت حساب‌ها (بخش ۴۵-و، سند منبع §۱۲-۳): نمای حساب‌محورِ همان قالب‌هایی که تهیهٔ صورت‌های این مجموعه
 * برای واحد جاری برمی‌دارد — هر معین کدینگ به کدام ردیف رفته. «بدون نگاشت» = در هیچ صورت اصلی نیامده
 * (یادداشت حساب نیست)؛ «دوبار» = در یک صورت در دو ردیف بدون [D]/[C]. همان منطق کنترل V-05، ولی برای همهٔ
 * معین‌ها، نه فقط دارای مانده. کلیک روی ردیف ⇒ صفحهٔ آن قالب.
 */
export function FsAccountMappingPage() {
  const navigate = useNavigate();
  const { financialYear, unitCode } = useSession();
  const [framework, setFramework] = useState<FsFrameworkValue>(1);
  const [year, setYear] = useState(financialYear || '');
  const [useDrafts, setUseDrafts] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [applying, setApplying] = useState<FsMappingAssignment[] | "file" | null>(null);
  const queryClient = useQueryClient();
  const notify = useNotify();

  const yearValid = /^1[34]\d{2}$/.test(year);

  const query = useQuery({
    queryKey: ['fs-account-mapping', unitCode, framework, year, useDrafts],
    queryFn: () => fsTemplatesApi.accountMapping(framework, Number(year), useDrafts),
    enabled: yearValid,
  });

  const templatesQuery = useQuery({ queryKey: ['fs-templates', unitCode], queryFn: () => fsTemplatesApi.list() });

  const all = useMemo(() => query.data ?? [], [query.data]);
  const counts = useMemo(
    () => ({
      unmapped: all.filter((m) => m.statementMatchCount === 0).length,
      double: all.filter((m) => m.doubleCounted).length,
    }),
    [all],
  );

  const rows = useMemo(() => {
    const s = toLatinDigits(search.trim());
    return all.filter((m) => {
      if (filter === 'unmapped' && m.statementMatchCount !== 0) return false;
      if (filter === 'double' && !m.doubleCounted) return false;
      if (filter === 'mapped' && m.statementMatchCount === 0) return false;
      if (!s) return true;
      return m.accCode.includes(s) || (m.accName ?? '').includes(search.trim()) || (m.kolCode ?? '').startsWith(s);
    });
  }, [all, filter, search]);

  const suggestions = useMemo(
    () =>
      rows
        .filter((m) => m.statementMatchCount === 0 && m.suggestion)
        .map((m) => ({ accCode: m.accCode, templateCode: m.suggestion!.templateCode, rowCode: m.suggestion!.rowCode })),
    [rows],
  );

  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const openTemplate = (templateCode: string) => {
    const t = (templatesQuery.data ?? []).find((x) => x.code === templateCode);
    const v = t?.versions.find((x) => x.state === 1) ?? t?.versions[0];
    if (v) navigate(`/fs/template-versions/${v.id}`);
  };

  const suggestionChip = (m: FsAccountMappingDto) =>
    m.suggestion && (
      <Chip
        size="small"
        color="info"
        variant="outlined"
        icon={<AutoFixHighOutlinedIcon />}
        label={`پیشنهاد: ${m.suggestion.templateTitle} / ${m.suggestion.rowCode}`}
        title={`${m.suggestion.rowTitle ?? ""} — بر اساس ${toPersianDigits(m.suggestion.siblingCount)} معینِ هم‌${m.suggestion.basis === "kol" ? "کل" : "گروه"}؛ کلیک = اعمال`}
        onClick={() => setApplying([{ accCode: m.accCode, templateCode: m.suggestion!.templateCode, rowCode: m.suggestion!.rowCode }])}
      />
    );

  const columns: DataTableColumn<FsAccountMappingDto>[] = [
    { key: 'code', header: 'معین', width: 90, render: (m) => <MonoCode value={m.accCode} /> },
    { key: 'name', header: 'نام', render: (m) => m.accName ?? '—' },
    {
      key: 'kol',
      header: 'کل / گروه',
      render: (m) => (
        <Typography variant="caption" color="text.secondary">
          {m.kolCode ? `${m.kolCode} ${m.kolName ?? ''}` : '—'}
          {m.groupCode ? ` · ${m.groupCode} ${m.groupName ?? ''}` : ''}
        </Typography>
      ),
    },
    {
      key: 'rows',
      header: 'ردیف‌ها',
      render: (m) =>
        m.matches.length === 0 ? (
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5 }}>
            <Chip size="small" color="error" variant="outlined" label="بدون نگاشت" />
            {suggestionChip(m)}
          </Stack>
        ) : (
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {m.statementMatchCount === 0 && <Chip size="small" color="error" variant="outlined" label="فقط در یادداشت" />}
            {suggestionChip(m)}
            {m.doubleCounted && <Chip size="small" color="warning" label="دوبار در یک صورت" />}
            {m.matches.map((x) => (
              <Chip
                key={`${x.templateCode}-${x.rowCode}`}
                size="small"
                variant={x.isNote ? 'outlined' : 'filled'}
                label={`${x.templateTitle} / ${x.rowCode}${x.side ? ` [${x.side}]` : ''}`}
                title={x.rowTitle ?? undefined}
                onClick={() => openTemplate(x.templateCode)}
              />
            ))}
          </Stack>
        ),
    },
  ];

  return (
    <section>
      <PageHeader
        eyebrow="صورت‌های مالی"
        icon={<AccountTreeOutlinedIcon />}
        title="نگاشت حساب‌ها"
        description="هر معین کدینگ در کدام ردیف صورت‌ها می‌آید — با قالب‌هایی که تهیهٔ صورت‌ها برای واحد جاری برمی‌دارد. معین بدون نگاشت، اگر مانده داشته باشد، از صورت‌ها جا می‌ماند."
        actions={
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<DownloadOutlinedIcon />}
              disabled={all.length === 0}
              onClick={() => void downloadMappingTemplate(all, `نگاشت-حساب‌ها-${year}.xlsx`)}
            >
              دریافت Excel
            </Button>
            <Button variant="outlined" startIcon={<UploadFileOutlinedIcon />} disabled={!yearValid} onClick={() => setApplying("file")}>
              ورود از Excel
            </Button>
            <Button
              variant="contained"
              startIcon={<AutoFixHighOutlinedIcon />}
              disabled={suggestions.length === 0}
              onClick={() => setApplying(suggestions)}
            >
              اعمال پیشنهادها ({toPersianDigits(suggestions.length)})
            </Button>
          </Stack>
        }
      />

      <Tabs
        value={framework}
        onChange={(_, v: FsFrameworkValue) => {
          setFramework(v);
          setPage(1);
        }}
        sx={{ mb: 2 }}
      >
        {FS_FRAMEWORK_OPTIONS.map((o) => (
          <Tab key={o.value} value={o.value} label={o.label} />
        ))}
      </Tabs>

      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
          <TextField
            size="small"
            label="سال مالی"
            value={toPersianDigits(year)}
            onChange={(e) => setYear(toLatinDigits(e.target.value).replace(/\D/g, '').slice(0, 4))}
            sx={{ width: 110 }}
          />
          <FormControlLabel
            control={<Switch checked={useDrafts} onChange={(e) => setUseDrafts(e.target.checked)} />}
            label="با قالب‌های پیش‌نویس"
          />
          <ToggleButtonGroup
            size="small"
            exclusive
            value={filter}
            onChange={(_, v: Filter | null) => {
              if (v) {
                setFilter(v);
                setPage(1);
              }
            }}
          >
            <ToggleButton value="all">همه ({toPersianDigits(all.length)})</ToggleButton>
            <ToggleButton value="unmapped">بدون نگاشت ({toPersianDigits(counts.unmapped)})</ToggleButton>
            <ToggleButton value="double">دوبار ({toPersianDigits(counts.double)})</ToggleButton>
            <ToggleButton value="mapped">نگاشت‌شده</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            size="small"
            label="جستجوی کد یا نام"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            sx={{ minWidth: 200, mr: 'auto' }}
          />
        </Stack>
      </Paper>

      {query.isError && <ErrorBanner error={query.error} />}

      <DataTable
        pageable={false}
        columns={columns}
        rows={pageRows}
        getRowKey={(m) => m.accCode}
        isLoading={query.isLoading && yearValid}
        emptyMessage={all.length === 0 ? 'این مجموعه برای این سال قالبی ندارد، یا کدینگ خالی است.' : 'موردی با این فیلتر نیست.'}
      />
      {rows.length > pageSize && <Pagination pageNumber={page} pageSize={pageSize} totalCount={rows.length} onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />}
      {applying && (
        <FsMappingApplyDialog
          framework={framework}
          year={Number(year)}
          current={all}
          initialItems={applying === "file" ? null : applying}
          onClose={() => setApplying(null)}
          onApplied={async (count) => {
            setApplying(null);
            await queryClient.invalidateQueries({ queryKey: ["fs-account-mapping"] });
            await queryClient.invalidateQueries({ queryKey: ["fs-template-version"] });
            notify(`${toPersianDigits(count)} نگاشت روی پیش‌نویس قالب‌ها اعمال شد.`);
          }}
        />
      )}
    </section>
  );
}
