import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { AccountCodePickerDialog } from '../../components/AccountCodePickerDialog';
import { useAllAccountCodes } from '../chart-of-accounts/useAllAccountCodes';
import { vahedTypesApi } from '../coding-permissions/api';
import { useSession } from '../../lib/session/SessionContext';
import { normalizeNumericInput, toPersianDigits } from '../../lib/format/numbers';
import type { AccountCodeDto } from '../../types/accountCode';
import {
  exceptionsApi,
  interfacesApi,
  rabetClosingsApi,
  type AccountCodeInterfaceDto,
  type AccountExceptionDto,
  type InterfaceType,
  type RabetClosingDto,
} from './api';
import { ElamRabetsTab } from './ElamRabetsTab';

type TabKey = 'elam' | 'interfaces' | 'rabet' | 'exceptions';

const INTERFACE_LABEL: Record<InterfaceType, string> = { 1: 'رابط افتتاحیه', 2: 'رابط اختتامیه (تراز)' };

function accountText(a: Pick<AccountCodeDto, 'accCode' | 'accCodeName'> | undefined | null, fallbackId?: string | null) {
  if (!a) return fallbackId ? 'حساب ناشناخته' : '—';
  return toPersianDigits(`${a.accCode ?? ''} ${a.accCodeName ?? ''}`.trim());
}

/**
 * تعریف رابط‌ها: حساب رابط اعلامیه‌ها (TB_RABET)، حساب رابط افتتاحیه/اختتامیه، رابط اختتامیهٔ حساب‌های گروه
 * ۶/۷/۸ به تفکیک سال و نوع واحد، و حساب‌هایی که به سال بعد منتقل/بسته نمی‌شوند. همه جدول‌های پایه‌اند و
 * نوشتنشان فقط با مدیر ستاد است (همان قاعدهٔ «اطلاعات پایه»).
 */
export function YearEndSettingsPage() {
  const [tab, setTab] = useState<TabKey>('elam');
  const { items: accounts } = useAllAccountCodes();
  const accountById = useMemo(() => new Map((accounts ?? []).map((a) => [a.id, a])), [accounts]);
  const vahedTypes = useQuery({ queryKey: ['vahed-types'], queryFn: vahedTypesApi.list, staleTime: 5 * 60_000 });
  const vahedTypeName = useMemo(
    () => new Map((vahedTypes.data ?? []).map((t) => [t.id, t.typeName ?? t.typeCode ?? '—'])),
    [vahedTypes.data],
  );

  return (
    <section>
      <PageHeader
        icon={<TuneOutlinedIcon />}
        title="تعریف رابط‌ها"
        description="حساب‌های رابطی که سندهای اعلامیه، افتتاحیه و اختتامیه با آن‌ها تراز می‌شوند، و حساب‌هایی که منتقل نمی‌شوند."
      />
      <Paper variant="outlined" sx={{ mb: 3, overflow: 'hidden' }}>
        <Tabs value={tab} onChange={(_, v: TabKey) => setTab(v)} variant="scrollable" sx={{ px: 1 }}>
          <Tab value="elam" label="رابط اعلامیه" />
          <Tab value="interfaces" label="رابط افتتاحیه/اختتامیه" />
          <Tab value="rabet" label="رابط اختتامیه (گروه ۶، ۷، ۸)" />
          <Tab value="exceptions" label="حساب‌های مستثنا" />
        </Tabs>
      </Paper>

      {tab === 'elam' && (
        <ElamRabetsTab accountById={accountById} accountText={accountText} AccountPickField={AccountPickField} DeleteAction={DeleteAction} />
      )}
      {tab === 'interfaces' && <InterfacesTab accountById={accountById} />}
      {tab === 'rabet' && <RabetClosingTab vahedTypes={vahedTypes.data ?? []} />}
      {tab === 'exceptions' && (
        <ExceptionsTab accountById={accountById} vahedTypes={vahedTypes.data ?? []} vahedTypeName={vahedTypeName} />
      )}
    </section>
  );
}

/** A read-only field that opens the shared account picker; the picker searches the whole chart. */
function AccountPickField({ label, value, onPick }: { label: string; value: AccountCodeDto | null; onPick: (a: AccountCodeDto) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TextField
        size="small"
        label={label}
        value={value ? accountText(value) : ''}
        placeholder="برای انتخاب کلیک کنید"
        onClick={() => setOpen(true)}
        slotProps={{ input: { readOnly: true, endAdornment: <SearchOutlinedIcon fontSize="small" color="action" /> } }}
        sx={{ minWidth: 280, '& input': { cursor: 'pointer' } }}
      />
      <AccountCodePickerDialog open={open} title={label} onClose={() => setOpen(false)} onSelect={onPick} />
    </>
  );
}

