import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { JalaliDateField } from '../../components/JalaliDateField';
import { AccountCodePickerDialog } from '../../components/AccountCodePickerDialog';
import { TafsiliItemSelect } from '../../components/dynamic-tafsili/TafsiliItemSelect';
import { useTafsiliLevels } from '../../components/dynamic-tafsili/useTafsiliLevels';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { toPersianDigits } from '../../lib/format/numbers';
import { salesApi } from './api';
import { ACCOUNT_ROLES, ROLE_LABEL, type SalesRole, type SalesSettings } from './types';

const MOIN = 3;

interface MapRow {
  accountId: string;
  accountLabel: string;
  tafsiliId: string | null;
  tafsiliLabel: string | null;
}

/** تنظیمات فروش واحد: قواعد کنترلی، نگاشت حساب‌ها، نرخ ارزش افزوده (سراسری) و نقش‌های فروش کاربران. */
export function SalesSettingsPage() {
  const queryClient = useQueryClient();
  const setup = useQuery({ queryKey: ['sales-setup'], queryFn: salesApi.setup, retry: false });
  const [settings, setSettings] = useState<SalesSettings | null>(null);
  const [maps, setMaps] = useState<Record<string, MapRow>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<string | null>(null);

  useEffect(() => {
    if (!setup.data) return;
    setSettings(setup.data.settings);
    setMaps(Object.fromEntries(setup.data.accounts.map((a) => [a.roleKey, {
      accountId: a.accountId,
      accountLabel: `${a.accountCode ?? ''} - ${a.accountTitle ?? ''}`,
      tafsiliId: a.tafsiliId,
      tafsiliLabel: a.tafsiliTitle,
    }])));
  }, [setup.data]);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setErrors([]);
    setSaved(false);
    try {
      const accounts = Object.entries(maps).map(([roleKey, m]) => ({ roleKey, accountId: m.accountId, tafsiliId: m.tafsiliId }));
      const r = await salesApi.saveSetup(settings, accounts);
      if (!r.success) setErrors(r.errors);
      else {
        setSaved(true);
        await queryClient.invalidateQueries({ queryKey: ['sales-setup'] });
      }
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'ذخیره انجام نشد.']);
    } finally {
      setSaving(false);
    }
  }

  const canManage = setup.data?.canManage ?? false;
  const set = <K extends keyof SalesSettings>(k: K, v: SalesSettings[K]) => setSettings((s) => (s ? { ...s, [k]: v } : s));

  return (
    <Box>
      <PageHeader
        eyebrow="فروش"
        icon={<SettingsOutlinedIcon fontSize="small" />}
        title="تنظیمات فروش"
        description="قواعد کنترلی، حساب‌های سند حسابداری فروش و نقش کاربران این واحد. نرخ مالیات بر ارزش افزوده سراسری است."
        actions={canManage && <Button variant="contained" disabled={saving || !settings} onClick={() => void save()}>{saving ? 'در حال ذخیره…' : 'ذخیرهٔ تنظیمات'}</Button>}
      />
      {setup.error != null && <ErrorBanner error={setup.error} />}
      {errors.length > 0 && <Alert severity="error" sx={{ mb: 2 }}>{errors.map((m, i) => <div key={i}>{m}</div>)}</Alert>}
      {saved && <Alert severity="success" sx={{ mb: 2 }}>تنظیمات ذخیره شد و از سند بعدی اعمال می‌شود.</Alert>}
      {setup.data && !canManage && <Alert severity="info" sx={{ mb: 2 }}>تغییر تنظیمات فقط برای مدیر فروش یا مدیر مالی واحد است.</Alert>}

      {settings && (
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, lg: 6 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 2.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>قواعد کنترلی</Typography>
              <Stack spacing={2}>
                <TextField size="small" type="number" label="نیاز به تأیید برای تخفیف بالاتر از (٪)" value={settings.discountApprovalPercent}
                  disabled={!canManage} onChange={(e) => set('discountApprovalPercent', Number(e.target.value))} />
                <TextField select size="small" label="سیاست سقف اعتبار" value={settings.creditPolicy} disabled={!canManage}
                  onChange={(e) => set('creditPolicy', Number(e.target.value) as SalesSettings['creditPolicy'])}>
                  <MenuItem value={3}>ارجاع برای تأیید مدیر فروش</MenuItem>
                  <MenuItem value={2}>جلوگیری از ثبت</MenuItem>
                  <MenuItem value={1}>فقط هشدار</MenuItem>
                </TextField>
                <FormControlLabel disabled={!canManage} control={<Checkbox checked={settings.segregationOfDuties} onChange={(e) => set('segregationOfDuties', e.target.checked)} />}
                  label="تفکیک وظایف: تأییدکننده نباید ایجادکنندهٔ سند باشد" />
                <FormControlLabel disabled={!canManage} control={<Checkbox checked={settings.billBeforeDelivery} onChange={(e) => set('billBeforeDelivery', e.target.checked)} />}
                  label="فاکتور کالا پیش از تحویل (مبلغ تا تحویل در «بدهی قراردادی»)" />
                <FormControlLabel disabled={!canManage} control={<Checkbox checked={settings.allowNegativeStock} onChange={(e) => set('allowNegativeStock', e.target.checked)} />}
                  label="اجازهٔ موجودی منفی" />
                <Stack direction="row" spacing={2}>
                  <TextField size="small" fullWidth label="شناسهٔ ملی / کد اقتصادی فروشنده" value={settings.sellerId ?? ''} disabled={!canManage}
                    onChange={(e) => set('sellerId', e.target.value)} slotProps={{ htmlInput: { dir: 'ltr' } }} />
                  <TextField size="small" fullWidth label="شناسهٔ یکتای حافظهٔ مالیاتی" value={settings.memoryId ?? ''} disabled={!canManage}
                    onChange={(e) => set('memoryId', e.target.value)} slotProps={{ htmlInput: { dir: 'ltr' } }} />
                </Stack>
              </Stack>
            </Paper>
            <VatRatesCard />
          </Grid>

          <Grid size={{ xs: 12, lg: 6 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 2.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>حساب‌های سند حسابداری فروش</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                تفصیلی مشتری خودکار روی هر حسابی می‌نشیند که سطحی با گروه آن دارد. اگر حسابی سطح تفصیلی الزامی دیگری دارد (مثلاً مرکز هزینه)، تفصیلی ثابت بدهید.
              </Typography>
              <Stack spacing={1.5}>
                {ACCOUNT_ROLES.map((r) => (
                  <AccountMapRow key={r.key} title={r.title} hint={r.hint} row={maps[r.key]} disabled={!canManage}
                    onPick={() => setPicker(r.key)}
                    onClear={() => setMaps((m) => { const n = { ...m }; delete n[r.key]; return n; })}
                    onTafsili={(id, label) => setMaps((m) => ({ ...m, [r.key]: { ...m[r.key], tafsiliId: id, tafsiliLabel: label } }))} />
                ))}
              </Stack>
            </Paper>
            {setup.data && <RolesCard isAdmin={setup.data.isAdmin} />}
          </Grid>
        </Grid>
      )}

      <AccountCodePickerDialog
        open={picker !== null}
        title="انتخاب حساب معین"
        filterRows={(a) => a.typeCode === MOIN}
        onClose={() => setPicker(null)}
        onSelect={(a) => {
          if (picker) setMaps((m) => ({ ...m, [picker]: { accountId: a.id, accountLabel: `${a.accCode ?? ''} - ${a.accCodeName ?? ''}`, tafsiliId: null, tafsiliLabel: null } }));
          setPicker(null);
        }}
      />
    </Box>
  );
}

function AccountMapRow({ title, hint, row, disabled, onPick, onClear, onTafsili }: {
  title: string; hint: string; row: MapRow | undefined; disabled: boolean;
  onPick: () => void; onClear: () => void; onTafsili: (id: string | null, label: string | null) => void;
}) {
  const { allLevels } = useTafsiliLevels(row?.accountId ?? null);
  const [levelId, setLevelId] = useState<string>('');
  const level = allLevels.find((l) => l.levelId === levelId) ?? allLevels[0];
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.25 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{title}</Typography>
          <Typography variant="caption" color={row ? 'text.primary' : 'text.secondary'} noWrap sx={{ display: 'block' }}>
            {row ? toPersianDigits(row.accountLabel) : hint || 'تعریف نشده'}
          </Typography>
        </Box>
        <Button size="small" variant="outlined" disabled={disabled} onClick={onPick}>{row ? 'تغییر' : 'انتخاب'}</Button>
        {row && !disabled && <IconButton size="small" onClick={onClear}><DeleteOutlinedIcon fontSize="small" /></IconButton>}
      </Stack>
      {row && allLevels.length > 0 && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
          <TextField select size="small" label="سطح تفصیلی ثابت" value={level?.levelId ?? ''} disabled={disabled} sx={{ minWidth: 160 }}
            onChange={(e) => { setLevelId(e.target.value); onTafsili(null, null); }}>
            {allLevels.map((l) => <MenuItem key={l.levelId} value={l.levelId}>{l.levelName}{l.isRequired ? ' (الزامی)' : ''}</MenuItem>)}
          </TextField>
          {level && (
            <Box sx={{ flex: 1 }}>
              <TafsiliItemSelect accountCodeId={row.accountId} level={level} disabled={disabled}
                value={row.tafsiliId ? { levelId: level.levelId, tafsiliId: row.tafsiliId, label: row.tafsiliLabel ?? '' } : null}
                onChange={(s) => onTafsili(s?.tafsiliId ?? null, s?.label ?? null)} />
            </Box>
          )}
        </Stack>
      )}
    </Box>
  );
}

