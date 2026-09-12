import type { FormEventHandler, ReactNode } from 'react';
import Paper from '@mui/material/Paper';
import type { NavAccentColor } from '../lib/navConfig';

interface FormCardProps {
  accentColor?: NavAccentColor;
  onSubmit: FormEventHandler;
  children: ReactNode;
}

/** Outlined form card with a colored top accent strip matching the page's section (see `navConfig`). */
export function FormCard({ accentColor = 'primary', onSubmit, children }: FormCardProps) {
  return (
    <Paper
      component="form"
      variant="outlined"
      onSubmit={onSubmit}
      noValidate
      sx={{
        p: 3,
        borderTop: 4,
        borderTopColor: `${accentColor}.main`,
      }}
    >
      {children}
    </Paper>
  );
}
