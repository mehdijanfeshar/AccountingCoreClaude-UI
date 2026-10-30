import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ManageSearchOutlinedIcon from '@mui/icons-material/ManageSearchOutlined';
import AutorenewOutlinedIcon from '@mui/icons-material/AutorenewOutlined';
import { PageHeader } from '../../../components/PageHeader';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { ABILITIES, useRoles } from '../../../lib/roles';
import { useNotify } from '../../../lib/notifications/NotificationProvider';
import { useSession } from '../../../lib/session/SessionContext';
import { formatThousands, toPersianDigits } from '../../../lib/format/numbers';
import { vahedTypesApi } from '../../coding-permissions/api';
import { historyApi } from '../api';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import type { HistoryPattern, HistoryPatternPage } from '../types';

const MAX_YEARS = 10;

function yearsText(years: HistoryPattern['years']): string {
  const text = Array.isArray(years) ? years.join('، ') : years;
  return text ? toPersianDigits(text) : '—';
}

function accountLabels(p: HistoryPattern): Record<string, string> {
  return Object.fromEntries(p.lines.map((l) => [l.moinId, `${l.moinCode} - ${l.moinTitle}`]));
}

/**
 * کشف الگو از اسناد گذشته (مدیر ستاد): الگوهای تکرارشدهٔ سندها را بازسازی و فهرست می‌کند و هر کدام را بدون الگو
 * به پیش‌نویس الگوی ذخیره‌نشده تبدیل می‌کند. فقط پیشنهاد است؛ ذخیره با خود مدیر ستاد در طراح الگوست.
 */