function VatRatesCard() {
  const queryClient = useQueryClient();
  const rates = useQuery({ queryKey: ['sales-vat'], queryFn: salesApi.vatRates, retry: false });
  const [rows, setRows] = useState<{ fromDate: string; rate: number; note: string }[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (rates.data) setRows(rates.data.map((r) => ({ fromDate: r.fromDate, rate: r.rate, note: r.note ?? '' })));
  }, [rates.data]);

  async function save() {
    setErrors([]);
    setOk(false);
    try {
      const r = await salesApi.saveVatRates(rows.map((x) => ({ fromDate: x.fromDate, rate: Number(x.rate), note: x.note || null })));
      if (!r.success) setErrors(r.errors);
      else {
        setOk(true);
        await queryClient.invalidateQueries({ queryKey: ['sales-vat'] });
      }
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'ذخیره انجام نشد.']);
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
      <Stack direction="row" sx={{ alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>نرخ مالیات بر ارزش افزوده (سراسری)</Typography>
        <Button size="small" onClick={() => setRows((r) => [...r, { fromDate: '', rate: 10, note: '' }])}>افزودن ردیف</Button>
        <Button size="small" variant="contained" onClick={() => void save()}>ذخیره</Button>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        نرخ هر سند از آخرین ردیفی خوانده می‌شود که تاریخ شروعش پیش از تاریخ سند است. فقط مدیر ستاد می‌تواند تغییر دهد. نرخ مصوب را با مشاور مالیاتی تأیید کنید.
      </Typography>
      {errors.length > 0 && <Alert severity="error" sx={{ mb: 1 }}>{errors.map((m, i) => <div key={i}>{m}</div>)}</Alert>}
      {ok && <Alert severity="success" sx={{ mb: 1 }}>نرخ‌ها ذخیره شد.</Alert>}
      <Stack spacing={1}>
        {rows.map((r, i) => (
          <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <JalaliDateField label="از تاریخ" size="small" value={r.fromDate} onChange={(v) => setRows((x) => x.map((y, j) => (j === i ? { ...y, fromDate: v } : y)))} />
            <TextField size="small" type="number" label="نرخ ٪" value={r.rate} sx={{ width: 100 }}
              onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, rate: Number(e.target.value) } : y)))} />
            <TextField size="small" label="توضیح" value={r.note} sx={{ flex: 1 }}
              onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, note: e.target.value } : y)))} />
            <IconButton size="small" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}><DeleteOutlinedIcon fontSize="small" /></IconButton>
          </Stack>
        ))}
        {rows.length === 0 && <Typography variant="body2" color="text.secondary">هنوز نرخی تعریف نشده؛ مالیات صفر حساب می‌شود.</Typography>}
      </Stack>
      {rates.data && rates.data.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          نرخ فعلی از {formatLegacyJalaliDate(rates.data[rates.data.length - 1].fromDate)}: {toPersianDigits(rates.data[rates.data.length - 1].rate)}٪
        </Typography>
      )}
    </Paper>
  );
}

