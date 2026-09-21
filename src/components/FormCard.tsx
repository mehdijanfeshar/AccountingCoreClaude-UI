import type { FormEventHandler, ReactNode } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import type { NavAccentColor } from '../lib/navConfig';

interface FormCardProps {
  accentColor?: NavAccentColor;
  /**
   * Large, low-opacity icon shown in the card's far corner — purely decorative. Gives each
   * entity's form its own visual identity instead of every form being an identical bare white
   * rectangle distinguished only by its field labels.
   */
  watermarkIcon?: ReactNode;
  onSubmit: FormEventHandler;
  children: ReactNode;
}

/** Outlined form card with a colored top accent strip matching the page's section (see `navConfig`). */
export function FormCard({ accentColor = 'primary', watermarkIcon, onSubmit, children }: FormCardProps) {
  return (
    <Paper
      component="form"
      variant="outlined"
      onSubmit={onSubmit}
      noValidate
      sx={{
        position: 'relative',
        // `visible`, not `hidden`: the sticky FormActions footer is a child of this card and is
        // pulled to its edges with negative margins. `overflow: hidden` clips it and, worse,
        // makes `position: sticky` stop working entirely inside the card.
        overflow: 'visible',
        p: 3,
        borderTop: 4,
        borderTopColor: `${accentColor}.main`,
      }}
    >
      {watermarkIcon && (
        // Its own clipping layer, because the card itself can no longer use `overflow: hidden`
        // (that would break the sticky footer). Inset by the border width so the clip lines up
        // with the card's rounded corners instead of cutting across them.
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            borderRadius: 'inherit',
            pointerEvents: 'none',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              insetInlineEnd: -18,
              top: -18,
              fontSize: 150,
              lineHeight: 0,
              color: `${accentColor}.main`,
              opacity: 0.05,
              '& svg': { fontSize: 'inherit' },
            }}
          >
            {watermarkIcon}
          </Box>
        </Box>
      )}
      <Box sx={{ position: 'relative' }}>{children}</Box>
    </Paper>
  );
}
