import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
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
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import TableViewOutlinedIcon from '@mui/icons-material/TableViewOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import { PageHeader } from '../../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../../components/DataTable';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { useNotify } from '../../../lib/notifications/NotificationProvider';
import { useSession } from '../../../lib/session/SessionContext';
import { toLatinDigits, toPersianDigits } from '../../../lib/format/numbers';
import { FS_FRAMEWORK_OPTIONS, type FsFrameworkValue } from '../../../types/fsTemplate';
import { PERSIAN_MONTHS } from '../../../types/fsRun';
import {
  FS_SETTING_KEYS,
  type FsElimRuleDto,
  type FsEntityDto,
  type FsEntityTbRow,
  type FsSettingDto,
  type FsXbrlMapDto,
} from '../../../types/fsConsolidation';
import { fsConsolidationApi } from '../api';
import { downloadEntityTbTemplate, readEntityTbFile } from './entityTbExcel';

type TabKey = 'settings' | 'elim' | 'entities' | 'xbrl';

/**
 * ط-۴ تا ط-۸ — تنظیمات تلفیق و گزارشگری (سند منبع §۸، §۱۲-۳، §۱۶): حساب‌های نقد (جریان نقد از طرف مقابل سند)،
 * حساب تعدیلات سنواتی (تجدید ارائه)، قواعد حذف فی‌مابین (V-07)، شرکت‌های تابعه با تراز Excel و نرخ تسعیر، و نگاشت XBRL.
 */
export function FsConsolidationPage() {
  const [tab, setTab] = useState<TabKey>('settings');
  const [framework, setFramework] = useState<FsFrameworkValue>(1);

  return (
    <section>
      <PageHeader
        eyebrow="صورت‌های مالی"
        icon={<AccountBalanceOutlinedIcon />}
        title="تلفیق، جریان نقد و XBRL"
        description="تنظیماتی که تهیهٔ صورت‌ها به‌کار می‌برد: حساب‌های نقد و تعدیلات سنواتی، قواعد حذف فی‌مابین، شرکت‌های تابعه و نگاشت XBRL."
      />
      <Tabs value={tab} onChange={(_, v: TabKey) => setTab(v)} sx={{ mb: 2 }} variant="scrollable">
        <Tab value="settings" label="تنظیمات مجموعه" />
        <Tab value="elim" label="حذف فی‌مابین" />
        <Tab value="entities" label="شرکت‌های تابعه" />
        <Tab value="xbrl" label="نگاشت XBRL" />
      </Tabs>
      {(tab === 'settings' || tab === 'elim') && (
        <Tabs value={framework} onChange={(_, v: FsFrameworkValue) => setFramework(v)} sx={{ mb: 2 }} textColor="secondary" indicatorColor="secondary">
          {FS_FRAMEWORK_OPTIONS.map((o) => (
            <Tab key={o.value} value={o.value} label={o.label} />
          ))}
        </Tabs>
      )}
      {tab === 'settings' && <SettingsTab framework={framework} />}
      {tab === 'elim' && <ElimRulesTab framework={framework} />}
      {tab === 'entities' && <EntitiesTab />}
      {tab === 'xbrl' && <XbrlTab />}
    </section>
  );
}

