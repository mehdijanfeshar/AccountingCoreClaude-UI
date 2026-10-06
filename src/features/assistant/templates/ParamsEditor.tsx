import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpwardOutlined';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownwardOutlined';
import { PARAM_TYPE_LABEL, newParam, placementsOf, usagesOf, type DesignModel, type DesignParam } from './designerModel';
import type { ParameterType } from '../types';

interface ParamsEditorProps {
  model: DesignModel;
  groups: { id: string; name: string }[];
  onChange: (params: DesignParam[]) => void;
  onRenameKey: (from: string, to: string) => void;
}

/** «سؤال‌هایی که از کاربر پرسیده می‌شود» — the order here is the order of the conversation. */
export function ParamsEditor({ model, groups, onChange, onRenameKey }: ParamsEditorProps) {
  const params = model.params;
  const update = (i: number, patch: Partial<DesignParam>) => onChange(params.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...params];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };

  return (
    <Box>
      {params.map((p, i) => {
        const used = usagesOf(model, p.key);
        return (
          <Paper key={p.uid} variant="outlined" sx={{ p: 1.75, mb: 1.25, borderRadius: 2.5 }}>
            <Grid container spacing={1.25} sx={{ alignItems: 'center' }}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField label="عنوان" size="small" fullWidth value={p.title} onChange={(e) => update(i, { title: e.target.value })} />
              </Grid>
              <Grid size={{ xs: 7, sm: 3 }}>
                <TextField
                  select
                  label="نوع"
                  size="small"
                  fullWidth
                  value={p.type}
                  onChange={(e) => update(i, { type: Number(e.target.value) as ParameterType, detailGroupId: null })}
                >
                  {([1, 2, 3, 4] as ParameterType[]).map((t) => <MenuItem key={t} value={t}>{PARAM_TYPE_LABEL[t]}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 5, sm: 2 }}>
                <TextField
                  label="کلید"
                  size="small"
                  fullWidth
                  value={p.key}
                  onChange={(e) => onRenameKey(p.key, e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                  slotProps={{ htmlInput: { dir: 'ltr' } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
                  <FormControlLabel control={<Switch size="small" checked={p.isRequired} onChange={(e) => update(i, { isRequired: e.target.checked })} />} label="الزامی" />
                  <IconButton size="small" disabled={i === 0} onClick={() => move(i, -1)} aria-label="بالا"><ArrowUpwardIcon fontSize="small" /></IconButton>
                  <IconButton size="small" disabled={i === params.length - 1} onClick={() => move(i, 1)} aria-label="پایین"><ArrowDownwardIcon fontSize="small" /></IconButton>
                  <Tooltip title={used ? `در ${used} جای الگو استفاده شده` : 'حذف سؤال'}>
                    <span>
                      <IconButton size="small" color="error" disabled={used > 0} onClick={() => onChange(params.filter((_, j) => j !== i))} aria-label="حذف سؤال">
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, sm: p.type === 2 ? 8 : 12 }}>
                <TextField
                  label="سؤالی که از کاربر پرسیده می‌شود"
                  size="small"
                  fullWidth
                  value={p.askPrompt}
                  onChange={(e) => update(i, { askPrompt: e.target.value })}
                  placeholder="مثلاً: از چه کسی خریدید؟"
                />
              </Grid>
              {p.type === 2 && (
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    select
                    label="گروه تفصیلی"
                    size="small"
                    fullWidth
                    value={p.detailGroupId ?? ''}
                    error={!p.detailGroupId}
                    onChange={(e) => update(i, { detailGroupId: e.target.value || null })}
                  >
                    {groups.map((g) => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}
                  </TextField>
                </Grid>
              )}
            </Grid>
            <PlacementLine places={placementsOf(model, p.key)} paramKey={p.key} />
          </Paper>
        );
      })}
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
        {([1, 2, 3, 4] as ParameterType[]).map((t) => (
          <Button key={t} size="small" startIcon={<AddCircleOutlineIcon />} onClick={() => onChange([...params, newParam(params, t)])}>
            سؤال {PARAM_TYPE_LABEL[t].split(' ')[0]}
          </Button>
        ))}
      </Stack>
      <Typography variant="caption" color="text.secondary">
        سؤال‌های تفصیلی را راحت‌تر از داخل ردیف‌ها با «+ سؤال جدید از کاربر» بسازید؛ گروهشان خودکار درست انتخاب می‌شود.
      </Typography>
    </Box>
  );
}

/** «در سند کجا می‌نشیند» — so a question that fills nothing is visible at a glance. */
function PlacementLine({ places, paramKey }: { places: string[]; paramKey: string }) {
  return places.length > 0 ? (
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
      در سند: {places.join('، ')}
    </Typography>
  ) : (
    <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.75 }}>
      پاسخ این سؤال در سند ننشسته است — {`{${paramKey}}`} را در «شرح سند» یا شرح ردیف بگذارید، یا برای مبلغ/تفصیلی به ردیفی وصلش کنید.
    </Typography>
  );
}
