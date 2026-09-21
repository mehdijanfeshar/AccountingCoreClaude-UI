import { useEffect, useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  FileText,
  FilterX,
  Pencil,
  RefreshCcw,
  Repeat2,
  Search,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';
import { Checkbox } from '../../components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { NumberTicker } from '../../components/NumberTicker';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { useSession } from '../../lib/session/SessionContext';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import { sysTypesApi } from '../../lib/api/sysTypesApi';
import { changeVoucherState, DOC_LIFE_OPTIONS, getDocLifeLabel, voucherHeadsApi } from './api';
import type { VoucherHeadDto } from '../../types/voucherHead';

const PAGE_SIZE = 20;

type StatusTab = 'all' | '1' | '2' | '3' | '4';

/** Badge + tile tone per state — the same progression the MUI page uses. */
const STATE_TONE: Record<number, 'neutral' | 'warning' | 'info' | 'success'> = {
  1: 'neutral',
  2: 'warning',
  3: 'info',
  4: 'success',
};

const TILE_ACCENT: Record<number, string> = {
  1: 'text-primary bg-primary/10',
  2: 'text-warning bg-warning/10',
  3: 'text-info bg-info/10',
  4: 'text-success bg-success/10',
};

/**
 * PILOT — the same کارتابل as `VoucherHeadsListPage`, rebuilt on Tailwind + shadcn/ui + Lucide.
 *
 * <b>This page exists to be compared, not to replace anything.</b> It is wired to the same
 * queries, the same filters and the same batch state-change endpoint as the MUI version, so the
 * only variable is the component layer. Both are routed at once; delete this one or the other
 * once the decision is made, but do not leave both.
 *
 * <b>What the pilot was built to measure — RTL.</b> The findings, in order of how much they cost:
 *
 * 1. <b>Radix behaviour is free.</b> Tabs read the document `dir` and reverse arrow-key
 *    navigation on their own. No work, no `dir` prop.
 * 2. <b>Layout is free, if logical utilities are used.</b> `ps-`/`pe-`/`ms-`/`me-`/`text-start`
 *    flip off the `dir="rtl"` already on `<html>`. Nothing in this page needs a direction check.
 * 3. <b>Copied shadcn source is NOT free.</b> Upstream components ship physical classes —
 *    `mr-2` on Button's icon, `text-left` on Table's cells — which do not flip and silently
 *    misplace things. Each is a one-word fix, but each has to be found by reading the component.
 *    That is the real migration cost: not hard, but per-component and not automatic, across
 *    however many shadcn components the app ends up importing.
 *
 * The contrast with MUI is that `stylis-plugin-rtl` rewrites physical CSS properties at build
 * time, so a component author writing `margin-left` still gets correct RTL. Tailwind has no
 * equivalent — correctness depends on the class chosen at every call site.
 */
export function VoucherHeadsShadcnPage() {
  const { financialYear, isConfigured } = useSession();
  const notify = useNotify();
  const queryClient = useQueryClient();

  const [pageNumber, setPageNumber] = useState(1);
  const [year, setYear] = useState(financialYear);
  const [search, setSearch] = useState('');
  const [systemTypeId, setSystemTypeId] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    setYear(financialYear);
    setPageNumber(1);
  }, [financialYear]);

  const sysTypesQuery = useQuery({
    queryKey: ['sys-types'],
    queryFn: () => sysTypesApi.list(),
    enabled: isConfigured,
  });
  const sysTypes = sysTypesQuery.data ?? [];

  const countQueries = useQueries({
    queries: DOC_LIFE_OPTIONS.map((option) => ({
      queryKey: ['voucher-heads', 'count', year, option.value],
      queryFn: () =>
        voucherHeadsApi.list({ pageNumber: 1, pageSize: 1, year: year || undefined, docLife: option.value }),
      enabled: isConfigured,
      select: (page: { totalCount: number }) => page.totalCount,
    })),
  });
  const countsLoading = countQueries.some((q) => q.isLoading);
  const countByState = new Map<number, number | undefined>(
    DOC_LIFE_OPTIONS.map((option, index) => [option.value, countQueries[index]?.data]),
  );

  const query = useQuery({
    queryKey: ['voucher-heads', pageNumber, PAGE_SIZE, year, systemTypeId, statusTab],
    queryFn: () =>
      voucherHeadsApi.list({
        pageNumber,
        pageSize: PAGE_SIZE,
        year: year || undefined,
        systemTypeId: systemTypeId || undefined,
        docLife: statusTab === 'all' ? undefined : Number(statusTab),
      }),
    placeholderData: (previous) => previous,
    enabled: isConfigured,
  });

  const changeStateMutation = useMutation({
    mutationFn: (newState: number) => changeVoucherState(selectedIds, newState),
    onSuccess: async (_data, newState) => {
      const moved = selectedIds.length;
      setSelectedIds([]);
      await queryClient.invalidateQueries({ queryKey: ['voucher-heads'] });
      notify(`${toPersianDigits(moved)} سند به وضعیت «${getDocLifeLabel(newState)}» منتقل شد.`);
    },
    onError: (error) => {
      notify({
        message: error instanceof Error ? error.message : 'انتقال وضعیت با خطا مواجه شد.',
        severity: 'error',
      });
    },
  });

  const sysTypeNameById = new Map(sysTypes.map((t) => [t.id, t.sysName ?? t.sysCode]));
  const allRows = query.data?.items ?? [];
  const needle = search.trim().toLowerCase();
  const rows = needle
    ? allRows.filter(
        (row) =>
          (row.docNum ?? '').toLowerCase().includes(needle) ||
          (row.headDesc ?? '').toLowerCase().includes(needle),
      )
    : allRows;

  function toggleSelected(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function switchTab(next: StatusTab) {
    setStatusTab(next);
    setSelectedIds([]);
    setPageNumber(1);
  }

  const inStatusTab = statusTab !== 'all';
  const moveTargets = DOC_LIFE_OPTIONS.filter((option) => String(option.value) !== statusTab);
  const hasFilter = Boolean(systemTypeId || needle);
  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.totalCount / PAGE_SIZE)) : 1;

  return (
    <div className="font-sans text-foreground">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileText className="size-5" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">عملیات · نمونهٔ shadcn</p>
            <h1 className="text-xl font-bold">کارتابل اسناد</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              همان دادهٔ نسخهٔ MUI — فقط لایهٔ کامپوننت فرق دارد.
            </p>
          </div>
        </div>

        <Button onClick={() => query.refetch()} variant="outline" size="sm">
          <RefreshCcw className={query.isFetching ? 'animate-spin' : undefined} />
          بازخوانی
        </Button>
      </div>

      {/* Stat tiles */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {DOC_LIFE_OPTIONS.map((option) => {
          const count = countByState.get(option.value);
          const active = statusTab === String(option.value);

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => switchTab(String(option.value) as StatusTab)}
              className={cnTile(active)}
            >
              <span className={`grid size-9 place-items-center rounded-lg ${TILE_ACCENT[option.value]}`}>
                <FileText className="size-4" />
              </span>
              <span className="min-w-0 text-start">
                <span className="block text-xs text-muted-foreground">اسناد {option.label}</span>
                <span className="block text-lg font-bold leading-tight">
                  {countsLoading ? (
                    <span className="inline-block h-5 w-12 animate-pulse rounded bg-muted align-middle" />
                  ) : count === undefined ? (
                    '—'
                  ) : (
                    <NumberTicker value={count} />
                  )}
                </span>
                {year && <span className="block text-xs text-muted-foreground/70">سال {toPersianDigits(year)}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tabs */}
      <Tabs value={statusTab} onValueChange={(v) => switchTab(v as StatusTab)} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">همه</TabsTrigger>
          {DOC_LIFE_OPTIONS.map((option) => {
            const count = countByState.get(option.value);
            return (
              <TabsTrigger key={option.value} value={String(option.value)}>
                {option.label}
                {count !== undefined && (
                  <span className="rounded-full bg-black/10 px-1.5 text-[0.7rem] leading-5 data-[state=active]:bg-white/20">
                    {toPersianDigits(count)}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Toolbar */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 p-3">
          <div className="relative">
            {/* `start-3`, not `left-3` — flips with dir on its own. */}
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو در همین صفحه"
              aria-label="جستجو در همین صفحه"
              className="h-9 w-64 rounded-lg border border-input bg-card ps-9 pe-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="relative">
            <CalendarDays className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={year}
              onChange={(e) => {
                setYear(toLatinDigits(e.target.value));
                setPageNumber(1);
              }}
              maxLength={4}
              inputMode="numeric"
              aria-label="سال مالی"
              className="h-9 w-32 rounded-lg border border-input bg-card ps-9 pe-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <select
            value={systemTypeId}
            onChange={(e) => {
              setSystemTypeId(e.target.value);
              setPageNumber(1);
            }}
            aria-label="نوع سند"
            className="h-9 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">همهٔ انواع سند</option>
            {sysTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.sysName ?? type.sysCode}
              </option>
            ))}
          </select>

          {hasFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSystemTypeId('');
                setSearch('');
                setPageNumber(1);
              }}
            >
              <FilterX />
              پاک کردن فیلترها
            </Button>
          )}

          <span className="ms-auto text-sm text-muted-foreground">
            {query.data ? `${toPersianDigits(query.data.totalCount)} سند` : ''}
          </span>
        </CardContent>
      </Card>

      {/* Selection bar */}
      {inStatusTab && selectedIds.length > 0 && (
        <Card className="mb-4 border-secondary/40 bg-secondary/5">
          <CardContent className="flex flex-wrap items-center gap-2 p-3">
            <span className="text-sm">{toPersianDigits(selectedIds.length)} سند انتخاب شده — انتقال به:</span>
            {moveTargets.map((target) => (
              <Button
                key={target.value}
                variant="outline"
                size="sm"
                disabled={changeStateMutation.isPending}
                onClick={() => changeStateMutation.mutate(target.value)}
              >
                {target.label}
              </Button>
            ))}
            <Button variant="ghost" size="sm" className="ms-auto" onClick={() => setSelectedIds([])}>
              لغو انتخاب
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="max-h-[68vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent odd:bg-transparent">
                {inStatusTab && <TableHead className="w-10" />}
                <TableHead>شماره سند</TableHead>
                <TableHead>تاریخ سند</TableHead>
                <TableHead>شرح سند</TableHead>
                <TableHead>نوع سند</TableHead>
                <TableHead>سال مالی</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead className="w-24">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={`s-${i}`}>
                    {Array.from({ length: inStatusTab ? 8 : 7 }).map((__, c) => (
                      <TableCell key={c}>
                        <span className="block h-4 animate-pulse rounded bg-muted" style={{ width: `${50 + ((i * 9 + c * 13) % 40)}%` }} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow className="hover:bg-transparent odd:bg-transparent">
                  <TableCell colSpan={inStatusTab ? 8 : 7} className="py-14 text-center">
                    <span className="mx-auto mb-3 grid size-16 place-items-center rounded-full bg-primary/5 text-primary">
                      <FileText className="size-7 opacity-70" />
                    </span>
                    <span className="block text-sm font-medium">سندی یافت نشد.</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {hasFilter ? 'فیلترها را پاک کنید یا بازهٔ دیگری انتخاب کنید.' : 'برای این سال مالی هنوز سندی ثبت نشده است.'}
                    </span>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row: VoucherHeadDto) => {
                  const selected = selectedIds.includes(row.id);

                  return (
                    <TableRow key={row.id} data-selected={selected}>
                      {inStatusTab && (
                        <TableCell>
                          <Checkbox
                            checked={selected}
                            onCheckedChange={() => toggleSelected(row.id)}
                            aria-label={`انتخاب سند ${row.docNum ?? ''}`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-mono text-xs">{toPersianDigits(row.docNum ?? '—')}</TableCell>
                      <TableCell>{formatLegacyJalaliDate(row.dateDoc)}</TableCell>
                      <TableCell className="max-w-[22rem] truncate">{row.headDesc ?? '—'}</TableCell>
                      <TableCell>{row.systemTypeId ? (sysTypeNameById.get(row.systemTypeId) ?? '—') : '—'}</TableCell>
                      <TableCell>{row.year ? toPersianDigits(row.year) : '—'}</TableCell>
                      <TableCell>
                        <Badge variant={STATE_TONE[row.docLife ?? 0] ?? 'neutral'}>
                          {getDocLifeLabel(row.docLife)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="flex gap-1">
                          <Button variant="ghost" size="icon" disabled title="ویرایش سند — هنوز ساخته نشده است">
                            <Pencil />
                          </Button>
                          <Button variant="ghost" size="icon" disabled title="سند معکوس — هنوز ساخته نشده است">
                            <Repeat2 />
                          </Button>
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Pagination */}
      {query.data && query.data.totalCount > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            صفحهٔ {toPersianDigits(pageNumber)} از {toPersianDigits(totalPages)}
          </span>
          <span className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pageNumber <= 1}
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            >
              قبلی
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pageNumber >= totalPages}
              onClick={() => setPageNumber((p) => p + 1)}
            >
              بعدی
            </Button>
          </span>
        </div>
      )}
    </div>
  );
}

/** Tile classes kept out of JSX so the active/idle difference is readable in one place. */
function cnTile(active: boolean) {
  return [
    'flex w-full items-start gap-3 rounded-xl border p-3 text-start transition-colors cursor-pointer',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    active ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40 hover:bg-primary/[0.03]',
  ].join(' ');
}
