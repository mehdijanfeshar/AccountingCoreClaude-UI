import Box from '@mui/material/Box';

/**
 * Identifier codes (account code, تفصیلی code, cheque number, ...) rendered in a monospace face
 * so digits line up column-wise and a 4-digit code is visually distinct from a 6-digit one at a
 * glance. Latin digits are deliberately kept — these are identifiers, not quantities.
 */
export function MonoCode({ value, muted }: { value: string | null | undefined; muted?: boolean }) {
  return (
    <Box
      component="span"
      sx={{
        fontFamily: 'monospace',
        fontSize: '0.9rem',
        fontWeight: 700,
        letterSpacing: '0.05em',
        color: muted ? 'text.secondary' : 'inherit',
      }}
    >
      {value || '—'}
    </Box>
  );
}