const SETTING_FIELDS: { key: string; label: string; help: string; ltr?: boolean; multiline?: boolean }[] = [
  {
    key: FS_SETTING_KEYS.CashSelector,
    label: 'حساب‌های نقد (انتخاب‌گر)',
    help: 'مثلاً «3040* 3050* 3060*». ردیف‌های قالب با نوع مقدار «جریان نقد» از طرف مقابل اسناد این حساب‌ها پر می‌شوند.',
    ltr: true,
  },
  {
    key: FS_SETTING_KEYS.RestatementSelector,
    label: 'حساب تعدیلات سنواتی (انتخاب‌گر)',
    help: 'اسناد سال جاری روی این حساب‌ها، وقتی «تجدید ارائه‌شده» انتخاب شود، به ستون سال قبل افزوده می‌شوند.',
    ltr: true,
  },
  { key: FS_SETTING_KEYS.XbrlSchemaRef, label: 'XBRL — آدرس طبقه‌بندی (schemaRef)', help: 'آدرس فایل xsd طبقه‌بندی (مثلاً طبقه‌بندی کدال).', ltr: true },
  {
    key: FS_SETTING_KEYS.XbrlNamespaces,
    label: 'XBRL — فضاهای نام',
    help: 'به شکل prefix=uri، با «;» جدا: ifrs-full=http://xbrl.ifrs.org/taxonomy/2023-03-23/ifrs-full',
    ltr: true,
    multiline: true,
  },
  { key: FS_SETTING_KEYS.XbrlEntityScheme, label: 'XBRL — طرح شناسهٔ واحد', help: 'مثلاً http://www.codal.ir', ltr: true },
  { key: FS_SETTING_KEYS.XbrlEntityId, label: 'XBRL — شناسهٔ واحد', help: 'نماد یا شناسهٔ ملی؛ خالی = کد واحد.', ltr: true },
];

function SettingsTab({ framework }: { framework: number }) {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { unitCode } = useSession();
  const [shared, setShared] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  const query = useQuery({ queryKey: ['fs-settings', unitCode, framework], queryFn: () => fsConsolidationApi.settings(framework) });
  const rows = query.data ?? [];
  const pick = (key: string): FsSettingDto | undefined =>
    rows.find((s) => s.key === key && (shared ? s.ownerVahedCode === null : s.ownerVahedCode === unitCode));
  const effective = (key: string) => rows.find((s) => s.key === key && s.ownerVahedCode === unitCode) ?? rows.find((s) => s.key === key && s.ownerVahedCode === null);

  useEffect(() => {
    setValues(Object.fromEntries(SETTING_FIELDS.map((f) => [f.key, pick(f.key)?.value ?? ''])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, shared]);

  const save = useMutation({
    mutationFn: (key: string) => fsConsolidationApi.saveSetting({ framework, key, value: values[key]?.trim() || null, shared }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['fs-settings'] });
      notify('تنظیم ذخیره شد.');
    },
  });

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <FormControlLabel
        control={<Checkbox checked={shared} onChange={(e) => setShared(e.target.checked)} />}
        label="ویرایش تنظیمات مشترک (فقط ستاد) — وگرنه تنظیم اختصاصی واحد جاری"
      />
      {(query.error ?? save.error) && <ErrorBanner error={query.error ?? save.error} />}
      <Stack spacing={2.5} sx={{ mt: 2 }}>
        {SETTING_FIELDS.map((f) => {
          const eff = effective(f.key);
          return (
            <Stack key={f.key} direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'flex-start' } }}>
              <TextField
                label={f.label}
                value={values[f.key] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                helperText={`${f.help}${eff ? ` — مؤثر: ${eff.ownerVahedCode ? `واحد ${eff.ownerVahedCode}` : 'مشترک'}` : ''}`}
                multiline={f.multiline}
                minRows={f.multiline ? 2 : undefined}
                fullWidth
                slotProps={{ htmlInput: { dir: f.ltr ? 'ltr' : undefined, style: f.ltr ? { fontFamily: 'monospace' } : undefined } }}
              />
              <Button variant="outlined" sx={{ minWidth: 100, mt: { md: 1 } }} disabled={save.isPending} onClick={() => save.mutate(f.key)}>
                ذخیره
              </Button>
            </Stack>
          );
        })}
      </Stack>
    </Paper>
  );
}

