import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import ListSubheader from '@mui/material/ListSubheader';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpwardOutlined';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownwardOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import { AccountCodePickerDialog } from '../../../components/AccountCodePickerDialog';
import { TafsiliItemSelect } from '../../../components/dynamic-tafsili/TafsiliItemSelect';
import { useTafsiliLevels } from '../../../components/dynamic-tafsili/useTafsiliLevels';
import { accountTafsilGroupLinksApi } from '../../account-tafsil-group-links/api';
import { toPersianDigits } from '../../../lib/format/numbers';
import type { TafsiliLevelDto } from '../../../types/tafsili';
import { newParam, type DesignLevel, type DesignLine, type DesignParam } from './designerModel';
import { attributeHint, lineExtrasApi } from '../../vouchers/lineExtras';
import { useSession } from '../../../lib/session/SessionContext'; // سال مالی جاری برای یادداشت حساب

/** معین = TYPECODE 3 (گروه 1، کل 2). */
const MOIN = 3;

interface LineEditorProps {
  line: DesignLine;
  index: number;
  count: number;
  params: DesignParam[];
  groupName: (groupId: string) => string;
  onChange: (line: DesignLine) => void;
  /** Adds a question to the template and returns it (so the line can bind to it immediately). */
  onAddParam: (param: DesignParam) => void;
  /** A bound question with no group yet takes the level's only group. */
  onSetParamGroup: (key: string, groupId: string) => void;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
}