function useDelete(queryKey: unknown[], remove: (id: string) => Promise<unknown>) {
  const qc = useQueryClient();
  const [target, setTarget] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (id: string) => remove(id),
    onSuccess: async () => {
      setTarget(null);
      await qc.invalidateQueries({ queryKey });
    },
  });
  return { target, setTarget, mutation };
}

function DeleteAction({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip title="حذف">
      <IconButton size="small" color="error" aria-label="حذف" onClick={onClick}>
        <DeleteOutlineIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}

function InterfacesTab({ accountById }: { accountById: Map<string, AccountCodeDto> }) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['account-code-interfaces'], queryFn: interfacesApi.list });
  const [type, setType] = useState<InterfaceType>(1);
  const [account, setAccount] = useState<AccountCodeDto | null>(null);
  const add = useMutation({
    mutationFn: () => interfacesApi.create(type, account!.id),
    onSuccess: async () => {
      setAccount(null);
      await qc.invalidateQueries({ queryKey: ['account-code-interfaces'] });
    },
  });
  const del = useDelete(['account-code-interfaces'], interfacesApi.remove);

  const rows = list.data ?? [];
  const duplicateTypes = ([1, 2] as InterfaceType[]).filter((t) => rows.filter((r) => r.type === t).length > 1);
  const columns: DataTableColumn<AccountCodeInterfaceDto>[] = [
    { key: 'type', header: 'نوع', width: 200, render: (r) => <Chip size="small" color={r.type === 1 ? 'primary' : 'secondary'} label={INTERFACE_LABEL[r.type]} /> },
    { key: 'account', header: 'حساب رابط', render: (r) => accountText(accountById.get(r.accountCodeId), r.accountCodeId) },
    { key: 'actions', header: '', width: 64, render: (r) => <DeleteAction onClick={() => del.setTarget(r.id)} /> },
  ];

  function submit(e: FormEvent) {
    e.preventDefault();
    if (account) add.mutate();
  }

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '75ch' }}>
        سند افتتاحیهٔ هر گروه با ردیفی روی «رابط افتتاحیه» تراز می‌شود. این حساب باید معین و «فقط سیستمی» باشد تا کسی دستی
        روی آن سند نزند. برای هر نوع فقط یک حساب لازم است.
      </Typography>
      <Paper variant="outlined" component="form" onSubmit={submit} sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' } }}>
          <TextField select size="small" label="نوع" value={type} onChange={(e) => setType(Number(e.target.value) as InterfaceType)} sx={{ minWidth: 200 }}>
            <MenuItem value={1}>{INTERFACE_LABEL[1]}</MenuItem>
            <MenuItem value={2}>{INTERFACE_LABEL[2]}</MenuItem>
          </TextField>
          <AccountPickField label="حساب رابط" value={account} onPick={setAccount} />
          <Button type="submit" variant="contained" startIcon={<AddOutlinedIcon />} disabled={!account || add.isPending}>
            افزودن
          </Button>
        </Stack>
        {add.isError && <Box sx={{ mt: 2 }}><ErrorBanner error={add.error} /></Box>}
      </Paper>
      {duplicateTypes.length > 0 && (
        <Alert severity="warning">
          برای {duplicateTypes.map((t) => `«${INTERFACE_LABEL[t]}»`).join(' و ')} بیش از یک حساب تعریف شده؛ سند با جدیدترین آن‌ها صادر می‌شود. اضافی‌ها را حذف کنید.
        </Alert>
      )}
      {list.isError && <ErrorBanner error={list.error} />}
      <DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} isLoading={list.isLoading} emptyMessage="هنوز حساب رابطی تعریف نشده است." emptyHint="بدون رابط افتتاحیه، سند افتتاحیه صادر نمی‌شود." />
      <ConfirmDialog
        open={!!del.target}
        title="حذف حساب رابط"
        description="این حساب دیگر برای تراز سند افتتاحیه/اختتامیه به کار نمی‌رود."
        confirmLabel="حذف"
        confirmColor="error"
        pending={del.mutation.isPending}
        onConfirm={() => del.target && del.mutation.mutate(del.target)}
        onCancel={() => del.setTarget(null)}
      />
      {del.mutation.isError && <ErrorBanner error={del.mutation.error} />}
    </Stack>
  );
}

