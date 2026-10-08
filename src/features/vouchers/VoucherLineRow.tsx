import { useEffect, useState, type KeyboardEvent } from 'react';
import { Controller, useWatch, type UseFormReturn } from 'react-hook-form';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import Skeleton from '@mui/material/Skeleton';
import InputAdornment from '@mui/material/InputAdornment';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import ListAltIcon from '@mui/icons-material/ListAlt';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import { AccountCodePickerDialog } from '../../components/AccountCodePickerDialog';
import { AmountField } from '../../components/AmountField';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useTafsiliLevels } from '../../components/dynamic-tafsili/useTafsiliLevels';
import { TafsiliItemSelect, type TafsiliSelection } from '../../components/dynamic-tafsili/TafsiliItemSelect';
import type { AccountCodeDto } from '../../types/accountCode';
import type { TafsiliLevelDto } from '../../types/tafsili';
import type { VoucherEntryFormSchema } from './voucherEntrySchema';
import { VoucherLineCheque } from './VoucherLineCheque';
import { VoucherLineExtras } from './VoucherLineExtras';
import { needsCheque } from './lineExtras';

interface VoucherLineRowProps {
  form: UseFormReturn<VoucherEntryFormSchema>;
  index: number;
  rowKey: string;
  onRemove: () => void;
  onActiveLevelsChange: (rowKey: string, levels: TafsiliLevelDto[]) => void;
  canRemove: boolean;
  /** Briefly highlighted when jumped to from the "ویرایش" action in the summary table below. */
  highlighted?: boolean;
  /** «ثبت ردیف» — validates this row and moves to the next (Enter in the amount fields too). */
  onConfirm?: () => void;
}

/**
 * One row of the voucher entry form's `lines` `useFieldArray`. Owns:
 *  - the معین (account) picker (reuses the shared `AccountCodePickerDialog` — no raw guid
 *    entry, matching the chart-of-accounts form);
 *  - the dynamic تفصیلی fields for whichever levels are active for the CURRENTLY selected
 *    معین (`useTafsiliLevels`) — levels 1-3 inline, 4-7 behind a "لیست تفصیلی‌ها" modal,
 *    adapted from the old Angular `add-voucher` layout;
 *  - reporting its active levels up to `VoucherEntryPage` (via `onActiveLevelsChange`) so the
 *    dynamic Zod schema can validate them (see `voucherEntrySchema.ts`).
 *
 * Selecting a different معین clears every previously selected تفصیلی value for this row
 * (never shows a stale field from the old معین) — see the `onSelectAccount` handler below.
 */