function RolesCard({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const roles = useQuery({ queryKey: ['sales-roles'], queryFn: salesApi.roles, retry: false });
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<SalesRole>(1);
  const [errors, setErrors] = useState<string[]>([]);

  async function add() {
    setErrors([]);
    const r = await salesApi.addRole(userId.trim(), role);
    if (!r.success) setErrors(r.errors);
    else {
      setUserId('');
      await queryClient.invalidateQueries({ queryKey: ['sales-roles'] });
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>نقش‌های فروش کاربران</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        کارشناس فروش سند می‌سازد، مدیر فروش تأیید می‌کند و حسابدار فروش قطعی می‌کند (سند حسابداری). نقش را فقط مدیر مالی واحد یا مدیر ستاد می‌دهد؛ این دو همهٔ نقش‌ها را دارند.
      </Typography>
      {roles.error != null && <ErrorBanner error={roles.error} />}
      {isAdmin && (
        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
          <TextField size="small" label="کد ملی کاربر" value={userId} onChange={(e) => setUserId(e.target.value)} slotProps={{ htmlInput: { dir: 'ltr', maxLength: 10 } }} />
          <TextField select size="small" label="نقش" value={role} onChange={(e) => setRole(Number(e.target.value) as SalesRole)} sx={{ minWidth: 150 }}>
            {([1, 2, 3] as SalesRole[]).map((r) => <MenuItem key={r} value={r}>{ROLE_LABEL[r]}</MenuItem>)}
          </TextField>
          <Button variant="outlined" disabled={userId.trim().length !== 10} onClick={() => void add()}>افزودن</Button>
        </Stack>
      )}
      {errors.length > 0 && <Alert severity="error" sx={{ mb: 1 }}>{errors.map((m, i) => <div key={i}>{m}</div>)}</Alert>}
      <Table size="small">
        <TableHead><TableRow><TableCell>کد ملی</TableCell><TableCell>نقش</TableCell><TableCell /></TableRow></TableHead>
        <TableBody>
          {(roles.data ?? []).map((r) => (
            <TableRow key={r.id}>
              <TableCell dir="ltr" sx={{ textAlign: 'right' }}>{toPersianDigits(r.userId)}</TableCell>
              <TableCell>{ROLE_LABEL[r.role]}</TableCell>
              <TableCell align="left">
                {isAdmin && (
                  <IconButton size="small" onClick={() => void salesApi.removeRole(r.id).then(() => queryClient.invalidateQueries({ queryKey: ['sales-roles'] }))}>
                    <DeleteOutlinedIcon fontSize="small" />
                  </IconButton>
                )}
              </TableCell>
            </TableRow>
          ))}
          {roles.data?.length === 0 && <TableRow><TableCell colSpan={3}><Typography variant="body2" color="text.secondary">هنوز نقشی داده نشده است.</Typography></TableCell></TableRow>}
        </TableBody>
      </Table>
    </Paper>
  );
}
