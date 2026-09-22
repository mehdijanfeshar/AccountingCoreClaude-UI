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
        // A named stack, not the bare `monospace` keyword. That keyword resolves to the browser's
        // default fixed font — on Windows, Courier New: thin, dated, and visibly smaller on the
        // line than the Vazirmatn text beside it. Consolas ships with every Windows install and is
        // what makes these codes look deliberate; the rest cover macOS and Linux.
        fontFamily: '"Cascadia Mono", Consolas, "SF Mono", Menlo, "DejaVu Sans Mono", monospace',
        fontSize: '0.86rem',
        fontWeight: 600,
        // Monospace already fixes the advance width, so the wide tracking this used to carry only
        // made codes look stretched. A hair is enough to keep long digit runs from blurring.
        letterSpacing: '0.02em',
        fontVariantNumeric: 'tabular-nums lining-nums',
        color: muted ? 'text.secondary' : 'inherit',
      }}
    >
      {value || '—'}
    </Box>
  );
}