export function VoucherLineRow({
  form,
  index,
  rowKey,
  onRemove,
  onActiveLevelsChange,
  canRemove,
  highlighted = false,
  onConfirm,
}: VoucherLineRowProps) {
  const { control, setValue, formState } = form;
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const accountId = useWatch({ control, name: `lines.${index}.accountId` });
  const accountLabel = useWatch({ control, name: `lines.${index}.accountLabel` });
  const tafsili = useWatch({ control, name: `lines.${index}.tafsili` }) ?? {};
  const tafsiliLabels = useWatch({ control, name: `lines.${index}.tafsiliLabels` }) ?? {};
  const extrasReq = useWatch({ control, name: `lines.${index}.extrasReq` });
  const creditor = useWatch({ control, name: `lines.${index}.creditor` });
  const checkId = useWatch({ control, name: `lines.${index}.checkId` });
  const soriCheckBookId = useWatch({ control, name: `lines.${index}.soriCheckBookId` });
  const [chequeOpenRequest, setChequeOpenRequest] = useState(0);

  /** برداشت از حساب بانکی که هنوز چک ندارد: فرم انتخاب چک باز می‌شود (چک اجباری است). */
  function askForChequeIfMissing(): boolean {
    if (!needsCheque({ extrasReq, creditor }) || checkId || soriCheckBookId) return false;
    setChequeOpenRequest((n) => n + 1);
    return true;
  }

  const { inlineLevels, modalLevels, allLevels, isLoading, error: levelsError } = useTafsiliLevels(accountId || null);

  useEffect(() => {
    onActiveLevelsChange(rowKey, allLevels);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowKey, allLevels]);

  const lineErrors = formState.errors.lines?.[index];
  // `tafsili` is a dynamic Record<string, string> field — RHF's FieldErrors type doesn't
  // know its keys statically, so this reads it through a loosened type on purpose.
  const tafsiliErrors = lineErrors?.tafsili as Record<string, { message?: string } | undefined> | undefined;
  function tafsiliErrorMessage(levelId: string): string | undefined {
    return tafsiliErrors?.[levelId]?.message;
  }

  function onSelectAccount(account: AccountCodeDto) {
    // shouldValidate: clears «انتخاب حساب معین الزامی است» left over from an earlier submit attempt.
    setValue(`lines.${index}.accountId`, account.id, { shouldDirty: true, shouldValidate: true });
    setValue(`lines.${index}.accountLabel`, `${account.accCode ?? ''} - ${account.accCodeName ?? ''}`, {
      shouldDirty: true,
    });
    // Selecting a different معین invalidates every previously selected تفصیلی value.
    setValue(`lines.${index}.tafsili`, {}, { shouldDirty: true });
    setValue(`lines.${index}.tafsiliLabels`, {}, { shouldDirty: true });
    // شناسه/ویژگی مال حساب قبلی بود.
    setValue(`lines.${index}.attributes`, {}, { shouldDirty: true });
    setValue(`lines.${index}.identities`, {}, { shouldDirty: true });
  }

  function onTafsiliChange(selection: TafsiliSelection | null) {
    const nextTafsili = { ...tafsili };
    const nextLabels = { ...tafsiliLabels };
    if (selection) {
      nextTafsili[selection.levelId] = selection.tafsiliId;
      nextLabels[selection.levelId] = selection.label;
    } else {
      return;
    }
    setValue(`lines.${index}.tafsili`, nextTafsili, { shouldDirty: true, shouldValidate: true });
    setValue(`lines.${index}.tafsiliLabels`, nextLabels, { shouldDirty: true });
  }

  function levelSelection(level: TafsiliLevelDto): TafsiliSelection | null {
    const tafsiliId = tafsili[level.levelId];
    if (!tafsiliId) return null;
    return { levelId: level.levelId, tafsiliId, label: tafsiliLabels[level.levelId] ?? '' };
  }

  // Enter در بدهکار/بستانکار = «ثبت ردیف».
  function confirmOnEnter(e: KeyboardEvent) {
    if (e.key === 'Enter' && onConfirm) {
      e.preventDefault();
      if (askForChequeIfMissing()) return;
      onConfirm();
    }
  }

  return (
    <Paper
      id={`voucher-line-${rowKey}`}
      variant="outlined"
      sx={{
        p: { xs: 2, sm: 3 },
        pt: { xs: 1.5, sm: 2 },
        mb: 4,
        scrollMarginTop: 96,
        // The row being entered is the form's one accented surface: everything else on the page
        // stays neutral so the eye lands here.
        borderInlineStart: (theme) => `3px solid ${theme.palette.secondary.main}`,
        transition: 'box-shadow 0.3s ease',
        boxShadow: highlighted ? (theme) => `0 0 0 3px ${theme.palette.secondary.light}` : undefined,
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="subtitle1" component="h3">
          ردیف {(index + 1).toLocaleString('fa-IR')}
        </Typography>
        <Tooltip title="حذف ردیف">
          <span>
            <IconButton aria-label="حذف ردیف" size="small" color="error" onClick={onRemove} disabled={!canRemove}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          {/* The whole field opens the picker: a read-only box next to a separate «انتخاب» button
              read as two controls for one value, and clicking the box itself did nothing. */}
          <TextField
            label="حساب معین"
            fullWidth
            required
            value={accountLabel ?? ''}
            placeholder="برای انتخاب کلیک کنید"
            error={!!lineErrors?.accountId}
            helperText={lineErrors?.accountId?.message}
            onClick={() => setAccountPickerOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setAccountPickerOpen(true);
              }
            }}
            slotProps={{
              input: {
                readOnly: true,
                sx: { cursor: 'pointer', '& input': { cursor: 'pointer' } },
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton aria-label="انتخاب حساب معین" edge="end" size="small" tabIndex={-1}>
                      <SearchOutlinedIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
        </Grid>

        {accountId && isLoading && (
          <>
            {[0, 1].map((i) => (
              <Grid key={i} size={{ xs: 12, sm: 4 }}>
                <Skeleton variant="rounded" height={56} aria-label="در حال دریافت سطوح تفصیلی" />
              </Grid>
            ))}
          </>
        )}

        {accountId && !isLoading && !!levelsError && (
          <Grid size={12}>
            <ErrorBanner error={levelsError} />
          </Grid>
        )}

        {accountId && !isLoading && !levelsError && allLevels.length === 0 && (
          <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              این حساب تفصیلی ندارد.
            </Typography>
          </Grid>
        )}

        {accountId &&
          inlineLevels.map((level) => (
            // Keyed on (accountId, levelId), not just levelId: TB_LEVEL_TAFSIL rows may be
            // shared/global definitions reused across different معین accounts (the domain
            // isn't guaranteed to hand out a fresh levelId per account). Without the
            // accountId in the key, switching معین to another account that happens to reuse
            // the same levelId would reuse this component instance and its stale internal
            // `inputValue` state instead of remounting fresh.
            <Grid key={`${accountId}-${level.levelId}`} size={{ xs: 12, sm: 4 }}>
              <TafsiliItemSelect
                accountCodeId={accountId}
                level={level}
                value={levelSelection(level)}
                onChange={onTafsiliChange}
                error={tafsiliErrorMessage(level.levelId)}
              />
            </Grid>
          ))}

        {accountId && modalLevels.length > 0 && (
          <Grid size={{ xs: 12, sm: 4 }} sx={{ display: 'flex', alignItems: 'center' }}>
            <Button
              variant="outlined"
              size="small"
              color={modalLevels.some((l) => !tafsili[l.levelId]) ? 'warning' : 'inherit'}
              startIcon={<ListAltIcon />}
              onClick={() => setModalOpen(true)}
            >
              لیست تفصیلی‌ها ({modalLevels.filter((l) => tafsili[l.levelId]).length}/{modalLevels.length})
            </Button>
          </Grid>
        )}

        <Grid size={{ xs: 12, sm: 6 }}>
          <Controller
            control={control}
            name={`lines.${index}.description`}
            render={({ field }) => (
              <TextField
                {...field}
                label="شرح"
                fullWidth
                slotProps={{ htmlInput: { maxLength: 200 } }}
                error={!!lineErrors?.description}
                helperText={lineErrors?.description?.message}
              />
            )}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }} onKeyDown={confirmOnEnter}>
          <AmountField control={control} name={`lines.${index}.debtor`} label="بدهکار" />
        </Grid>
        {/* Leaving the amount (not each keystroke) opens the cheque picker, so typing is never interrupted. */}
        <Grid size={{ xs: 6, sm: 3 }} onKeyDown={confirmOnEnter} onBlur={() => askForChequeIfMissing()}>
          <AmountField control={control} name={`lines.${index}.creditor`} label="بستانکار" />
        </Grid>

        <VoucherLineCheque form={form} index={index} openRequest={chequeOpenRequest} />

        <VoucherLineExtras form={form} index={index} />
      </Grid>

      {onConfirm && (
        <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'flex-end', alignItems: 'center', mt: 2.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
            Enter در بدهکار یا بستانکار هم ردیف را ثبت می‌کند.
          </Typography>
          <Button variant="contained" color="secondary" startIcon={<CheckCircleOutlineIcon />} onClick={() => { if (!askForChequeIfMissing()) onConfirm(); }}>
            ثبت ردیف
          </Button>
        </Stack>
      )}

      <AccountCodePickerDialog
        open={accountPickerOpen}
        title="انتخاب حساب معین"
        onClose={() => setAccountPickerOpen(false)}
        onSelect={onSelectAccount}
      />

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>لیست تفصیلی‌ها (سطح ۴ به بالا)</DialogTitle>
        <DialogContent>
          {modalLevels.length === 0 ? (
            <Typography color="text.secondary">سطح تفصیلی بیشتری وجود ندارد.</Typography>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              {accountId &&
                modalLevels.map((level) => (
                  <TafsiliItemSelect
                    key={`${accountId}-${level.levelId}`}
                    accountCodeId={accountId}
                    level={level}
                    value={levelSelection(level)}
                    onChange={onTafsiliChange}
                    error={tafsiliErrorMessage(level.levelId)}
                  />
                ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)}>بستن</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
