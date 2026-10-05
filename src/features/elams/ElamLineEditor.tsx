import { useState } from 'react';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { AccountCodePickerDialog } from '../../components/AccountCodePickerDialog';
import { useTafsiliLevels } from '../../components/dynamic-tafsili/useTafsiliLevels';
import { TafsiliItemSelect, type TafsiliSelection } from '../../components/dynamic-tafsili/TafsiliItemSelect';
import { formatThousands, normalizeNumericInput, toPersianDigits } from '../../lib/format/numbers';

export interface ElamLine {
  key: string;
  accountId: string;
  accountLabel: string;
  /** ارقام لاتین، بدون جداکننده. */
  amount: string;
  description: string;
  attribNo: string;
  /** levelId → انتخاب. */
  tafsili: Record<string, TafsiliSelection>;
}

export function newLine(): ElamLine {
  return {
    key: crypto.randomUUID(),
    accountId: '',
    accountLabel: '',
    amount: '',
    description: '',
    attribNo: '',
    tafsili: {},
  };
}

interface Props {
  index: number;
  line: ElamLine;
  onChange: (line: ElamLine) => void;
  onRemove?: () => void;
  /** درآمد: شناسه ندارد. */
  hideAttrib?: boolean;
  disabled?: boolean;
}

/** یک ردیف اعلامیه: معین، تفصیلی‌های سطوح فعال آن معین، مبلغ، شرح و شناسه. */
export function ElamLineEditor({ index, line, onChange, onRemove, hideAttrib, disabled }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const { allLevels, isLoading } = useTafsiliLevels(line.accountId || null);

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          ردیف {toPersianDigits(index + 1)}
        </Typography>
        {onRemove && !disabled && (
          <Tooltip title="حذف ردیف">
            <IconButton size="small" color="error" onClick={onRemove}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <TextField
            fullWidth
            size="small"
            required
            label="معین"
            value={line.accountLabel}
            onClick={() => !disabled && setPickerOpen(true)}
            disabled={disabled}
            slotProps={{
              input: {
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <SearchOutlinedIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            fullWidth
            size="small"
            required
            label="مبلغ"
            value={line.amount ? toPersianDigits(formatThousands(line.amount)) : ''}
            onChange={(e) => onChange({ ...line, amount: normalizeNumericInput(e.target.value).replace(/[.-]/g, '') })}
            disabled={disabled}
            slotProps={{ htmlInput: { inputMode: 'numeric', dir: 'ltr' } }}
          />
        </Grid>
        {!hideAttrib && (
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              size="small"
              label="شناسه"
              helperText="برای معین‌های شناسه‌دار"
              value={line.attribNo}
              onChange={(e) => onChange({ ...line, attribNo: e.target.value.slice(0, 10) })}
              disabled={disabled}
            />
          </Grid>
        )}
        {line.accountId &&
          allLevels.map((level) => (
            <Grid key={`${line.accountId}-${level.levelId}`} size={{ xs: 12, sm: 6, md: 4 }}>
              <TafsiliItemSelect
                accountCodeId={line.accountId}
                level={level}
                value={line.tafsili[level.levelId] ?? null}
                disabled={disabled}
                onChange={(value) => {
                  const next = { ...line.tafsili };
                  if (value) next[level.levelId] = value;
                  else delete next[level.levelId];
                  onChange({ ...line, tafsili: next });
                }}
              />
            </Grid>
          ))}
        {line.accountId && !isLoading && allLevels.length === 0 && (
          <Grid size={12}>
            <Typography variant="caption" color="text.secondary">
              این معین سطح تفصیلی ندارد.
            </Typography>
          </Grid>
        )}
        <Grid size={12}>
          <TextField
            fullWidth
            size="small"
            label="شرح ردیف"
            value={line.description}
            onChange={(e) => onChange({ ...line, description: e.target.value })}
            disabled={disabled}
          />
        </Grid>
      </Grid>

      <AccountCodePickerDialog
        open={pickerOpen}
        title="انتخاب حساب معین"
        onClose={() => setPickerOpen(false)}
        onSelect={(account) => {
          setPickerOpen(false);
          onChange({
            ...line,
            accountId: account.id,
            accountLabel: `${account.accCode ?? ''} - ${account.accCodeName ?? ''}`,
            tafsili: {},
          });
        }}
      />
    </Paper>
  );
}
