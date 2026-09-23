import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ErrorBanner } from '../../components/ErrorBanner';
import { MonoCode } from '../../components/MonoCode';
import { toPersianDigits } from '../../lib/format/numbers';
import { vahedTypesApi } from './api';
import { groupVahedTypesBySection } from '../../types/vahedType';
import { TreeRow } from './TreeRow';

export interface VahedTypeCheckTreeProps {
  /** Selected unit-type ids. Controlled. */
  value: string[];
  onChange: (ids: string[]) => void;
}

/**
 * The «نوع واحد سازمانی» picker of «افزودن دسترسی جدید»: a two-level checkbox tree of
 * «بخش» → «نوع واحد».
 *
 * It is deliberately NOT a tree of individual units. `TB_WHITEANDBLACKLIST` grants a معین to a
 * unit **type**, organization-wide — see `types/codingPermission.ts`. Ticking a بخش ticks every
 * type under it.
 *
 * <b>Sections are rendered as headers, not as ordinary rows.</b> The first version used a plain
 * `subtitle2` inline with its children, and on screen «ستاد» was indistinguishable from the types
 * beneath it — the two levels looked like one flat list. A section now carries a tinted band and
 * its children sit on an indented rail, so the grouping is visible before you read a word.
 *
 * ⚠️ The بخش names are an inference, not a lookup — see `VAHED_SECTION_LABELS` for the evidence
 * and for the fallback used when an unrecognized bucket appears.
 */
export function VahedTypeCheckTree({ value, onChange }: VahedTypeCheckTreeProps) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const query = useQuery({
    queryKey: ['vahed-types'],
    queryFn: () => vahedTypesApi.list(),
    // A fixed organizational lookup: it changes when the organization itself gains a new kind of
    // unit, which is not something to re-fetch on every dialog open.
    staleTime: 30 * 60 * 1000,
  });

  const sections = useMemo(() => groupVahedTypesBySection(query.data ?? []), [query.data]);
  const selected = useMemo(() => new Set(value), [value]);
  const total = query.data?.length ?? 0;

  function toggleMany(ids: readonly string[], checked: boolean) {
    const next = new Set(selected);
    for (const id of ids) {
      if (checked) next.add(id);
      else next.delete(id);
    }
    onChange([...next]);
  }

  function toggleCollapsed(key: string) {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <Stack spacing={1}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="caption" color="text.secondary">
          {toPersianDigits(selected.size)} از {toPersianDigits(total)} نوع واحد انتخاب شده
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        {total > 0 && (
          <Button
            size="small"
            color="inherit"
            onClick={() => onChange(selected.size === total ? [] : (query.data ?? []).map((t) => t.id))}
          >
            {selected.size === total ? 'پاک کردن انتخاب' : 'انتخاب همه'}
          </Button>
        )}
      </Stack>

      {query.isError && <ErrorBanner error={query.error} />}

      <Box
        sx={{
          maxHeight: 340,
          overflowY: 'auto',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          p: 1,
        }}
      >
        {query.isLoading && (
          <Stack spacing={1}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} height={28} />
            ))}
          </Stack>
        )}

        {!query.isLoading && sections.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
            هیچ نوع واحدی یافت نشد.
          </Typography>
        )}

        {sections.map((section) => {
          const key = section.parentTypeCode || 'none';
          const ids = section.types.map((type) => type.id);
          const selectedCount = ids.filter((id) => selected.has(id)).length;
          const isChecked = ids.length > 0 && selectedCount === ids.length;
          const isPartial = selectedCount > 0 && !isChecked;
          const isOpen = !collapsed.has(key);

          return (
            <Box key={key} sx={{ mb: 0.5 }}>
              {/* The tinted band is what separates a section from its members at a glance. */}
              <Box sx={{ bgcolor: 'action.hover', borderRadius: 1 }}>
                <TreeRow
                  depth={0}
                  hasChildren={section.types.length > 0}
                  expanded={isOpen}
                  onToggleExpanded={() => toggleCollapsed(key)}
                  checked={isChecked}
                  indeterminate={isPartial}
                  onToggleChecked={(checked) => toggleMany(ids, checked)}
                  ariaLabel={section.label}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {section.label}
                  </Typography>
                  <Chip
                    size="small"
                    variant={selectedCount > 0 ? 'filled' : 'outlined'}
                    color={selectedCount > 0 ? 'primary' : 'default'}
                    label={`${toPersianDigits(selectedCount)} از ${toPersianDigits(ids.length)}`}
                    sx={{ height: 18, fontSize: '0.68rem', flexShrink: 0 }}
                  />
                </TreeRow>
              </Box>

              <Collapse in={isOpen} unmountOnExit>
                {section.types.map((type) => (
                  <TreeRow
                    key={type.id}
                    depth={1}
                    hasChildren={false}
                    expanded={false}
                    onToggleExpanded={() => undefined}
                    checked={selected.has(type.id)}
                    onToggleChecked={(checked) => toggleMany([type.id], checked)}
                    ariaLabel={type.typeName ?? ''}
                  >
                    <MonoCode value={type.typeCode} muted />
                    <Typography variant="body2" noWrap title={type.typeName ?? undefined}>
                      {type.typeName ?? '—'}
                    </Typography>
                  </TreeRow>
                ))}
              </Collapse>
            </Box>
          );
        })}
      </Box>
    </Stack>
  );
}
