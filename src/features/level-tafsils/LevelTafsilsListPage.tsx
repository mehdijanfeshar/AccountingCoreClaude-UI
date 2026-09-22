import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Chip from '@mui/material/Chip';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ListToolbar } from '../../components/ListToolbar';
import { MonoCode } from '../../components/MonoCode';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { toPersianDigits } from '../../lib/format/numbers';
import { levelTafsilsApi } from '../../lib/api/levelTafsilsApi';
import { LEVEL_TAFSILS_PAGE_SIZE, MAX_TAFSILI_LEVELS } from './schema';
import type { LevelTafsilDto } from '../../types/levelTafsil';

/**
 * سطوح تفصیلی — the lookup every «تفصیلی الزامی» decision is expressed in terms of. Until now
 * the app could only read it (to fill the سطح picker on the «ارتباط معین با گروه تفصیلی» tab);
 * levels themselves could not be created or renamed anywhere.
 *
 * Deliberately unpaginated — see `LEVEL_TAFSILS_PAGE_SIZE`. A pager over at most 7 rows would
 * only imply there is more to see.
 */
export function LevelTafsilsListPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const [pendingDelete, setPendingDelete] = useState<LevelTafsilDto | null>(null);

  const query = useQuery({
    queryKey: ['level-tafsils', LEVEL_TAFSILS_PAGE_SIZE],
    queryFn: () => levelTafsilsApi.list({ pageNumber: 1, pageSize: LEVEL_TAFSILS_PAGE_SIZE }),
    placeholderData: (previous) => previous,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => levelTafsilsApi.remove(id),
    onSuccess: async () => {
      // Also drops the picker's cache on the «ارتباط معین با گروه تفصیلی» tab, which reads the
      // same resource under its own key.
      await queryClient.invalidateQueries({ queryKey: ['level-tafsils'] });
      await queryClient.invalidateQueries({ queryKey: ['level-tafsils-lookup'] });
      notify('سطح تفصیلی حذف شد.');
      setPendingDelete(null);
    },
    onError: (error) => {
      notify({ message: error instanceof Error ? error.message : 'حذف با خطا مواجه شد.', severity: 'error' });
    },
  });

  const allRows = query.data?.items ?? [];

  /**
   * Codes appearing more than once. The backend cannot reject these (`TB_LEVEL_TAFSIL` has no
   * UNIQUE constraint and no validator rule for it), but the reference project resolves a level
   * number to an id with `SingleOrDefault(a => a.CodeLevel == i)` — so a duplicate is a row that
   * either throws or silently wins at voucher time. Surfacing it is the most this page can
   * honestly do without inventing a UI-only rule.
   */
  const duplicateCodes = useMemo(() => {
    const seen = new Map<string, number>();
    allRows.forEach((row) => {
      const code = (row.levelCode ?? '').trim();
      seen.set(code, (seen.get(code) ?? 0) + 1);
    });
    return new Set([...seen.entries()].filter(([, count]) => count > 1).map(([code]) => code));
  }, [allRows]);

  const rows = useMemo(() => {
    if (!filter.trim()) return allRows;
    const needle = filter.trim().toLowerCase();
    return allRows.filter(
      (row) =>
        (row.levelCode ?? '').toLowerCase().includes(needle) ||
        (row.levelName ?? '').toLowerCase().includes(needle),
    );
  }, [allRows, filter]);

  const atCapacity = allRows.length >= MAX_TAFSILI_LEVELS;

  const columns: DataTableColumn<LevelTafsilDto>[] = [
    {
      key: 'levelCode',
      header: 'کد سطح',
      render: (row) => (
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          <MonoCode value={row.levelCode} />
          {duplicateCodes.has((row.levelCode ?? '').trim()) && (
            <Tooltip title="این کد سطح تکراری است و نگاشت سطح را در زمان صدور سند مبهم می‌کند.">
              <Chip size="small" color="warning" label="تکراری" />
            </Tooltip>
          )}
        </Stack>
      ),
    },
    { key: 'levelName', header: 'نام سطح', render: (row) => row.levelName ?? '—' },
    {
      key: 'action',
      header: 'عملیات',
      render: (row) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="ویرایش">
            <IconButton
              size="small"
              aria-label={`ویرایش سطح ${row.levelName ?? row.levelCode}`}
              component={RouterLink}
              to={`/base/level-tafsils/${row.id}/edit`}
            >
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="حذف">
            <IconButton
              size="small"
              color="error"
              aria-label={`حذف سطح ${row.levelName ?? row.levelCode}`}
              onClick={() => setPendingDelete(row)}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <section>
      <PageHeader
        eyebrow="اطلاعات پایه"
        icon={<LayersOutlinedIcon />}
        title="سطوح تفصیلی"
        description="سطح‌هایی که تفصیلی هر حساب معین در قالب آن‌ها تعریف می‌شود (TB_LEVEL_TAFSIL)"
        actions={
          <Tooltip title={atCapacity ? `حداکثر ${toPersianDigits(MAX_TAFSILI_LEVELS)} سطح مجاز است.` : ''}>
            <span>
              <Button
                variant="contained"
                startIcon={<AddOutlinedIcon />}
                component={RouterLink}
                to="/base/level-tafsils/new"
                disabled={atCapacity}
              >
                افزودن سطح
              </Button>
            </span>
          </Tooltip>
        }
      />

      <Alert severity="info" sx={{ mb: 2 }}>
        هر سطحی که در صفحهٔ «ارتباط معین با گروه تفصیلی» برای یک معین تعریف شود، در فرم صدور سند
        برای آن معین <strong>الزامی</strong> می‌شود. شمارهٔ سطح از همین «کد سطح» خوانده می‌شود، پس
        حداکثر {toPersianDigits(MAX_TAFSILI_LEVELS)} سطح با کدهای یکتا معنا دارد.
      </Alert>

      {duplicateCodes.size > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>کد سطح تکراری</AlertTitle>
          کدهای {toPersianDigits([...duplicateCodes].join('، '))} بیش از یک بار ثبت شده‌اند. سمت
          سرور هیچ قید یکتایی روی این جدول وجود ندارد، ولی نگاشت شمارهٔ سطح در زمان صدور سند یکتا
          بودن را فرض می‌کند — این ردیف‌ها را اصلاح کنید.
        </Alert>
      )}

      <ListToolbar
        search={filter}
        onSearchChange={setFilter}
        searchLabel="جستجو در سطوح"
        summary={query.data ? `${toPersianDigits(query.data.totalCount)} ردیف` : ''}
      />

      {query.isError && <ErrorBanner error={query.error} />}

      {!query.isError && (
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.id}
          isLoading={query.isLoading}
          emptyMessage={filter.trim() ? 'نتیجه‌ای برای این جستجو یافت نشد.' : 'هنوز سطح تفصیلی‌ای ثبت نشده است.'}
          emptyAction={
            filter.trim() ? (
              <Button size="small" variant="text" onClick={() => setFilter('')}>
                پاک کردن جستجو
              </Button>
            ) : (
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddOutlinedIcon />}
                component={RouterLink}
                to="/base/level-tafsils/new"
              >
                افزودن سطح
              </Button>
            )
          }
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف سطح تفصیلی"
        // Deliberately spells out the consequence: DeleteLevelTafsilCommand checks no dependent
        // rows, so a level still referenced by TB_ACCOUNT_LINK_LEVEL / TB_ACCOUNT_LINK_TAFSILGROUP
        // is soft-deleted without complaint and that configuration goes quiet.
        description={
          pendingDelete
            ? `آیا از حذف «${pendingDelete.levelCode} - ${pendingDelete.levelName}» مطمئن هستید؟ اگر این سطح برای حسابی تعریف شده باشد، سمت سرور هیچ بررسی وابستگی انجام نمی‌شود و آن پیکربندی بی‌صدا از کار می‌افتد.`
            : undefined
        }
        pending={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />
    </section>
  );
}
