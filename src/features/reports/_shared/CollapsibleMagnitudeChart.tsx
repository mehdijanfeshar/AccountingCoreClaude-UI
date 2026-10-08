import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';
import { MagnitudeBarList, type MagnitudeBarListProps } from './MagnitudeBarList';

/**
 * The "largest rows" chart, closed until asked for.
 *
 * Every report page used to open with this chart (and a debit/credit bar beside it) between the
 * tiles and the table. The table is the report; on a laptop the pair pushed it below the fold,
 * and the bar only restated the balance the tiles already give. One shared toggle, so the reports
 * behave the same way and the choice is made once.
 *
 * The chevron turns with a short ease-out; the panel uses MUI's height collapse, which is the one
 * place a height animation is worth its cost: it shows where the content came from.
 */
export function CollapsibleMagnitudeChart({ label, ...chart }: MagnitudeBarListProps & { label: string }) {
  const [open, setOpen] = useState(false);

  if (chart.items.length === 0) return null;

  return (
    <Box className="no-print" sx={{ mb: 2 }}>
      <Button
        variant="text"
        size="small"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        endIcon={
          <ExpandMoreOutlinedIcon
            sx={{
              transition: 'transform 200ms cubic-bezier(0.23, 1, 0.32, 1)',
              transform: open ? 'rotate(180deg)' : 'none',
            }}
          />
        }
        sx={{ color: 'text.secondary' }}
      >
        {open ? `بستن ${label}` : label}
      </Button>
      <Collapse in={open} unmountOnExit timeout={220}>
        <Box sx={{ mt: 1 }}>
          <MagnitudeBarList {...chart} />
        </Box>
      </Collapse>
    </Box>
  );
}
