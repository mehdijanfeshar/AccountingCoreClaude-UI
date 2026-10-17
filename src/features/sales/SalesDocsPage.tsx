import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { formatThousands, toPersianDigits } from '../../lib/format/numbers';
import { salesApi } from './api';
import { DOC_TYPE_LABEL, STATUS_LABEL, type SalesDocListRow, type SalesDocStatus, type SalesDocType } from './types';
import { StatusChip } from './salesUi';

/** فهرست اسناد فروش با تب نوع سند، فیلتر وضعیت و جستجوی شماره/مشتری/مرجع. */
export function SalesDocsPage() {
  const navigate = useNavigate();
  const [type, setType] = useState<SalesDocType | 0>(0);
  const [status, setStatus] = useState<SalesDocStatus | 0>(0);
  const [search, setSearch] = useState('');
  const docs = useQuery({
    queryKey: ['sales-docs', type, status, search],
    queryFn: () => salesApi.docs({ type: type || undefined, status: status || undefined, search: search || undefined, page: 1, pageSize: 200 }),
    retry: false,
  });

  const columns: DataTableColumn<SalesDocListRow>[] = [
    { key: 'no', header: 'شماره', render: (d) => <b dir="ltr">{d.docNo ?? '—'}</b>, sortValue: (d) => d.docNo ?? '' },
    { key: 'date', header: 'تاریخ', render: (d) => formatLegacyJalaliDate(d.docDate), sortValue: (d) => d.docDate },
    { key: 'type', header: 'نوع', render: (d) => DOC_TYPE_LABEL[d.docType] },
    { key: 'customer', header: 'مشتری', render: (d) => d.customerName ?? '—' },
    { key: 'total', header: 'مبلغ نهایی (ریال)', align: 'end', render: (d) => toPersianDigits(formatThousands(d.total)), sortValue: (d) => d.total },
    { key: 'status', header: 'وضعیت', render: (d) => <StatusChip status={d.status} />, sortValue: (d) => d.status },
    { key: 'open', header: '', sortable: false, render: (d) => <Button size="small" onClick={() => navigate(`/sales/docs/${d.id}`)}>بررسی</Button> },
  ];

  return (
    <Box>
      <PageHeader eyebrow="فروش" icon={<ListAltOutlinedIcon fontSize="small" />} title="اسناد فروش"
        description="پیش‌فاکتور، سفارش، حواله، فاکتور و برگشت از فروش — با ارتباط مبدأ و مقصد. سند قطعی فقط با برگشت از فروش اصلاح می‌شود."
        actions={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => navigate('/sales/docs/new?type=4')}>فاکتور مستقیم</Button>
            <Button variant="outlined" onClick={() => navigate('/sales/docs/new?type=2')}>سفارش جدید</Button>
            <Button variant="contained" onClick={() => navigate('/sales/docs/new?type=1')}>پیش‌فاکتور جدید</Button>
          </Stack>
        } />
      {docs.error != null && <ErrorBanner error={docs.error} />}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <Tabs value={type} onChange={(_, v) => setType(v)} variant="scrollable" sx={{ mb: 1.5 }}>
          <Tab value={0} label="همهٔ اسناد" />
          {([1, 2, 3, 4, 5] as SalesDocType[]).map((t) => <Tab key={t} value={t} label={DOC_TYPE_LABEL[t]} />)}
        </Tabs>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
          <TextField size="small" placeholder="شماره سند، مشتری یا شمارهٔ سفارش مشتری…" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 300 }} />
          <TextField select size="small" label="وضعیت" value={status} onChange={(e) => setStatus(Number(e.target.value) as SalesDocStatus | 0)} sx={{ minWidth: 160 }}>
            <MenuItem value={0}>همه</MenuItem>
            {([1, 2, 3, 4, 9] as SalesDocStatus[]).map((s) => <MenuItem key={s} value={s}>{STATUS_LABEL[s]}</MenuItem>)}
          </TextField>
        </Stack>
        <DataTable columns={columns} rows={docs.data?.items ?? []} getRowKey={(d) => d.id} isLoading={docs.isLoading} emptyMessage="سندی پیدا نشد." />
      </Paper>
    </Box>
  );
}
