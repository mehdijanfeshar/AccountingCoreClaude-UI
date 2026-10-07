import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import DesignServicesOutlinedIcon from '@mui/icons-material/DesignServicesOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import { PageHeader } from '../../../components/PageHeader';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { FormLoadingSkeleton } from '../../../components/FormLoadingSkeleton';
import { ABILITIES, useRoles } from '../../../lib/roles';
import { toPersianDigits } from '../../../lib/format/numbers';
import { tafsilGroupsApi } from '../../tafsil-groups/api';
import { sysTypesApi } from '../../../lib/api/sysTypesApi';
import MenuItem from '@mui/material/MenuItem';
import { templateDesignApi } from '../api';
import { vahedTypesApi } from '../../coding-permissions/api';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import { TemplateTestDialog } from './TemplateTestDialog';
import { LineEditor, LineSideLabel } from './LineEditor';
import { ParamsEditor } from './ParamsEditor';
import {
  PARAM_TYPE_LABEL,
  STARTER_TEMPLATES,
  emptyModel,
  fromStarter,
  fromDefinition,
  newLine,
  quickChecks,
  renameKey,
  toPayload,
  type DesignModel,
} from './designerModel';

/**
 * طراحی الگوی عملیات (مدیر ستاد). Left: what the accountant defines — the operation, the voucher
 * rows and the questions. Right: what a non-accounting user will experience, live, plus checks.
 */
