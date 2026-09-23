import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import ChevronLeftOutlinedIcon from '@mui/icons-material/ChevronLeftOutlined';
import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';

/** Horizontal step per depth level, in px. */
export const INDENT_STEP = 22;

export interface TreeRowProps {
  depth: number;
  /** Whether this row has children (controls the disclosure arrow). */
  hasChildren: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  checked: boolean;
  indeterminate?: boolean;
  /** A row with nothing selectable under it gets an inert, dimmed checkbox. */
  disabled?: boolean;
  onToggleChecked: (checked: boolean) => void;
  ariaLabel: string;
  children: ReactNode;
}

/**
 * One row of a checkbox tree, shared by the معین and نوع واحد pickers.
 *
 * <b>Why this exists as its own component.</b> Both trees originally inlined their own row markup
 * and both got the same two things wrong, which is what the project owner saw on screen:
 *
 * <ol>
 *   <li><b>The code and the name ran together</b> ("testetstest01"). The culprit was a physical
 *       margin (<c>mr</c>) on the label: this app pipes MUI's CSS through
 *       <c>stylis-plugin-rtl</c>, which flips <c>margin-right</c> to <c>margin-left</c>, so the
 *       gap landed on the far side of the text instead of between the two. Spacing here is done
 *       with the flex <c>gap</c> of the row, which is direction-agnostic and cannot flip.</li>
 *   <li><b>Depth was invisible.</b> Indentation alone does not read as hierarchy once rows wrap or
 *       labels vary in length. Each level now also draws a vertical rail on the row's start edge
 *       (<c>borderInlineStart</c> — a logical property, so it is the right edge in RTL and the
 *       left edge in LTR without any flipping plugin involved).</li>
 * </ol>
 *
 * The whole row is a click target, not just the checkbox: a parent row toggles open/closed and a
 * selectable row toggles its checkbox. With ~150 account rows, hitting a 20px checkbox for each
 * one is the difference between usable and not.
 */
export function TreeRow({
  depth,
  hasChildren,
  expanded,
  onToggleExpanded,
  checked,
  indeterminate = false,
  disabled = false,
  onToggleChecked,
  ariaLabel,
  children,
}: TreeRowProps) {
  function handleRowClick() {
    // A parent that cannot itself be selected behaves as a disclosure; anything selectable
    // toggles. This keeps one predictable meaning per row rather than two competing ones.
    if (disabled && hasChildren) {
      onToggleExpanded();
      return;
    }
    if (!disabled) {
      onToggleChecked(!checked);
    }
  }

  return (
    <Stack
      direction="row"
      onClick={handleRowClick}
      sx={{
        alignItems: 'center',
        gap: 0.75,
        minHeight: 32,
        borderRadius: 1,
        cursor: disabled && !hasChildren ? 'default' : 'pointer',
        // Logical property: the start edge is the RIGHT edge under dir="rtl". Using `borderLeft`
        // here would be flipped by stylis-plugin-rtl and land on the wrong side.
        marginInlineStart: `${depth * INDENT_STEP}px`,
        borderInlineStart: depth > 0 ? '1px solid' : 'none',
        borderColor: 'divider',
        paddingInlineStart: depth > 0 ? 1 : 0,
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      {hasChildren ? (
        <IconButton
          size="small"
          aria-label={expanded ? 'بستن' : 'باز کردن'}
          onClick={(event) => {
            // Without this the row's own handler would fire too and undo the toggle.
            event.stopPropagation();
            onToggleExpanded();
          }}
          sx={{ p: 0.25 }}
        >
          {expanded ? (
            <ExpandMoreOutlinedIcon fontSize="small" />
          ) : (
            <ChevronLeftOutlinedIcon fontSize="small" />
          )}
        </IconButton>
      ) : (
        // Keeps labels on the same vertical line whether or not a row has an arrow.
        <Box sx={{ width: 26, flexShrink: 0 }} />
      )}

      <Checkbox
        size="small"
        checked={checked}
        indeterminate={indeterminate}
        disabled={disabled}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => onToggleChecked(event.target.checked)}
        slotProps={{ input: { 'aria-label': ariaLabel } }}
        sx={{ p: 0.5 }}
      />

      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, minWidth: 0, flexGrow: 1 }}>
        {children}
      </Stack>
    </Stack>
  );
}