function ElimRulesTab({ framework }: { framework: number }) {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { unitCode } = useSession();
  const empty = { code: '', titleFa: '', left: '', right: '', tolerance: '0', isActive: true, shared: false };
  const [editing, setEditing] = useState<FsElimRuleDto | 'new' | null>(null);
  const [form, setForm] = useState(empty);
  const [pendingDelete, setPendingDelete] = useState<FsElimRuleDto | null>(null);

  const query = useQuery({ queryKey: ['fs-elim-rules', unitCode, framework], queryFn: () => fsConsolidationApi.elimRules(framework) });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['fs-elim-rules'] });

  const save = useMutation({
    mutationFn: () =>
      fsConsolidationApi.saveElimRule(editing === 'new' ? null : (editing as FsElimRuleDto).id, {
        framework,
        shared: form.shared,
        code: form.code.trim(),
        titleFa: form.titleFa.trim(),
        leftSelector: toLatinDigits(form.left).trim(),
        rightSelector: toLatinDigits(form.right).trim(),
        tolerance: Number(toLatinDigits(form.tolerance)) || 0,
        isActive: form.isActive,
      }),
    onSuccess: async () => {
      setEditing(null);
      await invalidate();
      notify('قاعده ذخیره شد.');
    },
  });

  const remove = useMutation({
    mutationFn: (r: FsElimRuleDto) => fsConsolidationApi.deleteElimRule(r.id),
    onSuccess: async () => {
      setPendingDelete(null);
      await invalidate();
    },
  });

  const columns: DataTableColumn<FsElimRuleDto>[] = [
    { key: 'code', header: 'کد', width: 80, render: (r) => r.code },
    { key: 'title', header: 'عنوان', render: (r) => r.titleFa },
    {
      key: 'sel',
      header: 'سوی اول ↔ سوی دوم',
      render: (r) => (
        <Typography variant="caption" dir="ltr" sx={{ fontFamily: 'monospace' }}>
          {r.leftSelector} ↔ {r.rightSelector}
        </Typography>
      ),
    },
    { key: 'tol', header: 'آستانه (ریال)', align: 'end', render: (r) => r.tolerance.toLocaleString('fa-IR') },
    { key: 'own', header: 'مالک', render: (r) => (r.ownerVahedCode ? `واحد ${r.ownerVahedCode}` : 'مشترک') },
    { key: 'act', header: '', width: 70, render: (r) => <Chip size="small" variant="outlined" color={r.isActive ? 'success' : 'default'} label={r.isActive ? 'فعال' : 'غیرفعال'} /> },
    {
      key: 'ops',
      header: '',
      align: 'end',
      render: (r) =>
        r.canEdit && (
          <Stack direction="row" spacing={0} sx={{ justifyContent: 'flex-end' }}>
            <IconButton
              size="small"
              color="primary"
              onClick={() => {
                setForm({ code: r.code, titleFa: r.titleFa, left: r.leftSelector, right: r.rightSelector, tolerance: String(r.tolerance), isActive: r.isActive, shared: !r.ownerVahedCode });
                save.reset();
                setEditing(r);
              }}
            >
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" color="error" onClick={() => setPendingDelete(r)}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Stack>
        ),
    },
  ];

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'center', mb: 1.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          در صورت ترکیبی یا تلفیقی، حساب‌های هر دو سو صفر می‌شوند (ستون «حذفیات» کاربرگ) و اگر جمع دو سو بیش از آستانه باشد، کنترل V-07
          مسدودکننده ناموفق می‌شود.
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddOutlinedIcon />}
          onClick={() => {
            setForm(empty);
            save.reset();
            setEditing('new');
          }}
        >
          قاعدهٔ جدید
        </Button>
      </Stack>
      {(query.error ?? remove.error) && <ErrorBanner error={query.error ?? remove.error} />}
      <DataTable columns={columns} rows={query.data ?? []} getRowKey={(r) => r.id} isLoading={query.isLoading} emptyMessage="قاعدهٔ حذفی تعریف نشده است." />

      <Dialog open={editing !== null} onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing === 'new' ? 'قاعدهٔ حذف جدید' : 'ویرایش قاعدهٔ حذف'}</DialogTitle>
        <DialogContent>
          {save.isError && <ErrorBanner error={save.error} />}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField label="کد" value={form.code} disabled={editing !== 'new'} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.slice(0, 20) }))} sx={{ width: 140 }} />
              <TextField label="عنوان" fullWidth value={form.titleFa} onChange={(e) => setForm((f) => ({ ...f, titleFa: e.target.value }))} />
            </Stack>
            <TextField label="سوی اول (انتخاب‌گر)" value={form.left} onChange={(e) => setForm((f) => ({ ...f, left: e.target.value }))} placeholder="مثلاً 3110*" slotProps={{ htmlInput: { dir: 'ltr' } }} />
            <TextField label="سوی دوم (انتخاب‌گر)" value={form.right} onChange={(e) => setForm((f) => ({ ...f, right: e.target.value }))} placeholder="مثلاً 4110*" slotProps={{ htmlInput: { dir: 'ltr' } }} />
            <TextField label="آستانهٔ مجاز (ریال)" value={toPersianDigits(form.tolerance)} onChange={(e) => setForm((f) => ({ ...f, tolerance: toLatinDigits(e.target.value).replace(/[^\d]/g, '') }))} />
            <Stack direction="row">
              <FormControlLabel control={<Checkbox checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />} label="فعال" />
              {editing === 'new' && (
                <FormControlLabel control={<Checkbox checked={form.shared} onChange={(e) => setForm((f) => ({ ...f, shared: e.target.checked }))} />} label="مشترک (فقط ستاد)" />
              )}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>انصراف</Button>
          <Button variant="contained" disabled={!form.code.trim() || !form.titleFa.trim() || !form.left.trim() || !form.right.trim() || save.isPending} onClick={() => save.mutate()}>
            ذخیره
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف قاعده"
        description={pendingDelete ? `قاعدهٔ «${pendingDelete.titleFa}» حذف می‌شود.` : undefined}
        pending={remove.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete)}
      />
    </Paper>
  );
}

