import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { FormDialog } from '../../components/FormDialog';
import { formatThousands, normalizeNumericInput, toPersianDigits } from '../../lib/format/numbers';
import { salesApi } from './api';
import type { SalesItem } from './types';

const EMPTY: Omit<SalesItem, 'id'> = { code: '', name: '', kind: 1, groupName: null, unitName: 'عدد', price: 0, standardCost: 0, taxCode: null, isExempt: false, stock: 0, isActive: true };

/** کالا و خدمات واحد: قیمت پیش‌فرض، بهای استاندارد (مبنای بهای تمام‌شده) و موجودی ساده. */
export function SalesItemsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const items = useQuery({ queryKey: ['sales-items', search], queryFn: () => salesApi.items(search), retry: false });
  const setup = useQuery({ queryKey: ['sales-setup'], queryFn: salesApi.setup, retry: false });
  const [editing, setEditing] = useState<{ id: string | null; value: Omit<SalesItem, 'id'> } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const canManage = setup.data?.canManage ?? false;

  async function save() {
    if (!editing) return;
    setErrors([]);
    const r = await salesApi.saveItem(editing.id, editing.value);
    if (!r.success) return setErrors(r.errors);
    setEditing(null);
    await queryClient.invalidateQueries({ queryKey: ['sales-items'] });
  }

  const columns: DataTableColumn<SalesItem>[] = [
    { key: 'code', header: 'کد', render: (i) => <span dir="ltr">{i.code}</span>, width: 110 },
    { key: 'name', header: 'نام', render: (i) => i.name },
    { key: 'kind', header: 'نوع', render: (i) => (i.kind === 1 ? 'کالا' : 'خدمت'), width: 80 },
    { key: 'unit', header: 'واحد', render: (i) => i.unitName, width: 80 },
    { key: 'price', header: 'قیمت (ریال)', align: 'end', render: (i) => toPersianDigits(formatThousands(i.price)), sortValue: (i) => i.price },
    { key: 'cost', header: 'بهای استاندارد', align: 'end', render: (i) => (i.kind === 1 ? toPersianDigits(formatThousands(i.standardCost)) : '—'), sortValue: (i) => i.standardCost },
    { key: 'stock', header: 'موجودی', align: 'end', render: (i) => (i.kind === 1 ? toPersianDigits(i.stock) : '—'), sortValue: (i) => i.stock },
    { key: 'tax', header: 'شناسهٔ مودیان', render: (i) => <span dir="ltr">{i.taxCode ?? '—'}</span> },
    { key: 'flags', header: 'وضعیت', render: (i) => (
      <Stack direction="row" spacing={0.5}>
        {i.isExempt && <Chip size="small" label="معاف" />}
        <Chip size="small" color={i.isActive ? 'success' : 'default'} variant="outlined" label={i.isActive ? 'فعال' : 'غیرفعال'} />
      </Stack>
    ) },
    { key: 'edit', header: '', sortable: false, render: (i) => canManage && (
      <Button size="small" onClick={() => { setErrors([]); setEditing({ id: i.id, value: { ...i } }); }}>ویرایش</Button>
    ) },
  ];

  const v = editing?.value;
  const set = <K extends keyof Omit<SalesItem, 'id'>>(k: K, val: SalesItem[K]) => setEditing((e) => (e ? { ...e, value: { ...e.value, [k]: val } } : e));
  const num = (s: string) => Number(normalizeNumericInput(s).replace(/[^\d]/g, '') || 0);

  return (
    <Box>
      <PageHeader eyebrow="فروش" icon={<Inventory2OutlinedIcon fontSize="small" />} title="کالا و خدمات"
        description="فهرست کالا و خدمات قابل فروش این واحد. موجودی فقط با حواله، فاکتور مستقیم و برگشت تغییر می‌کند؛ انبار کامل ماژول جداست."
        actions={canManage && <Button variant="contained" onClick={() => { setErrors([]); setEditing({ id: null, value: { ...EMPTY } }); }}>کالا / خدمت جدید</Button>} />
      {items.error != null && <ErrorBanner error={items.error} />}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <TextField size="small" placeholder="جستجوی کد یا نام…" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ mb: 2, minWidth: 280 }} />
        <DataTable columns={columns} rows={items.data ?? []} getRowKey={(i) => i.id} isLoading={items.isLoading} emptyMessage="کالایی تعریف نشده است." />
      </Paper>

      {editing && v && (
        <FormDialog open onClose={() => setEditing(null)} title={editing.id ? 'ویرایش کالا / خدمت' : 'کالا / خدمت جدید'} maxWidth="sm"
          icon={<Inventory2OutlinedIcon fontSize="small" />}
          onSubmit={(e) => { e.preventDefault(); void save(); }}
          actions={<><Button color="inherit" onClick={() => setEditing(null)}>انصراف</Button><Button type="submit" variant="contained">ذخیره</Button></>}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2}>
              <TextField size="small" label="کد" required value={v.code} onChange={(e) => set('code', e.target.value)} slotProps={{ htmlInput: { dir: 'ltr' } }} />
              <TextField select size="small" label="نوع" value={v.kind} onChange={(e) => set('kind', Number(e.target.value) as 1 | 2)} sx={{ minWidth: 120 }}>
                <MenuItem value={1}>کالا</MenuItem><MenuItem value={2}>خدمت</MenuItem>
              </TextField>
              <TextField size="small" label="واحد سنجش" required value={v.unitName} onChange={(e) => set('unitName', e.target.value)} />
            </Stack>
            <TextField size="small" label="نام" required value={v.name} onChange={(e) => set('name', e.target.value)} />
            <TextField size="small" label="گروه" value={v.groupName ?? ''} onChange={(e) => set('groupName', e.target.value || null)} />
            <Stack direction="row" spacing={2}>
              <TextField size="small" fullWidth label="قیمت فروش (ریال)" value={toPersianDigits(formatThousands(v.price))} onChange={(e) => set('price', num(e.target.value))} />
              {v.kind === 1 && <TextField size="small" fullWidth label="بهای استاندارد (ریال)" helperText="مبنای بهای تمام‌شده" value={toPersianDigits(formatThousands(v.standardCost))} onChange={(e) => set('standardCost', num(e.target.value))} />}
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField size="small" fullWidth label="شناسهٔ ۱۳ رقمی مودیان" value={v.taxCode ?? ''} onChange={(e) => set('taxCode', e.target.value || null)} slotProps={{ htmlInput: { dir: 'ltr', maxLength: 13 } }} />
              {v.kind === 1 && !editing.id && <TextField size="small" fullWidth type="number" label="موجودی اول دوره" value={v.stock} onChange={(e) => set('stock', Number(e.target.value))} />}
            </Stack>
            <Stack direction="row">
              <FormControlLabel control={<Checkbox checked={v.isExempt} onChange={(e) => set('isExempt', e.target.checked)} />} label="معاف از مالیات بر ارزش افزوده" />
              <FormControlLabel control={<Checkbox checked={v.isActive} onChange={(e) => set('isActive', e.target.checked)} />} label="فعال" />
            </Stack>
            {errors.length > 0 && <Alert severity="error">{errors.map((m, i) => <div key={i}>{m}</div>)}</Alert>}
          </Stack>
        </FormDialog>
      )}
    </Box>
  );
}
