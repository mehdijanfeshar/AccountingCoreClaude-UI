import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

interface FormSectionLabelProps {
  label: string;
  caption?: ReactNode;
}

/** Centered overline-on-divider separator used to group related fields inside a longer form. */
export function FormSectionLabel({ label, caption }: FormSectionLabelProps) {
  return (
    <Box>
      <Divider sx={{ mb: caption ? 0.5 : 1.5 }}>
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
          {label}
        </Typography>
      </Divider>
      {caption && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          {caption}
        </Typography>
      )}
    </Box>
  );
}