function EntitiesTab() {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { unitCode, financialYear } = useSession();
  const empty = { code: '', titleFa: '', currency: 'IRR', ownership: '100', isActive: true };
  const [editing, setEditing] = useState<FsEntityDto | 'new' | null>(null);
  const [form, setForm] = useState(empty);
  const [pendingDelete, setPendingDelete] = useState<FsEntityDto | null>(null);
  const [tbEntity, setTbEntity] = useState<FsEntityDto | null>(null);

  const query = useQuery({ queryKey: ['fs-entities', unitCode], queryFn: () => fsConsolidationApi.entities() });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['fs-entities'] });

  const save = useMutation({
    mutationFn: () =>
      fsConsolidationApi.saveEntity(editing === 'new' ? null : (editing as FsEntityDto).id, {
        code: form.code.trim(),
        titleFa: form.titleFa.trim(),
        currency: form.currency.trim().toUpperCase(),
        ownership: Number(toLatinDigits(form.ownership)) || 0,
        isActive: form.isActive,
      }),
    onSuccess: async () => {
      setEditing(null);
      await invalidate();
      notify('شرکت تابعه ذخیره شد.');
    },
  });

  const remove = useMutation({
    mutationFn: (e: FsEntityDto) => fsConsolidationApi.deleteEntity(e.id),
    onSuccess: async () => {
      setPendingDelete(null);
      await invalidate();
    },
  });

  const columns: DataTableColumn<FsEntityDto>[] = [
    { key: 'code', header: 'کد', width: 70, render: (e) => e.code },
    { key: 'title', header: 'نام', render: (e) => e.titleFa },
    { key: 'cur', header: 'ارز', width: 70, render: (e) => e.currency },
    { key: 'own', header: 'مالکیت', width: 90, render: (e) => `${e.ownership.toLocaleString('fa-IR')}٪` },
    { key: 'act', header: '', width: 70, render: (e) => <Chip size="small" variant="outlined" color={e.isActive ? 'success' : 'default'} label={e.isActive ? 'فعال' : 'غیرفعال'} /> },
    {
      key: 'ops',
      header: '',
      align: 'end',
      render: (e) => (
        <Stack direction="row" spacing={0} sx={{ justifyContent: 'flex-end' }}>
          <Tooltip title="تراز و نرخ تسعیر">
            <IconButton size="small" onClick={() => setTbEntity(e)}>
              <TableViewOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <IconButton
            size="small"
            color="primary"
            onClick={() => {
              setForm({ code: e.code, titleFa: e.titleFa, currency: e.currency, ownership: String(e.ownership), isActive: e.isActive });
              save.reset();
              setEditing(e);
            }}
          >
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" onClick={() => setPendingDelete(e)}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      ),
    },
  ];

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'center', mb: 1.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          شرکت‌های تابعهٔ واحد جاری. در ویزارد با «تلفیق با شرکت‌های تابعه»، تراز هر شرکت (به ارز خودش) با نرخ‌های تسعیر به ریال تبدیل و کامل
          اضافه می‌شود؛ سهم غیرکنترلی در حساب‌های NCI/NCIOFF و اختلاف تسعیر در FXR می‌آید.
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddOutlinedIcon />}
          onClick={() => {
            setForm(empty);
            save.reset();
            setEditing('new');
          }}
        >
          شرکت جدید
        </Button>
      </Stack>
      {(query.error ?? remove.error) && <ErrorBanner error={query.error ?? remove.error} />}
      <DataTable columns={columns} rows={query.data ?? []} getRowKey={(e) => e.id} isLoading={query.isLoading} emptyMessage="شرکت تابعه‌ای تعریف نشده است." />

      <Dialog open={editing !== null} onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing === 'new' ? 'شرکت تابعهٔ جدید' : 'ویرایش شرکت تابعه'}</DialogTitle>
        <DialogContent>
          {save.isError && <ErrorBanner error={save.error} />}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField label="کد (۱ تا ۴ نویسه)" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.slice(0, 4) }))} sx={{ width: 160 }} slotProps={{ htmlInput: { dir: 'ltr' } }} />
              <TextField label="نام" fullWidth value={form.titleFa} onChange={(e) => setForm((f) => ({ ...f, titleFa: e.target.value }))} />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField label="ارز (IRR، USD …)" value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.slice(0, 3) }))} sx={{ width: 160 }} slotProps={{ htmlInput: { dir: 'ltr' } }} />
              <TextField label="درصد مالکیت" value={toPersianDigits(form.ownership)} onChange={(e) => setForm((f) => ({ ...f, ownership: toLatinDigits(e.target.value).replace(/[^\d.]/g, '') }))} sx={{ width: 160 }} />
              <FormControlLabel control={<Checkbox checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />} label="فعال" />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>انصراف</Button>
          <Button variant="contained" disabled={!form.code.trim() || !form.titleFa.trim() || form.currency.trim().length !== 3 || save.isPending} onClick={() => save.mutate()}>
            ذخیره
          </Button>
        </DialogActions>
      </Dialog>

      {tbEntity && <EntityTbDialog entity={tbEntity} defaultYear={financialYear || ''} onClose={() => setTbEntity(null)} />}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف شرکت تابعه"
        description={pendingDelete ? `«${pendingDelete.titleFa}» حذف می‌شود.` : undefined}
        pending={remove.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete)}
      />
    </Paper>
  );
}

