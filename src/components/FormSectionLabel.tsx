import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { NavAccentColor } from '../lib/navConfig';

interface FormSectionLabelProps {
  label: string;
  caption?: ReactNode;
  accentColor?: NavAccentColor;
}

/**
 * Section header inside a longer form: a short accent bar, the label, then a rule running to the
 * end of the row. Start-aligned rather than centered — a centered label reads as decoration and
 * is harder to scan down a column of fields than one anchored to the text edge.
 */
export function FormSectionLabel({ label, caption, accentColor = 'primary' }: FormSectionLabelProps) {
  return (
    <Box>
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mb: caption ? 0.5 : 1.5 }}>
        <Box sx={{ width: 3, height: 16, borderRadius: 2, bgcolor: `${accentColor}.main`, flexShrink: 0 }} />
        <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.6 }}>
          {label}
        </Typography>
        <Divider sx={{ flexGrow: 1 }} />
      </Stack>
      {caption && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          {caption}
        </Typography>
      )}
    </Box>
  );
}