export function LineEditor({ line, index, count, params, groupName, onChange, onAddParam, onSetParamGroup, onRemove, onMove }: LineEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const amountParams = params.filter((p) => p.type === 1);
  const set = (patch: Partial<DesignLine>) => onChange({ ...line, ...patch });

  function amountChanged(value: string) {
    if (value === '__new') {
      const p = newParam(params, 1, { title: `مبلغ ${toPersianDigits(amountParams.length + 1)}` });
      onAddParam(p);
      set({ amountParameterKey: p.key });
    } else set({ amountParameterKey: value });
  }

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, mb: 1.5, borderRadius: 2.5, borderInlineStartWidth: 4, borderInlineStartColor: line.side === 1 ? 'info.main' : 'warning.main' }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
        <Typography variant="body1" sx={{ fontWeight: 700 }}>ردیف {toPersianDigits(index + 1)}</Typography>
        <ToggleButtonGroup size="small" exclusive color={line.side === 1 ? "info" : "warning"} value={line.side} onChange={(_, v) => v && set({ side: v })}>
          <ToggleButton value={1}>بدهکار</ToggleButton>
          <ToggleButton value={2}>بستانکار</ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" disabled={index === 0} onClick={() => onMove(-1)} aria-label="بالا"><ArrowUpwardIcon fontSize="small" /></IconButton>
        <IconButton size="small" disabled={index === count - 1} onClick={() => onMove(1)} aria-label="پایین"><ArrowDownwardIcon fontSize="small" /></IconButton>
        <Tooltip title="حذف ردیف">
          <span>
            <IconButton size="small" color="error" disabled={count <= 2} onClick={onRemove} aria-label="حذف ردیف"><DeleteOutlineIcon fontSize="small" /></IconButton>
          </span>
        </Tooltip>
      </Stack>

      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="حساب معین"
            fullWidth
            size="small"
            value={line.accountLabel}
            onClick={() => setPickerOpen(true)}
            placeholder={line.hint ? `مثلاً: ${line.hint}` : "انتخاب از کدینگ"}
            helperText={!line.accountId && line.hint ? `پیشنهاد: ${line.hint}` : undefined}
            slotProps={{
              htmlInput: { readOnly: true },
              input: { startAdornment: <InputAdornment position="start"><AccountTreeOutlinedIcon fontSize="small" /></InputAdornment> },
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <TextField
            select
            label="مبلغ ردیف"
            fullWidth
            size="small"
            disabled={line.isBalancing}
            value={line.isBalancing ? '' : line.amountParameterKey}
            onChange={(e) => amountChanged(e.target.value)}
            helperText={line.isBalancing ? 'برابر اختلاف بقیهٔ ردیف‌ها' : undefined}
          >
            {amountParams.map((p) => (
              <MenuItem key={p.key} value={p.key}>{p.title || p.key}</MenuItem>
            ))}
            <MenuItem value="__new"><em>+ سؤال مبلغ جدید</em></MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <TextField
            label="درصد از مبلغ"
            fullWidth
            size="small"
            disabled={line.isBalancing}
            value={line.isBalancing ? '' : line.percent}
            onChange={(e) => set({ percent: e.target.value.replace(/[^\d.]/g, '') })}
            helperText={!line.isBalancing && line.percent !== '100' ? 'مثلاً ۹ برای مالیات؛ ردیف تراز‌کننده لازم می‌شود' : undefined}
            slotProps={{ input: { endAdornment: <InputAdornment position="end">٪</InputAdornment> } }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <FormControlLabel
            control={<Checkbox checked={line.isBalancing} onChange={(e) => set({ isBalancing: e.target.checked })} />}
            label="ردیف تراز‌کننده (اختلاف گرد کردن و کسورات را جذب می‌کند)"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label="شرح اختصاصی ردیف (اختیاری)"
            fullWidth
            size="small"
            value={line.descriptionPattern}
            onChange={(e) => set({ descriptionPattern: e.target.value })}
            helperText="خالی = همان شرح سند"
          />
        </Grid>
      </Grid>

      {line.accountId && (
        <LevelBindings line={line} params={params} groupName={groupName} onChange={(details) => set({ details })} onAddParam={onAddParam} onSetParamGroup={onSetParamGroup} />
      )}

      {line.accountId && <AccountExtrasNote line={line} />}

      <AccountCodePickerDialog
        open={pickerOpen}
        title="انتخاب حساب معین"
        onClose={() => setPickerOpen(false)}
        filterRows={(a) => a.typeCode === MOIN}
        onSelect={(a) => {
          set({ accountId: a.id, accountLabel: `${a.accCode ?? ''} - ${a.accCodeName ?? ''}`, details: [] });
          setPickerOpen(false);
        }}
      />
    </Paper>
  );
}

/**
 * One row per تفصیلی level of the chosen معین (all are required — rule A). The allowed groups come
 * from the معین's own level→group links, so a question created here can never get a wrong group.
 */
function LevelBindings({ line, params, groupName, onChange, onAddParam, onSetParamGroup }: {
  line: DesignLine;
  params: DesignParam[];
  groupName: (groupId: string) => string;
  onChange: (details: DesignLevel[]) => void;
  onAddParam: (param: DesignParam) => void;
  onSetParamGroup: (key: string, groupId: string) => void;
}) {
  const { allLevels, isLoading } = useTafsiliLevels(line.accountId);
  const links = useQuery({
    queryKey: ['account-tafsil-group-links', line.accountId],
    queryFn: () => accountTafsilGroupLinksApi.list(line.accountId),
  });

  if (isLoading) return <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>در حال خواندن سطوح تفصیلی…</Typography>;
  if (allLevels.length === 0) {
    return <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>این معین تفصیلی ندارد.</Typography>;
  }

  const groupsOf = (level: TafsiliLevelDto) =>
    (links.data ?? []).filter((l) => !l.isDeleted && l.levelId === level.levelId).map((l) => l.tafsilGroupId);

  function bind(level: TafsiliLevelDto, patch: Partial<DesignLevel> | null) {
    const others = line.details.filter((d) => d.level !== level.code);
    if (!patch) return onChange(others);
    const current = line.details.find((d) => d.level === level.code)
      ?? { level: level.code, source: 'param' as const, parameterKey: '', fixedDetailId: '', fixedLabel: '' };
    onChange([...others, { ...current, ...patch }].sort((a, b) => a.level - b.level));
  }

  function sourceChanged(level: TafsiliLevelDto, value: string) {
    if (value === '') return bind(level, null);
    if (value === '__fixed') return bind(level, { source: 'fixed', parameterKey: '' });
    if (value === '__new') {
      const groups = groupsOf(level);
      const p = newParam(params, 2, {
        title: level.levelName,
        askPrompt: `${level.levelName} کدام است؟`,
        detailGroupId: groups.length === 1 ? groups[0] : null,
      });
      onAddParam(p);
      return bind(level, { source: 'param', parameterKey: p.key, fixedDetailId: '', fixedLabel: '' });
    }
    const chosen = params.find((p) => p.key === value);
    const levelGroups = groupsOf(level);
    if (chosen && !chosen.detailGroupId && levelGroups.length === 1) onSetParamGroup(chosen.key, levelGroups[0]);
    bind(level, { source: 'param', parameterKey: value, fixedDetailId: '', fixedLabel: '' });
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>تفصیلی‌های این ردیف (همه الزامی‌اند)</Typography>
      <Stack spacing={1.25}>
        {allLevels.map((level) => {
          const binding = line.details.find((d) => d.level === level.code);
          const groups = groupsOf(level);
          const value = !binding ? '' : binding.source === 'fixed' ? '__fixed' : binding.parameterKey;
          const detailParams = params.filter((p) => p.type === 2);
          return (
            <Grid container spacing={1} key={level.levelId} sx={{ alignItems: 'flex-start' }}>
              <Grid size={{ xs: 12, sm: 3 }}>
                <Typography variant="body2" sx={{ pt: 1 }}>
                  سطح {toPersianDigits(level.code)}: <strong>{level.levelName}</strong>
                </Typography>
                <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
                  {groups.map((g) => <Chip key={g} size="small" variant="outlined" label={groupName(g)} />)}
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="از کجا بیاید؟"
                  value={value}
                  error={!binding}
                  helperText={!binding ? 'تعیین نشده' : undefined}
                  onChange={(e) => sourceChanged(level, e.target.value)}
                >
                  <MenuItem value="__new"><em>+ سؤال جدید از کاربر</em></MenuItem>
                  <MenuItem value="__fixed">تفصیلی ثابت (همیشه یکی)</MenuItem>
                  {detailParams.length > 0 && <ListSubheader>سؤال‌های تفصیلی موجود</ListSubheader>}
                  {detailParams.map((p) => {
                    const compatible = !p.detailGroupId || groups.includes(p.detailGroupId);
                    return (
                      <MenuItem key={p.key} value={p.key} disabled={!compatible}>
                        {p.title || p.key}{compatible ? '' : ' — گروهش با این سطح نمی‌خواند'}
                      </MenuItem>
                    );
                  })}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 5 }}>
                {binding?.source === 'fixed' && (
                  <TafsiliItemSelect
                    accountCodeId={line.accountId}
                    level={level}
                    value={binding.fixedDetailId ? { levelId: level.levelId, tafsiliId: binding.fixedDetailId, label: binding.fixedLabel } : null}
                    onChange={(s) => s && bind(level, { fixedDetailId: s.tafsiliId, fixedLabel: s.label })}
                  />
                )}
              </Grid>
            </Grid>
          );
        })}
      </Stack>
      {groupsMissing(allLevels, groupsOf) && (
        <Alert severity="warning" sx={{ mt: 1 }}>برای بعضی سطوح این معین گروه تفصیلی تعریف نشده؛ اول در کدینگ حساب تعریفش کنید.</Alert>
      )}
    </Box>
  );
}

