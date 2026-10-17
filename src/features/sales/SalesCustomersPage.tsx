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
import Typography from '@mui/material/Typography';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { FormDialog } from '../../components/FormDialog';
import { TafsiliItemSelect, type TafsiliSelection } from '../../components/dynamic-tafsili/TafsiliItemSelect';
import { useTafsiliLevels } from '../../components/dynamic-tafsili/useTafsiliLevels';
import { formatThousands, normalizeNumericInput, toPersianDigits } from '../../lib/format/numbers';
import { salesApi } from './api';
import type { PersonKind, SalesCustomer } from './types';

interface Draft {
  id: string | null;
  tafsili: TafsiliSelection | null;
  personKind: PersonKind;
  nationalId: string;
  economicCode: string;
  postalCode: string;
  creditLimit: number;
  payTerms: number;
  isBlocked: boolean;
}

/**
 * مشتری = تفصیلی موجود + پروفایل فروش. تفصیلی از همان فهرست قابل انتخاب روی «حساب‌های دریافتنی» واحد برداشته
 * می‌شود تا سند حسابداری فروش حتماً بتواند تفصیلی مشتری را روی آن حساب بنشاند.
 */
export function SalesCustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const customers = useQuery({ queryKey: ['sales-customers', search], queryFn: () => salesApi.customers(search), retry: false });
  const setup = useQuery({ queryKey: ['sales-setup'], queryFn: salesApi.setup, retry: false });
  const ar = setup.data?.accounts.find((a) => a.roleKey === 'ar');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  function open(c: SalesCustomer | null) {
    setErrors([]);
    setDraft(c
      ? { id: c.id, tafsili: { levelId: '', tafsiliId: c.tafsiliId, label: `${c.tafsiliCode ?? ''} - ${c.name ?? ''}` }, personKind: c.personKind, nationalId: c.nationalId ?? '', economicCode: c.economicCode ?? '', postalCode: c.postalCode ?? '', creditLimit: c.creditLimit, payTerms: c.payTerms, isBlocked: c.isBlocked }
      : { id: null, tafsili: null, personKind: 2, nationalId: '', economicCode: '', postalCode: '', creditLimit: 0, payTerms: 30, isBlocked: false });
  }

  async function save() {
    if (!draft?.tafsili) return setErrors(['تفصیلی مشتری را انتخاب کنید.']);
    const r = await salesApi.saveCustomer(draft.id, {
      tafsiliId: draft.tafsili.tafsiliId, personKind: draft.personKind, nationalId: draft.nationalId || null, economicCode: draft.economicCode || null,
      postalCode: draft.postalCode || null, creditLimit: draft.creditLimit, payTerms: draft.payTerms, isBlocked: draft.isBlocked,
    });
    if (!r.success) return setErrors(r.errors);
    setDraft(null);
    await queryClient.invalidateQueries({ queryKey: ['sales-customers'] });
  }

  const columns: DataTableColumn<SalesCustomer>[] = [
    { key: 'name', header: 'مشتری', render: (c) => <><b>{c.name}</b><Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{c.personKind === 2 ? 'حقوقی' : 'حقیقی'} · مهلت پرداخت {toPersianDigits(c.payTerms)} روز</Typography></> , sortValue: (c) => c.name ?? '' },
    { key: 'code', header: 'کد تفصیلی', render: (c) => <span dir="ltr">{c.tafsiliCode}</span> },
    { key: 'nid', header: 'شناسه / کد ملی', render: (c) => <span dir="ltr">{c.nationalId ?? '—'}</span> },
    { key: 'limit', header: 'سقف اعتبار', align: 'end', render: (c) => (c.creditLimit ? toPersianDigits(formatThousands(c.creditLimit)) : '—'), sortValue: (c) => c.creditLimit },
    { key: 'moadian', header: 'اطلاعات مودیان', render: (c) => <Chip size="small" variant="outlined" color={c.completeForMoadian ? 'success' : c.personKind === 2 ? 'error' : 'warning'} label={c.completeForMoadian ? 'کامل · نوع اول' : 'ناقص · نوع دوم'} /> },
    { key: 'state', header: 'وضعیت', render: (c) => <Chip size="small" color={c.isBlocked ? 'error' : 'success'} variant="outlined" label={c.isBlocked ? 'مسدود' : 'فعال'} /> },
    { key: 'edit', header: '', sortable: false, render: (c) => <Button size="small" onClick={() => open(c)}>ویرایش</Button> },
  ];

  return (
    <Box>
      <PageHeader eyebrow="فروش" icon={<GroupsOutlinedIcon fontSize="small" />} title="مشتریان"
        description="هر مشتری یکی از تفصیلی‌های موجود است با سقف اعتبار، مهلت پرداخت و اطلاعات هویتی برای صورتحساب نوع اول مودیان."
        actions={<Button variant="contained" disabled={!ar} onClick={() => open(null)}>مشتری جدید</Button>} />
      {customers.error != null && <ErrorBanner error={customers.error} />}
      {setup.data && !ar && <Alert severity="warning" sx={{ mb: 2 }}>اول در «تنظیمات فروش» حساب «حساب‌های دریافتنی» را تعریف کنید؛ مشتری از تفصیلی‌های همان حساب انتخاب می‌شود.</Alert>}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <TextField size="small" placeholder="جستجوی نام، کد یا شناسهٔ ملی…" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ mb: 2, minWidth: 280 }} />
        <DataTable columns={columns} rows={customers.data ?? []} getRowKey={(c) => c.id} isLoading={customers.isLoading} emptyMessage="مشتری‌ای تعریف نشده است." />
      </Paper>

      {draft && ar && (
        <FormDialog open onClose={() => setDraft(null)} title={draft.id ? 'ویرایش مشتری' : 'مشتری جدید'} maxWidth="sm" icon={<GroupsOutlinedIcon fontSize="small" />}
          onSubmit={(e) => { e.preventDefault(); void save(); }}
          actions={<><Button color="inherit" onClick={() => setDraft(null)}>انصراف</Button><Button type="submit" variant="contained">ذخیره</Button></>}>
          <Stack spacing={2}>
            <CustomerTafsiliField accountId={ar.accountId} value={draft.tafsili} onChange={(t) => setDraft({ ...draft, tafsili: t })} />
            <Stack direction="row" spacing={2}>
              <TextField select size="small" label="نوع شخص" value={draft.personKind} onChange={(e) => setDraft({ ...draft, personKind: Number(e.target.value) as PersonKind })} sx={{ minWidth: 120 }}>
                <MenuItem value={2}>حقوقی</MenuItem><MenuItem value={1}>حقیقی</MenuItem>
              </TextField>
              <TextField size="small" fullWidth label={draft.personKind === 2 ? 'شناسهٔ ملی (۱۱ رقم)' : 'کد ملی (۱۰ رقم)'} value={draft.nationalId}
                onChange={(e) => setDraft({ ...draft, nationalId: e.target.value })} slotProps={{ htmlInput: { dir: 'ltr' } }} />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField size="small" fullWidth label="کد اقتصادی" value={draft.economicCode} onChange={(e) => setDraft({ ...draft, economicCode: e.target.value })} slotProps={{ htmlInput: { dir: 'ltr' } }} />
              <TextField size="small" fullWidth label="کد پستی (۱۰ رقم)" value={draft.postalCode} onChange={(e) => setDraft({ ...draft, postalCode: e.target.value })} slotProps={{ htmlInput: { dir: 'ltr' } }} />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField size="small" fullWidth label="سقف اعتبار (ریال، صفر = بدون سقف)" disabled={!setup.data?.canManage}
                value={toPersianDigits(formatThousands(draft.creditLimit))} onChange={(e) => setDraft({ ...draft, creditLimit: Number(normalizeNumericInput(e.target.value).replace(/[^\d]/g, '') || 0) })} />
              <TextField size="small" type="number" label="مهلت پرداخت (روز)" value={draft.payTerms} onChange={(e) => setDraft({ ...draft, payTerms: Number(e.target.value) })} />
            </Stack>
            <FormControlLabel disabled={!setup.data?.canManage} control={<Checkbox checked={draft.isBlocked} onChange={(e) => setDraft({ ...draft, isBlocked: e.target.checked })} />} label="مسدود (سند تازه برای این مشتری صادر نمی‌شود)" />
            {errors.length > 0 && <Alert severity="error">{errors.map((m, i) => <div key={i}>{m}</div>)}</Alert>}
          </Stack>
        </FormDialog>
      )}
    </Box>
  );
}

function CustomerTafsiliField({ accountId, value, onChange }: { accountId: string; value: TafsiliSelection | null; onChange: (t: TafsiliSelection | null) => void }) {
  const { allLevels, isLoading } = useTafsiliLevels(accountId);
  const level = allLevels[0];
  if (isLoading) return <Typography variant="body2" color="text.secondary">در حال بارگذاری…</Typography>;
  if (!level) return <Alert severity="error">حساب دریافتنی سطح تفصیلی ندارد؛ نگاشت حساب را اصلاح کنید.</Alert>;
  return <TafsiliItemSelect accountCodeId={accountId} level={level} value={value ? { ...value, levelId: level.levelId } : null} onChange={onChange} />;
}
