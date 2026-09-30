import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorBanner } from '../../components/ErrorBanner';
import { MonoCode } from '../../components/MonoCode';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { useSession } from '../../lib/session/SessionContext';
import { normalizeNumericInput } from '../../lib/format/numbers';
import { FS_FRAMEWORK_OPTIONS, type FsFrameworkValue } from '../../types/fsTemplate';
import { FS_CHECK_SEVERITY_LABEL, type FsCheckRuleDto } from '../../types/fsRun';
import { fsCheckRulesApi } from './api';

interface FormState {
  code: string;
  titleFa: string;
  leftExpr: string;
  rightExpr: string;
  tolerance: string;
  severity: number;
  isActive: boolean;
  shared: boolean;
}

const emptyForm: FormState = { code: '', titleFa: '', leftExpr: '', rightExpr: '', tolerance: '0', severity: 3, isActive: true, shared: false };

/**
 * قواعد کنترل تساوی بین صورت‌ها (بخش ۴۵-ه، سند منبع §۱۰ «قواعد به‌صورت داده»): کارشناس بدون نسخهٔ تازهٔ
 * نرم‌افزار قاعده اضافه می‌کند. عبارت‌ها زبان فرمول قالب‌اند و فقط <code>STMT(قالب, ردیف)</code> ارجاع می‌دهند؛
 * مبالغ با علامت حسابداری (بدهکار مثبت، بستانکار منفی).
 */