export function TemplateDiscoverPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { financialYear } = useSession();
  const { hasAbility, loaded } = useRoles();
  const isSetad = hasAbility(ABILITIES.TemplatesDefine);
  const readOnly = loaded && !isSetad;

  const currentYear = Number(financialYear) || 1405;
  const yearOptions = Array.from({ length: 16 }, (_, i) => currentYear - i);
  const [fromYear, setFromYear] = useState(currentYear - 4);
  const [toYear, setToYear] = useState(currentYear);
  const spanOk = toYear >= fromYear && toYear - fromYear + 1 <= MAX_YEARS;

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [minCount, setMinCount] = useState('');
  const [vahedType, setVahedType] = useState('');
  const [onlyUncovered, setOnlyUncovered] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(0); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const vahedTypes = useQuery({ queryKey: ['vahed-types'], queryFn: () => vahedTypesApi.list(), staleTime: 300_000 });

  const filters = {
    fromYear, toYear, vahedType: vahedType || undefined, minCount: Number(minCount) > 0 ? Number(minCount) : undefined,
    search: search || undefined, page: page + 1, pageSize,
  };
  const list = useQuery({
    queryKey: ['history-patterns', filters],
    queryFn: () => historyApi.patterns(filters),
    enabled: spanOk,
    placeholderData: keepPreviousData,
    retry: false,
  });

  const rebuild = useMutation({
    mutationFn: () => historyApi.rebuild({ fromYear, toYear }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['history-patterns'] }),
  });
  const convert = useMutation({
    mutationFn: ({ p, meaning }: { p: HistoryPattern; meaning?: number }) => historyApi.toTemplate(p.id, meaning),
    onSuccess: (historyDraft, { p }) => navigate('/assistant/templates/new', { state: { historyDraft, accountLabels: accountLabels(p) } }),
  });
  const convertingKey = convert.isPending && convert.variables ? `${convert.variables.p.id}:${convert.variables.meaning ?? ''}` : null;

  const [toDelete, setToDelete] = useState<HistoryPattern | null>(null);
  const remove = useMutation({
    mutationFn: (p: HistoryPattern) => historyApi.remove(p.id),
    onSuccess: (_, p) => {
      queryClient.setQueryData<HistoryPatternPage>(['history-patterns', filters], (old) =>
        old ? { ...old, items: old.items.filter((x) => x.id !== p.id), total: Math.max(0, old.total - 1) } : old);
      setToDelete(null);
    },
  });

  const notify = useNotify();
  const [bulkOpen, setBulkOpen] = useState(false);
  const bulkRemove = useMutation({
    mutationFn: () => historyApi.removeUncovered({
      fromYear, toYear, vahedType: filters.vahedType, minCount: filters.minCount, search: filters.search,
    }),
    onSuccess: async (r) => {
      setBulkOpen(false);
      notify(`${toPersianDigits(r.count)} پیشنهاد حذف شد`);
      await queryClient.invalidateQueries({ queryKey: ['history-patterns'] });
    },
  });
  const activeFilters = [
    filters.search ? `جستجو: «${filters.search}»` : null,
    filters.minCount ? `حداقل ${toPersianDigits(filters.minCount)} سند` : null,
    filters.vahedType ? `نوع واحد: ${vahedTypes.data?.find((t) => t.typeCode === filters.vahedType)?.typeName ?? filters.vahedType}` : null,
  ].filter(Boolean);

  const items = (list.data?.items ?? []).filter((p) => !onlyUncovered || !p.coveredByTemplate);
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(0); };

  return (
    <Box>
      <PageHeader
        eyebrow="حسابیار"
        icon={<ManageSearchOutlinedIcon fontSize="small" />}
        accentColor="secondary"
        title="کشف الگو از اسناد گذشته"
        description="حسابیار اسناد سال‌های قبل را بررسی می‌کند و عملیات تکراری را که هنوز الگو ندارد پیشنهاد می‌دهد؛ هر پیشنهاد را می‌توانید به یک الگوی جدید تبدیل کنید."
        actions={<Button color="inherit" sx={{ minHeight: 44 }} onClick={() => navigate('/assistant/templates')}>الگوهای عملیات</Button>}
      />

      {readOnly && <Alert severity="info" sx={{ mb: 2 }}>بازسازی و تبدیل به الگو فقط برای مدیر ستاد ممکن است.</Alert>}

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 3 }}>
        <Typography variant="body1" sx={{ fontWeight: 700, mb: 1.25 }}>بازسازی از اسناد</Typography>
        <Grid container spacing={1.5} sx={{ alignItems: 'center' }}>
          <Grid size={{ xs: 6, sm: 3, md: 2 }}>
            <TextField select size="small" fullWidth label="از سال" value={fromYear} onChange={(e) => reset(setFromYear)(Number(e.target.value))}>
              {yearOptions.map((y) => <MenuItem key={y} value={y}>{toPersianDigits(y)}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, sm: 3, md: 2 }}>
            <TextField select size="small" fullWidth label="تا سال" value={toYear} onChange={(e) => reset(setToYear)(Number(e.target.value))}>
              {yearOptions.map((y) => <MenuItem key={y} value={y}>{toPersianDigits(y)}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Button
              variant="contained"
              fullWidth
              sx={{ minHeight: 44 }}
              startIcon={rebuild.isPending ? <CircularProgress size={18} color="inherit" /> : <AutorenewOutlinedIcon />}
              disabled={!spanOk || rebuild.isPending || readOnly}
              onClick={() => rebuild.mutate()}
            >
              {rebuild.isPending ? 'در حال بازسازی…' : 'بازسازی از اسناد'}
            </Button>
          </Grid>
        </Grid>
        {!spanOk && (
          <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
            بازه باید معتبر باشد و حداکثر {toPersianDigits(MAX_YEARS)} سال را بگیرد.
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          بازسازی ممکن است چند دقیقه طول بکشد؛ بهتر است در ساعات غیرکاری انجام شود. تا پایان کار، صفحه را نبندید.
        </Typography>
        {rebuild.isPending && <LinearProgress sx={{ mt: 1.5 }} />}
        {rebuild.isError && <Box sx={{ mt: 1.5 }}><ErrorBanner error={rebuild.error} /></Box>}
        {rebuild.data && (
          <Alert severity="success" sx={{ mt: 1.5 }}>
            {toPersianDigits(rebuild.data.patternCount)} الگو از {toPersianDigits(rebuild.data.voucherCount)} سند ساخته شد
            (مدت: {toPersianDigits(Math.max(1, Math.round(rebuild.data.elapsedMs / 1000)))} ثانیه).
          </Alert>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 3 }}>
        <Grid container spacing={1.5} sx={{ alignItems: 'center' }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField size="small" fullWidth label="جستجو در کلمه‌ها و شرح‌ها" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <TextField
              size="small" fullWidth label="حداقل تعداد سند" value={minCount}
              onChange={(e) => reset(setMinCount)(e.target.value.replace(/\D/g, ''))}
              slotProps={{ htmlInput: { inputMode: 'numeric', dir: 'ltr' } }}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <TextField select size="small" fullWidth label="نوع واحد" value={vahedType} onChange={(e) => reset(setVahedType)(e.target.value)}
              slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
              <MenuItem value=""><em>همه</em></MenuItem>
              {(vahedTypes.data ?? []).filter((t) => t.typeCode).map((t) => (
                <MenuItem key={t.typeCode!} value={t.typeCode!}>{t.typeName ?? t.typeCode}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <FormControlLabel sx={{ minHeight: 44 }} control={<Switch checked={onlyUncovered} onChange={(e) => setOnlyUncovered(e.target.checked)} />} label="فقط بدون الگو" />
          </Grid>
          {isSetad && (
            <Grid size={12}>
              <Button variant="outlined" color="error" sx={{ minHeight: 44 }} disabled={!list.data || list.data.total === 0 || !spanOk || bulkRemove.isPending}
                onClick={() => { bulkRemove.reset(); setBulkOpen(true); }}>
                حذف همهٔ پیشنهادهای بدون الگو
              </Button>
            </Grid>
          )}
        </Grid>
      </Paper>

      {list.isError && <ErrorBanner error={list.error} />}
      {convert.isError && <ErrorBanner error={convert.error} />}
      {list.isLoading && spanOk && <CircularProgress sx={{ display: 'block', mx: 'auto', my: 4 }} />}

      {list.data?.needsRebuild && (
        <Card variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
          <Typography variant="body1" sx={{ mb: 1 }}>هنوز الگویی از اسناد گذشته ساخته نشده است.</Typography>
          <Typography variant="body2" color="text.secondary">
            بازهٔ سال‌ها را انتخاب کنید و دکمهٔ «بازسازی از اسناد» را بزنید.
          </Typography>
        </Card>
      )}

      {list.data && !list.data.needsRebuild && items.length === 0 && (
        <Card variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
          <Typography variant="body2" color="text.secondary">با این فیلترها الگوی تکراری پیدا نشد.</Typography>
        </Card>
      )}

      <Stack spacing={1.5}>
        {items.map((p) => (
          <PatternCard key={p.id} pattern={p} readOnly={readOnly} convertingKey={convertingKey}
            busy={convert.isPending} onConvert={(meaning) => convert.mutate({ p, meaning })} onDelete={() => { remove.reset(); setToDelete(p); }} onOpenTemplate={(id) => navigate(`/assistant/templates/${id}/edit`)} />
        ))}
      </Stack>

      <ConfirmDialog
        open={bulkOpen}
        title="حذف همهٔ پیشنهادهای بدون الگو"
        description={`همهٔ پیشنهادهایی که با فیلتر فعلی نمایش داده می‌شوند و هنوز به الگو تبدیل نشده‌اند از فهرست حذف می‌شوند (بازسازی بعدی دوباره اسناد را بررسی می‌کند و اگر هنوز تکراری باشند دوباره پیشنهاد می‌دهد). پیشنهادهای دارای الگو حذف نمی‌شوند.${
          activeFilters.length > 0 ? ` فیلتر فعال: ${activeFilters.join(' · ')}.` : ''
        } ادامه می‌دهید؟`}
        confirmLabel="حذف همه"
        pending={bulkRemove.isPending}
        error={bulkRemove.error}
        onConfirm={() => bulkRemove.mutate()}
        onCancel={() => setBulkOpen(false)}
      />

      <ConfirmDialog
        open={toDelete !== null}
        title="حذف پیشنهاد"
        description="این پیشنهاد از فهرست حذف می‌شود (بازسازی بعدی دوباره اسناد را بررسی می‌کند و اگر هنوز تکراری باشد دوباره پیشنهاد می‌دهد). ادامه می‌دهید؟"
        confirmLabel="حذف"
        pending={remove.isPending}
        error={remove.error}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
        onCancel={() => setToDelete(null)}
      />

      {list.data && !list.data.needsRebuild && (
        <TablePagination
          component="div"
          count={list.data.total}
          page={page}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[10, 20, 50]}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
          labelRowsPerPage="تعداد در صفحه"
          labelDisplayedRows={({ from, to, count }) => toPersianDigits(`${from}–${to} از ${count}`)}
        />
      )}
    </Box>
  );
}

function PatternCard({ pattern: p, readOnly, convertingKey, busy, onConvert, onDelete, onOpenTemplate }: {
  pattern: HistoryPattern; readOnly: boolean; convertingKey: string | null; busy: boolean; onConvert: (meaning?: number) => void; onDelete: () => void; onOpenTemplate: (id: string) => void;
}) {
  const last = p.lastDate ? new Date(p.lastDate) : null;
  const converting = convertingKey === `${p.id}:`;
  const meanings = p.meanings ?? [];
  return (
    <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
      <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', rowGap: 0.75, mb: 1.25 }}>
        {p.keywords.map((k) => (
          <Chip key={k.word} size="small" color="secondary" variant="outlined" label={`${k.word} · ${toPersianDigits(k.count)}`} />
        ))}
        {p.keywords.length === 0 && <Typography variant="caption" color="text.secondary">بدون کلمهٔ کلیدی</Typography>}
      </Stack>

      <Box sx={{ overflowX: 'auto', mb: 1.25 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>حساب</TableCell>
              <TableCell>سمت</TableCell>
              <TableCell>سهم ٪</TableCell>
              <TableCell>تفصیلی</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {p.lines.map((l, i) => (
              <TableRow key={i}>
                <TableCell>{toPersianDigits(l.moinCode)} - {l.moinTitle}</TableCell>
                <TableCell>{l.side === 1 ? 'بدهکار' : 'بستانکار'}</TableCell>
                <TableCell>{toPersianDigits(Math.round(l.share))}</TableCell>
                <TableCell>
                  {l.detailLevels.length === 0
                    ? '—'
                    : l.detailLevels.map((d) => `سطح ${toPersianDigits(d.level)}: ${d.groupTitles.join('، ') || '—'}`).join(' · ')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {toPersianDigits(p.voucherCount)} سند در {toPersianDigits(p.unitCount)} واحد · سال‌ها: {yearsText(p.years)} · مبلغ میانه: {toPersianDigits(formatThousands(p.medianAmount))} ریال
        {last && !Number.isNaN(last.getTime()) ? ` · آخرین: ${toPersianDigits(last.toLocaleDateString('fa-IR'))}` : ''}
      </Typography>

      {p.sampleDescriptions.length > 0 && (
        <Box sx={{ mt: 0.75 }}>
          {p.sampleDescriptions.slice(0, 3).map((d, i) => (
            <Typography key={i} variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>«{d}»</Typography>
          ))}
        </Box>
      )}

      {meanings.length > 1 && (
        <Box sx={{ mt: 1.5 }}>
          <Alert severity="info" sx={{ mb: 1 }}>
            این حساب‌ها برای {toPersianDigits(meanings.length)} کار متفاوت استفاده شده‌اند. بهتر است برای هر کار یک الگوی جدا بسازید.
          </Alert>
          <Stack spacing={1}>
            {meanings.map((m) => (
              <Paper key={m.index} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {m.title} <Typography component="span" variant="caption" color="text.secondary">· حدود {toPersianDigits(Math.round(m.share))}٪ اسناد</Typography>
                    </Typography>
                    {m.samples.filter((s) => s !== m.title).slice(0, 2).map((s, i) => (
                      <Typography key={i} variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic' }}>«{s}»</Typography>
                    ))}
                  </Box>
                  {!readOnly && (
                    <Button variant="outlined" sx={{ minHeight: 44, flexShrink: 0 }} disabled={busy} onClick={() => onConvert(m.index)}>
                      {convertingKey === `${p.id}:${m.index}` ? 'در حال آماده‌سازی…' : 'تبدیل این کار به الگو'}
                    </Button>
                  )}
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Box>
      )}

      <Stack direction="row" spacing={1} sx={{ mt: 1.5, justifyContent: 'flex-end' }}>
        {!p.coveredByTemplate && !readOnly && (
          <Button variant="outlined" color="error" sx={{ minHeight: 44 }} disabled={busy} onClick={onDelete}>حذف</Button>
        )}
        {p.coveredByTemplate ? (
          <Chip
            color="success"
            variant="outlined"
            label={`الگو دارد: ${p.coveredByTemplate.title}`}
            onClick={() => onOpenTemplate(p.coveredByTemplate!.id)}
            sx={{ minHeight: 44, borderRadius: 22 }}
          />
        ) : (
          <Button variant={meanings.length > 1 ? 'outlined' : 'contained'} sx={{ minHeight: 44 }} disabled={readOnly || busy} onClick={() => onConvert()}>
            {converting ? 'در حال آماده‌سازی…' : meanings.length > 1 ? 'همه در یک الگو' : 'تبدیل به الگو'}
          </Button>
        )}
      </Stack>
      {!p.coveredByTemplate && readOnly && (
        <Alert severity="info" sx={{ mt: 1 }}><AlertTitle>فقط مشاهده</AlertTitle>تبدیل به الگو برای مدیر ستاد است.</Alert>
      )}
    </Card>
  );
}