function groupsMissing(levels: TafsiliLevelDto[], groupsOf: (l: TafsiliLevelDto) => string[]) {
  return levels.some((l) => groupsOf(l).length === 0);
}

export function LineSideLabel({ side }: { side: 1 | 2 }) {
  return <Chip size="small" color={side === 1 ? 'info' : 'warning'} label={side === 1 ? 'بدهکار' : 'بستانکار'} />;
}


/**
 * به طراح می‌گوید این معین هنگام ثبت چه چیزی بیش از الگو لازم دارد — شناسه (حساب شناسه‌دار)، ویژگی، یا
 * چک/فیش (حساب بانکی). این‌ها در الگو تعریف نمی‌شوند: هنگام «ثبت»، حسابیار فرمشان را باز می‌کند و کاربر وارد می‌کند.
 * (ویژگی وصل به تفصیلی پرسشی فقط هنگام ثبت معلوم است؛ اینجا ویژگی خود حساب و تفصیلی‌های ثابت دیده می‌شود.)
 */
function AccountExtrasNote({ line }: { line: DesignLine }) {
  const { financialYear } = useSession();
  const fixedIds = line.details.filter((d) => d.source === 'fixed' && d.fixedDetailId).map((d) => d.fixedDetailId).sort();
  const req = useQuery({
    queryKey: ['voucher-line-req', line.accountId, fixedIds.join(','), financialYear],
    queryFn: () => lineExtrasApi.requirements(line.accountId, fixedIds, financialYear),
    enabled: !!financialYear,
    staleTime: 60_000,
  });
  const r = req.data;
  if (!r) return null;
  const notes: string[] = [];
  if (r.isBankAccount) {
    notes.push(line.side === 2
      ? 'حساب بانکی است: هنگام ثبت، فرم انتخاب برگ چک یا چک صوری (اعلامیه) باز می‌شود.'
      : 'حساب بانکی است: هنگام ثبت، فرم فیش/حوالهٔ واریز باز می‌شود.');
  }
  if (r.attributes.length > 0) {
    notes.push(`حساب شناسه‌دار است: هنگام ثبت ${r.attributes.map((a) => `شناسه (${attributeHint(a)})`).join(' و ')} از کاربر گرفته می‌شود.`);
  }
  for (const g of r.identities) {
    const variable = g.fields.filter((f) => f.kind === 2).map((f) => f.title);
    notes.push(`ویژگی «${g.title}»: هنگام ثبت شناسنامه انتخاب و ${variable.length ? `فیلدهای متغیر (${variable.join('، ')})` : 'بدون فیلد متغیر'} وارد می‌شود.`);
  }
  if (notes.length === 0) return null;
  return (
    <Alert severity="info" sx={{ mt: 1.5, py: 0.25 }}>
      {notes.map((n) => <Box key={n}>{n}</Box>)}
    </Alert>
  );
}
