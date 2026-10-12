import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ManageHistoryOutlinedIcon from '@mui/icons-material/ManageHistoryOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { JalaliDateField, parseLegacyJalali } from '../../components/JalaliDateField';
import { formatPersianDateTime } from '../../lib/format/dates';
import { toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import { useRoles } from '../../lib/roles';
import { auditLogApi, type AuditLogDto } from './api';

const ACTIONS: Record<string, { label: string; color: 'success' | 'info' | 'error' | 'warning' }> = {
  Insert: { label: 'ثبت', color: 'success' },
  Update: { label: 'اصلاح', color: 'info' },
  Delete: { label: 'حذف', color: 'error' },
  Restore: { label: 'بازگردانی', color: 'warning' },
};

/** «از تاریخ» شمسی ⇒ لحظهٔ شروع همان روز به وقت محلی؛ «تا تاریخ» ⇒ شروع روز بعد (ناشامل). */
function jalaliToIso(value: string, endOfDay: boolean): string | undefined {
  const parsed = parseLegacyJalali(value);
  if (!parsed) return undefined;
  const date = parsed.toDate();
  date.setHours(0, 0, 0, 0);
  if (endOfDay) date.setDate(date.getDate() + 1);
  return date.toISOString();
}

/** ثبت/حذف کل رکورد را به‌صورت JSON نگه می‌دارد. */
function parseSnapshot(value: string | null): Record<string, string> | null {
  if (!value || !value.startsWith('{')) return null;
  try {
    return JSON.parse(value) as Record<string, string>;
  } catch {
    return null;
  }
}

function ValueCell({ value }: { value: string | null }) {
  if (value == null) return <Typography variant="body2" color="text.disabled">—</Typography>;
  return (
    <Tooltip title={value.length > 40 ? value : ''}>
      <Typography variant="body2" sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <bdi>{value}</bdi>
      </Typography>
    </Tooltip>
  );
}

/**
 * لاگ تغییرات — هر ثبت، اصلاح، حذف و بازگردانی در سامانه: چه کسی (کد ملی و نام)، کی، از کدام IP، و مقدار قبلی و
 * جدید. فقط نقش مدیر مالی؛ فقط واحد جاری یا واحد و زیرمجموعه. لاگ قابل اصلاح یا حذف نیست.
 */
export function AuditLogPage() {
  const roles = useRoles();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [userId, setUserId] = useState('');
  const [tableName, setTableName] = useState('');
  const [actionType, setActionType] = useState('');
  const [search, setSearch] = useState('');
  const [withSubUnits, setWithSubUnits] = useState(false);
  const [record, setRecord] = useState<{ id: string; label: string } | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<AuditLogDto | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  const allowed = roles.canViewAuditLog;
  const tables = useQuery({ queryKey: ['audit-log-tables'], queryFn: auditLogApi.tables, enabled: allowed, staleTime: Infinity });
  const filters = {
    fromDate: fromDate ? jalaliToIso(fromDate, false) : undefined,
    toDate: toDate ? jalaliToIso(toDate, true) : undefined,
    userId: toLatinDigits(userId).trim() || undefined,
    tableName: tableName || undefined,
    actionType: actionType || undefined,
    recordId: record?.id,
    operationId: operation ?? undefined,
    search: search.trim() || undefined,
    unitScope: (withSubUnits ? 1 : 0) as 0 | 1,
    pageNumber: page + 1,
    pageSize,
  };
  const rows = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => auditLogApi.search(filters),
    placeholderData: keepPreviousData,
    enabled: allowed,
  });

  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(0); };

  if (roles.loaded && !allowed) {
    return (
      <Box>
        <PageHeader eyebrow="گزارش‌ها" icon={<ManageHistoryOutlinedIcon fontSize="small" />} accentColor="warning" title="لاگ تغییرات" />
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
          <Typography color="text.secondary">لاگ تغییرات فقط برای نقش «مدیر مالی» قابل مشاهده است.</Typography>
        </Paper>
      </Box>
    );
  }

  const snapshotValues = snapshot ? parseSnapshot(snapshot.newValue ?? snapshot.oldValue) : null;

  return (
    <Box>
      <PageHeader
        eyebrow="گزارش‌ها"
        icon={<ManageHistoryOutlinedIcon fontSize="small" />}
        accentColor="warning"
        title="لاگ تغییرات"
        description="هر ثبت، اصلاح و حذف در سامانه با کاربر، کد ملی، ساعت، IP و مقدار قبلی و جدید. روی برچسب رکورد بزنید تا تاریخچهٔ کامل آن (مثلاً سند با همهٔ ردیف‌ها) را ببینید."
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 3 }}>
        <Grid container spacing={1.5} sx={{ alignItems: 'center' }}>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <JalaliDateField label="از تاریخ" size="small" value={fromDate} onChange={reset(setFromDate)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <JalaliDateField label="تا تاریخ" size="small" value={toDate} onChange={reset(setToDate)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField label="کد ملی کاربر" size="small" fullWidth value={userId}
              onChange={(e) => reset(setUserId)(e.target.value)} slotProps={{ htmlInput: { maxLength: 10, inputMode: 'numeric' } }} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
            <TextField select label="بخش" size="small" fullWidth value={tableName} onChange={(e) => reset(setTableName)(e.target.value)}
              slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
              <MenuItem value=""><em>همه</em></MenuItem>
              {(tables.data ?? []).map((t) => <MenuItem key={t.table} value={t.table}>{t.title}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 1.5 }}>
            <TextField select label="عملیات" size="small" fullWidth value={actionType} onChange={(e) => reset(setActionType)(e.target.value)}
              slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
              <MenuItem value=""><em>همه</em></MenuItem>
              {Object.entries(ACTIONS).map(([k, a]) => <MenuItem key={k} value={k}>{a.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField label="شمارهٔ سند / نام کاربر" size="small" fullWidth value={search} onChange={(e) => reset(setSearch)(e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, md: 'auto' }}>
            <FormControlLabel control={<Switch checked={withSubUnits} onChange={(e) => reset(setWithSubUnits)(e.target.checked)} />} label="با واحدهای زیرمجموعه" />
          </Grid>
          {(record || operation) && (
            <Grid size={12}>
              <Stack direction="row" spacing={1}>
                {record && <Chip color="primary" label={`تاریخچهٔ: ${record.label}`} onDelete={() => { setRecord(null); setPage(0); }} />}
                {operation && <Chip color="primary" label="همهٔ تغییرات یک ذخیره" onDelete={() => { setOperation(null); setPage(0); }} />}
              </Stack>
            </Grid>
          )}
        </Grid>
      </Paper>

      {rows.error != null && <ErrorBanner error={rows.error} />}

      <Paper variant="outlined" sx={{ borderRadius: 3 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>زمان</TableCell>
                <TableCell>عملیات</TableCell>
                <TableCell>بخش</TableCell>
                <TableCell>رکورد</TableCell>
                <TableCell>فیلد</TableCell>
                <TableCell>مقدار قبلی</TableCell>
                <TableCell>مقدار جدید</TableCell>
                <TableCell>کاربر</TableCell>
                <TableCell>کد ملی</TableCell>
                <TableCell>IP</TableCell>
                <TableCell>واحد</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {(rows.data?.items ?? []).map((r) => {
                const action = ACTIONS[r.actionType] ?? { label: r.actionType, color: 'info' as const };
                const isSnapshot = r.columnName == null && parseSnapshot(r.newValue ?? r.oldValue) != null;
                const label = r.recordLabel ? toPersianDigits(r.recordLabel) : 'مشاهده';
                return (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatPersianDateTime(r.changeDate)}</TableCell>
                    <TableCell><Chip size="small" variant="outlined" color={action.color} label={action.label} /></TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.tableTitle}</TableCell>
                    <TableCell>
                      <Link component="button" variant="body2" onClick={() => { setRecord({ id: r.parentId ?? r.recordId, label: r.parentId ? `${r.tableTitle} (سرسند)` : `${r.tableTitle} ${label}` }); setPage(0); }}>
                        {label}
                      </Link>
                    </TableCell>
                    {isSnapshot ? (
                      <TableCell colSpan={3}>
                        <Button size="small" onClick={() => setSnapshot(r)}>{r.actionType === 'Delete' ? 'مشاهدهٔ رکورد حذف‌شده' : 'مشاهدهٔ همهٔ مقادیر'}</Button>
                      </TableCell>
                    ) : (
                      <>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}><bdi>{r.columnName ?? '—'}</bdi></TableCell>
                        <TableCell><ValueCell value={r.oldValue} /></TableCell>
                        <TableCell><ValueCell value={r.newValue} /></TableCell>
                      </>
                    )}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.userFullName ?? '—'}</TableCell>
                    <TableCell>{toPersianDigits(r.userId)}</TableCell>
                    <TableCell><bdi>{r.ipAddress ?? '—'}</bdi></TableCell>
                    <TableCell>{r.vahedCode ? toPersianDigits(r.vahedCode) : '—'}</TableCell>
                    <TableCell>
                      {r.operationId && (
                        <Tooltip title="همهٔ تغییراتی که در همین ذخیره انجام شد">
                          <IconButton size="small" onClick={() => { setOperation(r.operationId); setPage(0); }}>
                            <LayersOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.data && rows.data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>تغییری با این شرایط پیدا نشد.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={rows.data?.totalCount ?? 0}
          page={page}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[20, 50, 100, 200]}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
          labelRowsPerPage="تعداد در صفحه"
          labelDisplayedRows={({ from, to, count }) => toPersianDigits(`${from}–${to} از ${count}`)}
        />
      </Paper>

      <Dialog open={snapshot != null} onClose={() => setSnapshot(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {snapshot && `${ACTIONS[snapshot.actionType]?.label ?? snapshot.actionType} — ${snapshot.tableTitle}${snapshot.recordLabel ? ` ${toPersianDigits(snapshot.recordLabel)}` : ''}`}
        </DialogTitle>
        <DialogContent dividers>
          {snapshot && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {formatPersianDateTime(snapshot.changeDate)} — {snapshot.userFullName ?? ''} ({toPersianDigits(snapshot.userId)})
            </Typography>
          )}
          <Table size="small">
            <TableBody>
              {Object.entries(snapshotValues ?? {}).map(([k, v]) => (
                <TableRow key={k}>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, width: '40%' }}><bdi>{k}</bdi></TableCell>
                  <TableCell sx={{ wordBreak: 'break-all' }}><bdi>{v}</bdi></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSnapshot(null)}>بستن</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
