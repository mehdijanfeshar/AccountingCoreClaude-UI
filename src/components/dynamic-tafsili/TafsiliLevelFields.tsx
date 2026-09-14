import { useEffect } from 'react';
import { useQueries } from '@tanstack/react-query';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import { useTafsiliLevels } from './useTafsiliLevels';
import { TafsiliItemSelect, type TafsiliSelection } from './TafsiliItemSelect';
import { FormSectionLabel } from '../FormSectionLabel';
import { ErrorBanner } from '../ErrorBanner';
import { tafsilisApi } from '../../features/tafsilis/api';

export interface TafsiliLinkValue {
  levelId: string;
  tafsiliId: string;
  /** Display label; absent for links loaded from the API, which returns ids only. */
  label?: string;
}

interface TafsiliLevelFieldsProps {
  /** The معین whose active levels drive these fields. `null` renders nothing. */
  accountCodeId: string | null;
  value: TafsiliLinkValue[];
  onChange: (value: TafsiliLinkValue[]) => void;
  /** Heading shown above the fields; omit to render them without a section header. */
  sectionLabel?: string;
}

/**
 * Renders one تفصیلی picker per active level of the given معین — the same mechanism the voucher
 * entry form uses, extracted so any record that points at a معین (حساب بانکی، هزینه، تنخواه، ...)
 * can carry تفصیلی assignments too.
 *
 * Renders nothing at all when the معین has no active levels, so forms can include it
 * unconditionally without leaving an empty section behind.
 *
 * Stored links arrive from the API as `{levelId, tafsiliId}` with no label (the write DTO has no
 * room for one), so labels for already-saved values are resolved here with one small
 * `GET /api/tafsilis/{id}` per link — at most the number of active levels (≤ 7), and only on an
 * edit form's first render.
 */
export function TafsiliLevelFields({ accountCodeId, value, onChange, sectionLabel }: TafsiliLevelFieldsProps) {
  // All 7 levels are rendered inline here: unlike a voucher line row, a base-info form has room
  // for them, so the 1-3 / 4-7 inline-vs-modal split the voucher entry uses is unnecessary.
  const { allLevels, isLoading, error } = useTafsiliLevels(accountCodeId);

  const missingLabelIds = value.filter((link) => !link.label).map((link) => link.tafsiliId);
  const labelQueries = useQueries({
    queries: missingLabelIds.map((id) => ({
      queryKey: ['tafsilis', id],
      queryFn: () => tafsilisApi.getById(id),
      staleTime: 5 * 60 * 1000,
    })),
  });

  // Fold resolved labels back into the caller's value so the pickers show a name rather than a
  // blank box for links that were loaded from the API.
  useEffect(() => {
    const resolved = new Map<string, string>();
    labelQueries.forEach((query) => {
      const dto = query.data;
      if (dto) {
        resolved.set(dto.id, `${dto.tafsiliCode ?? ''} - ${dto.tafsiliName ?? ''}`);
      }
    });
    if (resolved.size === 0) return;

    const next = value.map((link) =>
      link.label || !resolved.has(link.tafsiliId) ? link : { ...link, label: resolved.get(link.tafsiliId) },
    );
    if (next.some((link, index) => link !== value[index])) {
      onChange(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelQueries.map((q) => q.data?.id).join(','), value]);

  if (!accountCodeId) return null;
  if (isLoading) return null;
  if (error) return <ErrorBanner error={error} />;
  if (allLevels.length === 0) return null;

  function selectionFor(levelId: string): TafsiliSelection | null {
    const link = value.find((item) => item.levelId === levelId);
    return link ? { levelId, tafsiliId: link.tafsiliId, label: link.label ?? '' } : null;
  }

  function handleChange(levelId: string, selection: TafsiliSelection | null) {
    const without = value.filter((item) => item.levelId !== levelId);
    onChange(selection ? [...without, { levelId, tafsiliId: selection.tafsiliId, label: selection.label }] : without);
  }

  return (
    <>
      {sectionLabel && (
        <Grid size={12}>
          <FormSectionLabel
            label={sectionLabel}
            caption="این سطوح از روی حساب معین انتخاب‌شده تعیین می‌شوند؛ با تغییر معین، دوباره محاسبه می‌شوند."
          />
        </Grid>
      )}
      {allLevels.map((level) => (
        <Grid key={level.levelId} size={{ xs: 12, sm: 6 }}>
          <TafsiliItemSelect
            accountCodeId={accountCodeId as string}
            level={level}
            value={selectionFor(level.levelId)}
            onChange={(selection) => handleChange(level.levelId, selection)}
          />
        </Grid>
      ))}
      <Grid size={12}>
        <Alert severity="info" variant="outlined" sx={{ py: 0.5 }}>
          <Typography variant="caption">
            اگر معین را عوض کنید، تفصیلی‌های انتخاب‌شده به سطوح معین جدید تعلق نخواهند داشت و باید دوباره انتخاب شوند.
          </Typography>
        </Alert>
      </Grid>
    </>
  );
}
