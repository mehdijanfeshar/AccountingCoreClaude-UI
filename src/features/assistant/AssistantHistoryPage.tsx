import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { JalaliDateField } from '../../components/JalaliDateField';
import { toPersianDigits } from '../../lib/format/numbers';
import { assistantHistoryApi, templateDesignApi } from './api';

const CHANNEL_LABEL: Record<string, string> = { Form: 'از الگو', Compose: 'سند کامل', Agent: 'هوش مصنوعی' };

/**
 * سندهای حسابیار — چه کسی، کی، با کدام الگو، چه سندی ساخت (از ردپای TB_OP_EXECUTION، واحد جاری).
 * کلیک روی هر ردیف ⇒ مشاهدهٔ همان سند.
 */
export function AssistantHistoryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [templateId, setTemplateId] = useState(searchParams.get('templateId') ?? '');
  const [channel, setChannel] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const templates = useQuery({ queryKey: ['operation-template-definitions'], queryFn: templateDesignApi.list, retry: false });
  const filters = { fromDate: fromDate || undefined, toDate: toDate || undefined, templateId: templateId || undefined, channel: channel || undefined, mineOnly, page: page + 1, pageSize };
  const rows = useQuery({
    queryKey: ['operation-executions', filters],
    queryFn: () => assistantHistoryApi.executions(filters),
    placeholderData: keepPreviousData,
  });

  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(0); };

  return (
    <Box>
      <PageHeader
        eyebrow="حسابیار"
        icon={<HistoryOutlinedIcon fontSize="small" />}
        accentColor="secondary"
        title="سندهای حسابیار"
        description="همهٔ سندهایی که در واحد شما با حسابیار ساخته شده‌اند: با کدام الگو، توسط چه کسی و چه زمانی."
        actions={<Button variant="outlined" onClick={() => navigate('/assistant')}>ثبت سند با حسابیار</Button>}
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 3 }}>
        <Grid container spacing={1.5} sx={{ alignItems: 'center' }}>
          <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
            <JalaliDateField label="از تاریخ" size="small" fullWidth value={fromDate} onChange={reset(setFromDate)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
            <JalaliDateField label="تا تاریخ" size="small" fullWidth value={toDate} onChange={reset(setToDate)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField select label="الگو" size="small" fullWidth value={templateId} onChange={(e) => reset(setTemplateId)(e.target.value)}
              slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
              <MenuItem value=""><em>همه</em></MenuItem>
              {(templates.data ?? []).map((t) => <MenuItem key={t.id} value={t.id}>{t.title}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField select label="نوع ثبت" size="small" fullWidth value={channel} onChange={(e) => reset(setChannel)(e.target.value)}
              slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
              <MenuItem value=""><em>همه</em></MenuItem>
              <MenuItem value="Form">از الگو</MenuItem>
              <MenuItem value="Compose">سند کامل</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControlLabel control={<Switch checked={mineOnly} onChange={(e) => reset(setMineOnly)(e.target.checked)} />} label="فقط سندهای من" />
          </Grid>
        </Grid>
      </Paper>

      {rows.error != null && <ErrorBanner error={rows.error} />}

      <Paper variant="outlined" sx={{ borderRadius: 3 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>زمان</TableCell>
                <TableCell>شمارهٔ سند</TableCell>
                <TableCell>الگو</TableCell>
                <TableCell>نوع ثبت</TableCell>
                <TableCell>کاربر</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(rows.data?.items ?? []).map((r) => (
                <TableRow key={r.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/operation/vouchers/${r.voucherId}/view`)}>
                  <TableCell>{toPersianDigits(new Date(r.createdAtUtc).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' }))}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{toPersianDigits(r.voucherNo)}</TableCell>
                  <TableCell>{r.templateTitle ?? (r.templateCode === 'MANUAL' ? 'سند دستی' : r.templateCode)}</TableCell>
                  <TableCell><Chip size="small" variant="outlined" label={CHANNEL_LABEL[r.channel] ?? r.channel} /></TableCell>
                  <TableCell sx={{ direction: 'ltr', textAlign: 'right' }}>{r.createdBy}</TableCell>
                </TableRow>
              ))}
              {rows.data && rows.data.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>سندی با این شرایط پیدا نشد.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={rows.data?.total ?? 0}
          page={page}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[20, 50, 100]}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
          labelRowsPerPage="تعداد در صفحه"
          labelDisplayedRows={({ from, to, count }) => toPersianDigits(`${from}–${to} از ${count}`)}
        />
      </Paper>
    </Box>
  );
}