function RabetClosingTab({ vahedTypes }: { vahedTypes: { id: string; typeName: string | null; typeCode: string | null }[] }) {
  const { financialYear } = useSession();
  const [year, setYear] = useState(financialYear || '');
  const validYear = /^\d{4}$/.test(year);
  const list = useQuery({ queryKey: ['rabet-closings', year], queryFn: () => rabetClosingsApi.list(year), enabled: validYear });
  const [adding, setAdding] = useState(false);
  const del = useDelete(['rabet-closings'], rabetClosingsApi.remove);

  const columns: DataTableColumn<RabetClosingDto>[] = [
    { key: 'type', header: 'نوع واحد', width: '18%', render: (r) => r.vahedTypeName ?? '—' },
    {
      key: 'account',
      header: 'حساب',
      width: '28%',
      render: (r) => (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <span>{accountText({ accCode: r.accCode, accCodeName: r.accName })}</span>
          {r.level === 2 && <Chip size="small" variant="outlined" label="کل: همهٔ معین‌های زیرش" />}
        </Stack>
      ),
    },
    { key: 'rabet', header: 'حساب رابط', width: '26%', render: (r) => accountText({ accCode: r.rabetCode, accCodeName: r.rabetName }) },
    { key: 'title', header: 'عنوان', render: (r) => r.title ?? '—' },
    { key: 'actions', header: '', width: 64, render: (r) => <DeleteAction onClick={() => del.setTarget(r.id)} /> },
  ];

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '75ch' }}>
        سند اختتامیه ماندهٔ هر حساب گروه ۶، ۷ و ۸ را روی حساب رابطی که اینجا برای همان سال و نوع واحد تعریف شده می‌بندد.
        رابطِ تعریف‌شده روی یک «کل» به همهٔ معین‌های زیرش می‌رسد؛ رابطِ خود معین بر آن مقدم است.
      </Typography>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <TextField
          size="small"
          label="سال مالی"
          value={toPersianDigits(year)}
          onChange={(e) => setYear(normalizeNumericInput(e.target.value).slice(0, 4))}
          sx={{ width: 140 }}
          slotProps={{ htmlInput: { inputMode: 'numeric' } }}
        />
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => setAdding(true)} disabled={!validYear}>
          تعریف رابط اختتامیه
        </Button>
      </Stack>
      {list.isError && <ErrorBanner error={list.error} />}
      <DataTable
        columns={columns}
        rows={list.data ?? []}
        getRowKey={(r) => r.id}
        isLoading={list.isLoading && validYear}
        emptyMessage={validYear ? `برای سال ${toPersianDigits(year)} رابط اختتامیه‌ای تعریف نشده است.` : 'سال مالی را وارد کنید.'}
      />
      {adding && <RabetClosingDialog year={year} vahedTypes={vahedTypes} onClose={() => setAdding(false)} />}
      <ConfirmDialog
        open={!!del.target}
        title="حذف رابط اختتامیه"
        description="اگر سند اختتامیهٔ این سال برای واحدی از این نوع صادر شده باشد، حذف ممکن نیست."
        confirmLabel="حذف"
        confirmColor="error"
        pending={del.mutation.isPending}
        onConfirm={() => del.target && del.mutation.mutate(del.target)}
        onCancel={() => del.setTarget(null)}
      />
      {del.mutation.isError && <ErrorBanner error={del.mutation.error} />}
    </Stack>
  );
}