export function TemplateDesignerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // تعریف الگوی سراسری = قابلیت «templates.define» (پیش‌فرض: کاربر ستاد مرکزی).
  const { hasAbility, loaded: rolesLoaded } = useRoles();
  const isSetad = hasAbility(ABILITIES.TemplatesDefine);

  const existing = useQuery({
    queryKey: ['operation-template-definition', id],
    queryFn: () => templateDesignApi.get(id!),
    enabled: !!id,
    // The designer edits a copy of this; it must start from what is in the database right now.
    gcTime: 0,
  });
  const sysTypesQuery = useQuery({ queryKey: ['sys-types'], queryFn: () => sysTypesApi.list() });
  const vahedTypesQuery = useQuery({ queryKey: ['vahed-types'], queryFn: () => vahedTypesApi.list(), staleTime: 300_000 });
  const [testOpen, setTestOpen] = useState(false);
  const groupsQuery = useQuery({ queryKey: ['tafsil-groups', 'all'], queryFn: () => tafsilGroupsApi.list({ pageNumber: 1, pageSize: 200 }) });

  const [model, setModel] = useState<DesignModel>(() => emptyModel());
  useEffect(() => {
    if (existing.data) setModel(fromDefinition(existing.data));
  }, [existing.data]);

  const groups = useMemo(
    () => (groupsQuery.data?.items ?? []).map((g) => ({ id: g.id, name: `${g.tafsilGroupCode ?? ''} - ${g.tafsilGroupName ?? ''}` })),
    [groupsQuery.data],
  );
  const groupName = (gid: string) => groups.find((g) => g.id === gid)?.name ?? 'گروه';

  const [serverErrors, setServerErrors] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<'check' | 'save' | null>(null);
  const [requestError, setRequestError] = useState<unknown>(null);

  const hints = quickChecks(model);
  const readOnly = rolesLoaded && !isSetad;

  const update = (patch: Partial<DesignModel>) => {
    setModel((m) => ({ ...m, ...patch }));
    setServerErrors(null);
  };

  async function check() {
    setBusy('check');
    setRequestError(null);
    try {
      const r = await templateDesignApi.validate(model.id, toPayload(model));
      setServerErrors(r.errors);
    } catch (e) {
      setRequestError(e);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy('save');
    setRequestError(null);
    try {
      const payload = toPayload(model);
      const r = model.id ? await templateDesignApi.update(model.id, payload) : await templateDesignApi.create(payload);
      if (!r.success) {
        setServerErrors(r.errors);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['operation-templates'] });
      await queryClient.invalidateQueries({ queryKey: ['operation-template-definitions'] });
      // Drop the cached definition: reopening must load the saved version, never flash the pre-edit copy.
      queryClient.removeQueries({ queryKey: ['operation-template-definition'] });
      navigate('/assistant/templates');
    } catch (e) {
      setRequestError(e);
    } finally {
      setBusy(null);
    }
  }

  if (id && existing.isLoading) return <FormLoadingSkeleton />;

  return (
    <Box>
      <PageHeader
        eyebrow="حسابیار"
        icon={<DesignServicesOutlinedIcon fontSize="small" />}
        accentColor="secondary"
        title={id ? `ویرایش الگو: ${model.title || model.code}` : 'الگوی عملیات جدید'}
        description="حسابدار ستاد یک بار تعریف می‌کند که هر عملیات روزمره چه سندی می‌سازد؛ کاربر واحد فقط به چند سؤال ساده جواب می‌دهد."
        actions={<Button color="inherit" onClick={() => navigate('/assistant/templates')}>بازگشت به فهرست</Button>}
      />

      {existing.error != null && <ErrorBanner error={existing.error} />}
      {readOnly && <Alert severity="info" sx={{ mb: 2 }}>فقط «مدیر ستاد» می‌تواند الگو را ذخیره کند؛ شما فقط می‌بینید.</Alert>}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 8 }}>
          {!model.id && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderRadius: 3, borderStyle: 'dashed' }}>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>شروع از نمونه</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
                سؤال‌ها، سمت ردیف‌ها و شرح آماده می‌شود؛ فقط حساب‌های معین و تفصیلی هر سطح را انتخاب کنید.
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                {STARTER_TEMPLATES.map((s) => (
                  <Chip key={s.code} label={s.title} color={model.code === s.code ? 'secondary' : 'default'}
                    variant={model.code === s.code ? 'filled' : 'outlined'}
                    onClick={() => { setModel(fromStarter(s)); setServerErrors(null); }} />
                ))}
                <Chip label="خالی" variant="outlined" onClick={() => { setModel(emptyModel()); setServerErrors(null); }} />
              </Stack>
            </Paper>
          )}

          {/* ── ۱. عملیات ── */}
          <Section step={1} title="عملیات چیست؟">
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, sm: 8 }}>
                <TextField label="عنوان عملیات (همان که کاربر می‌بیند)" fullWidth value={model.title}
                  onChange={(e) => update({ title: e.target.value })} placeholder="مثلاً: خرید کالا" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField label="کد لاتین" fullWidth value={model.code}
                  onChange={(e) => update({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
                  placeholder="BUY_GOODS" slotProps={{ htmlInput: { dir: 'ltr' } }} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="نوع سند"
                  fullWidth
                  value={model.systemTypeId ?? ''}
                  onChange={(e) => update({ systemTypeId: e.target.value || null })}
                  helperText="سندی که از این الگو ساخته می‌شود همین نوع را می‌گیرد."
                  // Without displayEmpty an unset value renders as a blank box — on templates saved before
                  // this field existed it looked like the field was missing altogether.
                  slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
                >
                  <MenuItem value=""><em>بدون نوع</em></MenuItem>
                  {(sysTypesQuery.data ?? []).map((t) => (
                    <MenuItem key={t.id} value={t.id}>{t.sysName ?? t.sysCode}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="برای کدام نوع واحدها؟"
                  fullWidth
                  value={model.allowedVahedTypes}
                  onChange={(e) => {
                    const v = e.target.value as unknown as string[] | string;
                    update({ allowedVahedTypes: typeof v === 'string' ? v.split(',').filter(Boolean) : v });
                  }}
                  helperText="خالی = همهٔ واحدها. فقط واحدهای این نوع‌ها این عملیات را در حسابیار می‌بینند."
                  slotProps={{
                    select: {
                      multiple: true,
                      displayEmpty: true,
                      renderValue: (selected) => {
                        const codes = selected as string[];
                        if (codes.length === 0) return <em>همهٔ واحدها</em>;
                        return codes.map((c) => vahedTypesQuery.data?.find((t) => t.typeCode === c)?.typeName ?? c).join('، ');
                      },
                    },
                    inputLabel: { shrink: true },
                  }}
                >
                  {(vahedTypesQuery.data ?? []).filter((t) => t.typeCode).map((t) => (
                    <MenuItem key={t.typeCode!} value={t.typeCode!}>{t.typeName ?? t.typeCode}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={12}>
                <TextField
                  label="چه وقت این عملیات انتخاب شود؟"
                  fullWidth
                  multiline
                  minRows={2}
                  value={model.description}
                  onChange={(e) => update({ description: e.target.value })}
                  placeholder="مثلاً: وقتی کالا یا تجهیزات (در، میز، دارو…) برای واحد خریده شده و پولش پرداخت شده یا بدهکار فروشنده‌ایم."
                  helperText="کلمه‌های این متن در جستجوی حسابیار پیدا می‌شوند و در فاز Agent به هوش مصنوعی داده می‌شوند؛ مثال‌های واقعی بنویسید."
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  label="کلمات کلیدی و جمله‌های نمونه (هر خط یکی)"
                  fullWidth
                  multiline
                  minRows={3}
                  value={model.keywords}
                  onChange={(e) => update({ keywords: e.target.value })}
                  placeholder={'دارو\nقرص خریدم\nداروخانه'}
                  helperText="هر کلمه یا جمله‌ای که کاربر ممکن است برای این عملیات بنویسد. جستجوی حسابیار این‌ها را از عنوان هم مهم‌تر می‌داند."
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  label="شرح سند"
                  fullWidth
                  value={model.voucherDescriptionPattern}
                  onChange={(e) => update({ voucherDescriptionPattern: e.target.value })}
                  placeholder="خرید از {supplier} - {note}"
                />
                <Stack direction="row" spacing={0.5} sx={{ mt: 0.75, flexWrap: 'wrap', rowGap: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>درج پاسخ:</Typography>
                  {model.params.map((p) => (
                    <Chip key={p.uid} size="small" variant="outlined" label={p.title || p.key}
                      onClick={() => update({ voucherDescriptionPattern: `${model.voucherDescriptionPattern}{${p.key}}` })} />
                  ))}
                </Stack>
              </Grid>
            </Grid>
          </Section>

          {/* ── ۲. ردیف‌ها ── */}
          <Section step={2} title="چه سندی ساخته شود؟">
            {model.lines.map((line, i) => (
              <LineEditor
                key={line.uid}
                line={line}
                index={i}
                count={model.lines.length}
                params={model.params}
                groupName={groupName}
                onChange={(l) => update({ lines: model.lines.map((x, j) => (j === i ? l : x)) })}
                onAddParam={(p) => setModel((m) => ({ ...m, params: [...m.params, p] }))}
                onSetParamGroup={(key, groupId) =>
                  setModel((m) => ({ ...m, params: m.params.map((p) => (p.key === key ? { ...p, detailGroupId: groupId } : p)) }))}
                onRemove={() => update({ lines: model.lines.filter((_, j) => j !== i) })}
                onMove={(d) => {
                  const next = [...model.lines];
                  [next[i], next[i + d]] = [next[i + d], next[i]];
                  update({ lines: next });
                }}
              />
            ))}
            <Stack direction="row" spacing={1}>
              <Button startIcon={<AddCircleOutlineIcon />} onClick={() => update({ lines: [...model.lines, newLine(1, model.params.find((p) => p.type === 1)?.key ?? '')] })}>
                ردیف بدهکار
              </Button>
              <Button startIcon={<AddCircleOutlineIcon />} onClick={() => update({ lines: [...model.lines, newLine(2, model.params.find((p) => p.type === 1)?.key ?? '')] })}>
                ردیف بستانکار
              </Button>
            </Stack>
          </Section>

          {/* ── ۳. سؤال‌ها ── */}
          <Section step={3} title="از کاربر چه بپرسیم؟ (به همین ترتیب)">
            <ParamsEditor
              model={model}
              groups={groups}
              onChange={(params) => update({ params })}
              onRenameKey={(from, to) => setModel((m) => renameKey(m, from, to))}
            />
          </Section>
        </Grid>

        {/* ── پیش‌نمایش و بررسی ── */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Box sx={{ position: 'sticky', top: 16 }}>
            <UserPreview model={model} />

            <Paper variant="outlined" sx={{ p: 2, mt: 2, borderRadius: 3 }}>
              {hints.length > 0 ? (
                <Alert severity="warning" sx={{ mb: 1.5 }}>
                  <AlertTitle>هنوز کامل نیست</AlertTitle>
                  {hints.slice(0, 8).map((h) => <Box key={h}>• {h}</Box>)}
                </Alert>
              ) : serverErrors === null ? (
                <Alert severity="info" sx={{ mb: 1.5 }}>ظاهراً کامل است؛ «بررسی» را بزنید تا سرور هم با کدینگ واقعی چک کند.</Alert>
              ) : null}
              {serverErrors && serverErrors.length > 0 && (
                <Alert severity="error" sx={{ mb: 1.5 }}>
                  <AlertTitle>بررسی سرور</AlertTitle>
                  {serverErrors.map((e) => <Box key={e}>• {e}</Box>)}
                </Alert>
              )}
              {serverErrors && serverErrors.length === 0 && <Alert severity="success" sx={{ mb: 1.5 }}>سرور الگو را تأیید کرد.</Alert>}
              {requestError != null && <Box sx={{ mb: 1.5 }}><ErrorBanner error={requestError} /></Box>}
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" startIcon={<FactCheckOutlinedIcon />} disabled={busy !== null} onClick={check}>
                  {busy === 'check' ? 'در حال بررسی…' : 'بررسی'}
                </Button>
                <Button variant="contained" disabled={busy !== null || readOnly} onClick={save}>
                  {busy === 'save' ? 'در حال ذخیره…' : 'ذخیرهٔ الگو'}
                </Button>
              </Stack>
              <Button sx={{ mt: 1 }} size="small" startIcon={<ScienceOutlinedIcon />} disabled={hints.length > 0} onClick={() => setTestOpen(true)}>
                آزمایش الگو (بدون ذخیره و بدون ثبت سند)
              </Button>
            </Paper>
            {testOpen && <TemplateTestDialog model={model} onClose={() => setTestOpen(false)} />}
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}

function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.75, md: 2.5 }, mb: 2.5, borderRadius: 3 }}>
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mb: 2 }}>
        <Avatar sx={{ width: 28, height: 28, fontSize: 14, bgcolor: 'secondary.main' }}>{toPersianDigits(step)}</Avatar>
        <Typography variant="h2" component="h2">{title}</Typography>
      </Stack>
      {children}
    </Paper>
  );
}

/** «کاربر این را می‌بیند» — the conversation and the voucher sketch this template produces. */
function UserPreview({ model }: { model: DesignModel }) {
  const title = (key: string) => model.params.find((p) => p.key === key)?.title || key;
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
      <Typography variant="body2" sx={{ fontWeight: 700, mb: 1.5 }}>کاربر این را می‌بیند</Typography>
      <Bubble>چه اتفاقی افتاده؟</Bubble>
      <Bubble user>{model.title || 'عنوان عملیات'}</Bubble>
      <Bubble>سند به چه تاریخی ثبت شود؟</Bubble>
      {model.params.map((p) => (
        <Bubble key={p.uid}>
          {p.askPrompt || <em>بدون متن سؤال</em>}
          <Box component="span" sx={{ display: 'block', fontSize: 11, color: 'text.secondary' }}>
            {PARAM_TYPE_LABEL[p.type]}{p.isRequired ? '' : ' — اختیاری'}
          </Box>
        </Bubble>
      ))}
      <Typography variant="body2" sx={{ fontWeight: 700, mt: 2, mb: 1 }}>سندی که ساخته می‌شود</Typography>
      <Stack spacing={1}>
        {model.lines.map((l, i) => (
          <Box key={l.uid} sx={{ fontSize: 13 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <LineSideLabel side={l.side} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{l.accountLabel || `ردیف ${toPersianDigits(i + 1)}: معین؟`}</Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mr: 1 }}>
              {l.isBalancing ? 'مبلغ: اختلاف بقیهٔ ردیف‌ها' : `مبلغ: ${l.amountParameterKey ? title(l.amountParameterKey) : '؟'}${l.percent !== '100' ? ` × ${toPersianDigits(l.percent)}٪` : ''}`}
              {l.details.map((d) => ` · سطح ${toPersianDigits(d.level)}: ${d.source === 'fixed' ? d.fixedLabel || 'ثابت' : title(d.parameterKey)}`).join('')}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}

function Bubble({ children, user }: { children: React.ReactNode; user?: boolean }) {
  return (
    <Stack direction="row" spacing={1} sx={{ justifyContent: user ? 'flex-end' : 'flex-start', mb: 1, alignItems: 'flex-start' }}>
      {!user && <Avatar sx={{ width: 22, height: 22, bgcolor: 'secondary.main' }}><AutoAwesomeOutlinedIcon sx={{ fontSize: 14 }} /></Avatar>}
      <Box sx={{ px: 1.25, py: 0.75, borderRadius: 2, fontSize: 13, bgcolor: user ? 'primary.main' : 'action.hover', color: user ? 'primary.contrastText' : 'text.primary', maxWidth: '85%' }}>
        {children}
      </Box>
    </Stack>
  );
}