export function FsCheckRulesPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { unitCode } = useSession();
  const [framework, setFramework] = useState<FsFrameworkValue>(1);
  const [editing, setEditing] = useState<FsCheckRuleDto | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [pendingDelete, setPendingDelete] = useState<FsCheckRuleDto | null>(null);

  const listQuery = useQuery({ queryKey: ['fs-check-rules', unitCode], queryFn: () => fsCheckRulesApi.list() });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['fs-check-rules'] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const common = {
        titleFa: form.titleFa.trim(),
        leftExpr: form.leftExpr.trim(),
        rightExpr: form.rightExpr.trim(),
        tolerance: Number(form.tolerance) || 0,
        severity: form.severity,
        isActive: form.isActive,
      };
      if (editing === 'new') {
        await fsCheckRulesApi.create({ ...common, framework, code: form.code.trim(), shared: form.shared });
      } else if (editing) {
        await fsCheckRulesApi.update(editing.id, common);
      }
    },
    onSuccess: async () => {
      setEditing(null);
      await invalidate();
      notify('قاعدهٔ کنترل ذخیره شد.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (r: FsCheckRuleDto) => fsCheckRulesApi.remove(r.id),
    onSuccess: async () => {
      setPendingDelete(null);
      await invalidate();
      notify('قاعدهٔ کنترل حذف شد.');
    },
  });

  const open = (r: FsCheckRuleDto | 'new') => {
    saveMutation.reset();
    setForm(
      r === 'new'
        ? emptyForm
        : {
            code: r.code,
            titleFa: r.titleFa,
            leftExpr: r.leftExpr,
            rightExpr: r.rightExpr,
            tolerance: String(r.tolerance),
            severity: r.severity,
            isActive: r.isActive,
            shared: r.ownerVahedCode === null,
          },
    );
    setEditing(r);
  };

  const rows = (listQuery.data ?? []).filter((r) => r.framework === framework);

  const columns: DataTableColumn<FsCheckRuleDto>[] = [
    { key: 'code', header: 'کد', width: 70, render: (r) => <MonoCode value={r.code} /> },
    {
      key: 'title',
      header: 'قاعده',
      render: (r) => (
        <Stack>
          <Typography variant="body2">{r.titleFa}</Typography>
          <Typography variant="caption" color="text.secondary" dir="ltr" sx={{ fontFamily: 'monospace', textAlign: 'left' }}>
            {r.leftExpr} = {r.rightExpr}
          </Typography>
        </Stack>
      ),
    },
    { key: 'sev', header: 'شدت', width: 100, render: (r) => FS_CHECK_SEVERITY_LABEL[r.severity] },
    {
      key: 'owner',
      header: 'مالک',
      width: 100,
      render: (r) => <Chip size="small" variant="outlined" color={r.ownerVahedCode ? 'default' : 'primary'} label={r.ownerVahedCode ?? 'مشترک'} />,
    },
    { key: 'active', header: 'فعال', width: 60, render: (r) => (r.isActive ? 'بله' : 'خیر') },
    {
      key: 'action',
      header: 'عملیات',
      align: 'end',
      render: (r) =>
        r.canEdit ? (
          <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
            <IconButton size="small" color="primary" onClick={() => open(r)}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" color="error" onClick={() => setPendingDelete(r)}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Stack>
        ) : (
          <Tooltip title={r.ownerVahedCode ? 'قاعدهٔ واحد دیگر' : 'قاعدهٔ مشترک را فقط ستاد تغییر می‌دهد'}>
            <Typography variant="caption" color="text.secondary">
              فقط مشاهده
            </Typography>
          </Tooltip>
        ),
    },
  ];

  return (
    <section>
      <PageHeader
        eyebrow="صورت‌های مالی"
        icon={<RuleOutlinedIcon />}
        title="کنترل‌های صورت‌ها"
        description="قواعد تساوی بین صورت‌ها که با هر تهیهٔ صورت اجرا می‌شوند. خطای «مسدودکننده» جلوی ارسال برای تأیید را می‌گیرد. کنترل‌های تراز آزمایشی، پوشش حساب‌ها، ماندهٔ معکوس و جمع یادداشت‌ها همیشه اجرا می‌شوند."
        actions={
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => open('new')}>
            قاعدهٔ جدید
          </Button>
        }
      />
      {listQuery.isError && <ErrorBanner error={listQuery.error} />}
      {deleteMutation.isError && <ErrorBanner error={deleteMutation.error} />}
      <Tabs value={framework} onChange={(_, v: FsFrameworkValue) => setFramework(v)} sx={{ mb: 2 }}>
        {FS_FRAMEWORK_OPTIONS.map((o) => (
          <Tab key={o.value} value={o.value} label={o.label} />
        ))}
      </Tabs>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        isLoading={listQuery.isLoading}
        emptyMessage="قاعده‌ای برای این مجموعه نیست."
        emptyHint="«قالب‌های پیش‌فرض» در صفحهٔ قالب‌ها قواعد پیش‌فرض را هم می‌سازد."
      />

      <Dialog open={editing !== null} onClose={() => setEditing(null)} maxWidth="md" fullWidth>
        <DialogTitle>{editing === 'new' ? 'قاعدهٔ کنترل جدید' : `ویرایش ${editing?.code ?? ''}`}</DialogTitle>
        <DialogContent>
          {saveMutation.isError && <ErrorBanner error={saveMutation.error} />}
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                label="کد"
                fullWidth
                value={form.code}
                disabled={editing !== 'new'}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                slotProps={{ htmlInput: { dir: 'ltr', maxLength: 20 } }}
                placeholder="V-12"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 9 }}>
              <TextField label="عنوان" fullWidth value={form.titleFa} onChange={(e) => setForm({ ...form, titleFa: e.target.value })} />
            </Grid>
            <Grid size={12}>
              <TextField
                label="سمت چپ"
                fullWidth
                value={form.leftExpr}
                onChange={(e) => setForm({ ...form, leftExpr: e.target.value })}
                slotProps={{ htmlInput: { dir: 'ltr', style: { fontFamily: 'monospace' } } }}
                helperText="مثال: STMT(PENSION.EQUITY_MOVEMENT, Q99)"
              />
            </Grid>
            <Grid size={12}>
              <TextField
                label="سمت راست"
                fullWidth
                value={form.rightExpr}
                onChange={(e) => setForm({ ...form, rightExpr: e.target.value })}
                slotProps={{ htmlInput: { dir: 'ltr', style: { fontFamily: 'monospace' } } }}
                helperText="مثال: STMT(PENSION.NET_ASSETS, N99) — مبالغ با علامت حسابداری (بستانکار منفی)"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="اختلاف مجاز (ریال)"
                fullWidth
                value={form.tolerance}
                onChange={(e) => setForm({ ...form, tolerance: normalizeNumericInput(e.target.value) })}
                slotProps={{ htmlInput: { dir: 'ltr' } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField select label="شدت" fullWidth value={form.severity} onChange={(e) => setForm({ ...form, severity: Number(e.target.value) })}>
                {[3, 2, 1].map((s) => (
                  <MenuItem key={s} value={s}>
                    {FS_CHECK_SEVERITY_LABEL[s]}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControlLabel
                control={<Checkbox checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />}
                label="فعال"
              />
            </Grid>
            {editing === 'new' && (
              <Grid size={12}>
                <FormControlLabel
                  control={<Checkbox checked={form.shared} onChange={(e) => setForm({ ...form, shared: e.target.checked })} />}
                  label="قاعدهٔ مشترک همهٔ واحدها (فقط ستاد مرکزی)"
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)} disabled={saveMutation.isPending}>
            انصراف
          </Button>
          <Button
            variant="contained"
            disabled={saveMutation.isPending || !form.titleFa.trim() || !form.leftExpr.trim() || !form.rightExpr.trim() || (editing === 'new' && !form.code.trim())}
            onClick={() => saveMutation.mutate()}
          >
            ذخیره
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف قاعدهٔ کنترل"
        description={pendingDelete ? `قاعدهٔ «${pendingDelete.code} — ${pendingDelete.titleFa}» حذف می‌شود.` : undefined}
        pending={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete)}
      />
    </section>
  );
}
