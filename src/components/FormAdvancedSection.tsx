import type { ReactNode } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';

interface FormAdvancedSectionProps {
  label: string;
  caption?: ReactNode;
  children: ReactNode;
}

/**
 * Collapsed-by-default container for the Legacy flag columns every base-info form carries
 * (`typeCode`, `typeActivity`, `Owner`, ...). Their business meaning is still unconfirmed, so
 * they must stay editable — but left expanded they dominate a form whose genuinely meaningful
 * fields are only a code, a name and a parent. Collapsing them puts the common case first
 * without hiding anything from the users who do need them.
 */
export function FormAdvancedSection({ label, caption, children }: FormAdvancedSectionProps) {
  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'action.hover',
        '&::before': { display: 'none' },
        '&.Mui-expanded': { margin: 0 },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 48 }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
          <TuneOutlinedIcon fontSize="small" color="action" />
          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{label}</Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        {caption && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            {caption}
          </Typography>
        )}
        {children}
      </AccordionDetails>
    </Accordion>
  );
}