function EntityTbDialog({ entity, defaultYear, onClose }: { entity: FsEntityDto; defaultYear: string; onClose: () => void }) {
  const notify = useNotify();
  const [year, setYear] = useState(defaultYear);
  const [toMonth, setToMonth] = useState(12);
  const [rows, setRows] = useState<FsEntityTbRow[] | null>(null);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [rates, setRates] = useState({ opening: '', closing: '', average: '' });
  const local = entity.currency.toUpperCase() === 'IRR';
  const yearValid = /^1[34]\d{2}$/.test(year);

  const current = useQuery({
    queryKey: ['fs-entity-tb', entity.id, year, toMonth],
    queryFn: () => fsConsolidationApi.entityTb(entity.id, year, toMonth),
    enabled: yearValid,
  });

  useEffect(() => {
    const d = current.data;
    setRates({ opening: d?.openingRate?.toString() ?? '', closing: d?.closingRate?.toString() ?? '', average: d?.averageRate?.toString() ?? '' });
    setRows(null);
    setFileErrors([]);
  }, [current.data]);

  const save = useMutation({
    mutationFn: () =>
      fsConsolidationApi.importEntityTb(entity.id, {
        year,
        toMonth,
        rows: rows ?? current.data?.rows ?? [],
        openingRate: rates.opening ? Number(rates.opening) : null,
        closingRate: rates.closing ? Number(rates.closing) : null,
        averageRate: rates.average ? Number(rates.average) : null,
      }),
    onSuccess: async (count) => {
      notify(`${toPersianDigits(count)} ردیف تراز ذخیره شد.`);
      await current.refetch();
    },
  });

  const shown = rows ?? current.data?.rows ?? [];
  const sum = (f: (r: FsEntityTbRow) => number) => shown.reduce((s, r) => s + f(r), 0);
  const balance = sum((r) => r.openingDebtor - r.openingCreditor + r.periodDebtor - r.periodCreditor);

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>تراز «{entity.titleFa}» ({entity.currency})</DialogTitle>
      <DialogContent>
        {(current.error ?? save.error) && <ErrorBanner error={current.error ?? save.error} />}
        <Stack direction="row" spacing={2} sx={{ my: 1, flexWrap: 'wrap', gap: 1.5 }}>
          <TextField size="small" label="سال" value={toPersianDigits(year)} onChange={(e) => setYear(toLatinDigits(e.target.value).replace(/\D/g, '').slice(0, 4))} sx={{ width: 100 }} />
          <TextField select size="small" label="تا پایان" value={toMonth} onChange={(e) => setToMonth(Number(e.target.value))} sx={{ width: 140 }}>
            {PERSIAN_MONTHS.map((m, i) => (
              <MenuItem key={m} value={i + 1}>
                {m}
              </MenuItem>
            ))}
          </TextField>
          <Button
            size="small"
            startIcon={<DownloadOutlinedIcon />}
            onClick={() => void downloadEntityTbTemplate(shown, `tb-${entity.code}-${year}-${toMonth}.xlsx`)}
          >
            دریافت الگو
          </Button>
          <Button size="small" component="label" startIcon={<UploadFileOutlinedIcon />}>
            خواندن Excel
            <input
              hidden
              type="file"
              accept=".xlsx"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                const r = await readEntityTbFile(f);
                setRows(r.rows);
                setFileErrors(r.errors);
              }}
            />
          </Button>
        </Stack>
        {!local && (
          <Stack direction="row" spacing={2} sx={{ mb: 1.5 }}>
            {(['opening', 'closing', 'average'] as const).map((k) => (
              <TextField
                key={k}
                size="small"
                label={k === 'opening' ? 'نرخ ابتدای دوره' : k === 'closing' ? 'نرخ پایان دوره' : 'نرخ میانگین'}
                value={toPersianDigits(rates[k])}
                onChange={(e) => setRates((r) => ({ ...r, [k]: toLatinDigits(e.target.value).replace(/[^\d.]/g, '') }))}
              />
            ))}
          </Stack>
        )}
        {fileErrors.length > 0 && (
          <Alert severity="error" sx={{ mb: 1.5 }}>
            {fileErrors.join(' · ')}
          </Alert>
        )}
        <Alert severity={balance === 0 ? 'success' : 'warning'} variant="outlined" sx={{ mb: 1.5 }}>
          {toPersianDigits(shown.length)} ردیف{rows ? ' (از فایل، هنوز ذخیره نشده)' : ''} · جمع ماندهٔ پایان: {balance.toLocaleString('fa-IR')}
          {balance !== 0 ? ' — تراز متوازن نیست' : ''}
        </Alert>
        <Typography variant="caption" color="text.secondary">
          ستون «کد معین سازمان» باید یکی از معین‌های کدینگ سازمان باشد؛ ذخیره، تراز قبلی همین دوره را کامل جایگزین می‌کند.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>بستن</Button>
        <Button variant="contained" disabled={!yearValid || shown.length === 0 || fileErrors.length > 0 || save.isPending} onClick={() => save.mutate()}>
          ذخیرهٔ تراز و نرخ‌ها
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function XbrlTab() {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const empty = { templateCode: '', rowCode: '', element: '', periodType: 1 };
  const [editing, setEditing] = useState<FsXbrlMapDto | 'new' | null>(null);
  const [form, setForm] = useState(empty);

  const query = useQuery({ queryKey: ['fs-xbrl-maps'], queryFn: () => fsConsolidationApi.xbrlMaps() });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['fs-xbrl-maps'] });

  const save = useMutation({
    mutationFn: () =>
      fsConsolidationApi.saveXbrlMap(editing === 'new' ? null : (editing as FsXbrlMapDto).id, {
        templateCode: form.templateCode.trim(),
        rowCode: form.rowCode.trim(),
        element: form.element.trim(),
        periodType: form.periodType,
      }),
    onSuccess: async () => {
      setEditing(null);
      await invalidate();
      notify('نگاشت ذخیره شد.');
    },
  });

  const remove = useMutation({ mutationFn: (m: FsXbrlMapDto) => fsConsolidationApi.deleteXbrlMap(m.id), onSuccess: invalidate });

  const columns: DataTableColumn<FsXbrlMapDto>[] = [
    { key: 't', header: 'قالب / ردیف', render: (m) => `${m.templateCode} / ${m.rowCode}` },
    { key: 'e', header: 'عنصر XBRL', render: (m) => <span dir="ltr">{m.element}</span> },
    { key: 'p', header: 'نوع دوره', render: (m) => (m.periodType === 1 ? 'لحظه‌ای (پایان دوره)' : 'دوره‌ای') },
    {
      key: 'ops',
      header: '',
      align: 'end',
      render: (m) => (
        <Stack direction="row" spacing={0} sx={{ justifyContent: 'flex-end' }}>
          <IconButton
            size="small"
            color="primary"
            onClick={() => {
              setForm({ templateCode: m.templateCode, rowCode: m.rowCode, element: m.element, periodType: m.periodType });
              save.reset();
              setEditing(m);
            }}
          >
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" disabled={remove.isPending} onClick={() => remove.mutate(m)}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      ),
    },
  ];

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'center', mb: 1.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          هر ردیف صورت به یک عنصر طبقه‌بندی (prefix:Name) نگاشت می‌شود. فضاهای نام و آدرس طبقه‌بندی را در «تنظیمات مجموعه» وارد کنید؛ فایل XBRL از
          صفحهٔ هر اجرا دریافت می‌شود.
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddOutlinedIcon />}
          onClick={() => {
            setForm(empty);
            save.reset();
            setEditing('new');
          }}
        >
          نگاشت جدید
        </Button>
      </Stack>
      {(query.error ?? remove.error) && <ErrorBanner error={query.error ?? remove.error} />}
      <DataTable columns={columns} rows={query.data ?? []} getRowKey={(m) => m.id} isLoading={query.isLoading} emptyMessage="نگاشتی تعریف نشده است." />

      <Dialog open={editing !== null} onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing === 'new' ? 'نگاشت XBRL جدید' : 'ویرایش نگاشت XBRL'}</DialogTitle>
        <DialogContent>
          {save.isError && <ErrorBanner error={save.error} />}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField label="کد قالب" value={form.templateCode} onChange={(e) => setForm((f) => ({ ...f, templateCode: e.target.value }))} fullWidth slotProps={{ htmlInput: { dir: 'ltr' } }} />
              <TextField label="کد ردیف" value={form.rowCode} onChange={(e) => setForm((f) => ({ ...f, rowCode: e.target.value }))} sx={{ width: 140 }} slotProps={{ htmlInput: { dir: 'ltr' } }} />
            </Stack>
            <TextField label="عنصر (prefix:Name)" value={form.element} onChange={(e) => setForm((f) => ({ ...f, element: e.target.value }))} placeholder="ifrs-full:Assets" slotProps={{ htmlInput: { dir: 'ltr' } }} />
            <TextField select label="نوع دوره" value={form.periodType} onChange={(e) => setForm((f) => ({ ...f, periodType: Number(e.target.value) }))}>
              <MenuItem value={1}>لحظه‌ای — مانده‌ها (instant)</MenuItem>
              <MenuItem value={2}>دوره‌ای — گردش‌ها (duration)</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>انصراف</Button>
          <Button variant="contained" disabled={!form.templateCode.trim() || !form.rowCode.trim() || !form.element.trim() || save.isPending} onClick={() => save.mutate()}>
            ذخیره
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