function RabetClosingDialog({
  year, vahedTypes, onClose,
}: { year: string; vahedTypes: { id: string; typeName: string | null; typeCode: string | null }[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [typeIds, setTypeIds] = useState<string[]>([]);
  const [accountsPicked, setAccountsPicked] = useState<AccountCodeDto[]>([]);
  const [rabet, setRabet] = useState<AccountCodeDto | null>(null);
  const [title, setTitle] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const create = useMutation({
    mutationFn: () =>
      rabetClosingsApi.create({ year, vahedTypeIds: typeIds, accountIds: accountsPicked.map((a) => a.id), rabetAccountId: rabet!.id, title: title.trim() }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['rabet-closings'] });
      onClose();
    },
  });
  const ready = typeIds.length > 0 && accountsPicked.length > 0 && !!rabet && !!title.trim();

  return (
    <Dialog open onClose={() => !create.isPending && onClose()} maxWidth="md" fullWidth>
      <DialogTitle>تعریف رابط اختتامیه، سال {toPersianDigits(year)}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>نوع واحد</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}>
              {vahedTypes.map((t) => (
                <FormControlLabel
                  key={t.id}
                  control={
                    <Checkbox
                      size="small"
                      checked={typeIds.includes(t.id)}
                      onChange={(e) => setTypeIds((ids) => (e.target.checked ? [...ids, t.id] : ids.filter((x) => x !== t.id)))}
                    />
                  }
                  label={t.typeName ?? t.typeCode ?? '—'}
                />
              ))}
            </Box>
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>حساب‌ها (کل یا معین گروه ۶، ۷، ۸)</Typography>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
              {accountsPicked.map((a) => (
                <Chip key={a.id} label={accountText(a)} onDelete={() => setAccountsPicked((list) => list.filter((x) => x.id !== a.id))} />
              ))}
              <Button size="small" startIcon={<AddOutlinedIcon />} onClick={() => setPickerOpen(true)}>
                افزودن حساب
              </Button>
            </Stack>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <AccountPickField label="حساب رابط (معین)" value={rabet} onPick={setRabet} />
            <TextField size="small" label="عنوان" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth slotProps={{ htmlInput: { maxLength: 200 } }} />
          </Stack>
          {create.isError && <ErrorBanner error={create.error} />}
        </Stack>
        <AccountCodePickerDialog
          open={pickerOpen}
          title="افزودن حساب"
          onClose={() => setPickerOpen(false)}
          onSelect={(a) => setAccountsPicked((list) => (list.some((x) => x.id === a.id) ? list : [...list, a]))}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={create.isPending}>انصراف</Button>
        <Button variant="contained" onClick={() => create.mutate()} disabled={!ready || create.isPending}>
          {create.isPending ? 'در حال ثبت…' : `ثبت${typeIds.length * accountsPicked.length > 1 ? ` (${toPersianDigits(typeIds.length * accountsPicked.length)} ردیف)` : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ExceptionsTab({
  accountById, vahedTypes, vahedTypeName,
}: {
  accountById: Map<string, AccountCodeDto>;
  vahedTypes: { id: string; typeName: string | null; typeCode: string | null }[];
  vahedTypeName: Map<string, string>;
}) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['account-exceptions'], queryFn: exceptionsApi.list });
  const [account, setAccount] = useState<AccountCodeDto | null>(null);
  const [typeId, setTypeId] = useState('');
  const add = useMutation({
    mutationFn: () => exceptionsApi.create(account!.id, typeId),
    onSuccess: async () => {
      setAccount(null);
      await qc.invalidateQueries({ queryKey: ['account-exceptions'] });
    },
  });
  const del = useDelete(['account-exceptions'], exceptionsApi.remove);

  const columns: DataTableColumn<AccountExceptionDto>[] = [
    { key: 'account', header: 'حساب', width: '45%', render: (r) => accountText(accountById.get(r.accountCoeId), r.accountCoeId) },
    { key: 'type', header: 'نوع واحد', render: (r) => vahedTypeName.get(r.vahedTypeId) ?? '—' },
    { key: 'actions', header: '', width: 64, render: (r) => <DeleteAction onClick={() => del.setTarget(r.id)} /> },
  ];

  function submit(e: FormEvent) {
    e.preventDefault();
    if (account && typeId) add.mutate();
  }

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '75ch' }}>
        حساب‌هایی که در سند افتتاحیه به سال بعد منتقل نمی‌شوند و در سند اختتامیه بسته نمی‌شوند، برای واحدهای همان نوع.
      </Typography>
      <Paper variant="outlined" component="form" onSubmit={submit} sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' } }}>
          <AccountPickField label="حساب" value={account} onPick={setAccount} />
          <TextField select size="small" label="نوع واحد" value={typeId} onChange={(e) => setTypeId(e.target.value)} sx={{ minWidth: 220 }}>
            {vahedTypes.map((t) => (
              <MenuItem key={t.id} value={t.id}>{t.typeName ?? t.typeCode ?? '—'}</MenuItem>
            ))}
          </TextField>
          <Button type="submit" variant="contained" startIcon={<AddOutlinedIcon />} disabled={!account || !typeId || add.isPending}>
            افزودن
          </Button>
        </Stack>
        {add.isError && <Box sx={{ mt: 2 }}><ErrorBanner error={add.error} /></Box>}
      </Paper>
      {list.isError && <ErrorBanner error={list.error} />}
      <DataTable columns={columns} rows={list.data ?? []} getRowKey={(r) => r.id} isLoading={list.isLoading} emptyMessage="حساب مستثنایی تعریف نشده است؛ همهٔ حساب‌ها منتقل/بسته می‌شوند." />
      <ConfirmDialog
        open={!!del.target}
        title="حذف حساب مستثنا"
        description="این حساب از این پس در سند افتتاحیه/اختتامیه حساب می‌شود."
        confirmLabel="حذف"
        confirmColor="error"
        pending={del.mutation.isPending}
        onConfirm={() => del.target && del.mutation.mutate(del.target)}
        onCancel={() => del.setTarget(null)}
      />
      {del.mutation.isError && <ErrorBanner error={del.mutation.error} />}
    </Stack>
  );
}
