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
        overflow: 'hidden',
        p: 3,
        borderTop: 4,
        borderTopColor: `${accentColor}.main`,
      }}
    >
      {watermarkIcon && (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            insetInlineEnd: -18,
            top: -18,
            fontSize: 150,
            lineHeight: 0,
            color: `${accentColor}.main`,
            opacity: 0.05,
            pointerEvents: 'none',
            '& svg': { fontSize: 'inherit' },
          }}
        >
          {watermarkIcon}
        </Box>
      )}
      <Box sx={{ position: 'relative' }}>{children}</Box>
    </Paper>
  );
}
