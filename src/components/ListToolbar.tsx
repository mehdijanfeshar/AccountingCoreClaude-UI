import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';

interface ListToolbarProps {
  /** Omit both search props to use this purely as a summary/filter bar (e.g. a list with no client-side search). */
  search?: string;
  onSearchChange?: (value: string) => void;
  searchLabel?: string;
  /** Right-aligned summary line, e.g. "۳۴ ردیف" or "۳ نتیجه از ۳۴". */
  summary?: ReactNode;
  /** Extra filter controls rendered next to the search field (e.g. a fiscal-year picker). */
  children?: ReactNode;
}

/**
 * The search + summary bar that sits above every list table. Previously each list page
 * hand-rolled a bare `<TextField>` floating above the table with no row count and no
 * container — shared here so all of them read as one product instead of nine variations.
 */
export function ListToolbar({ search, onSearchChange, searchLabel = 'جستجو در همین صفحه', summary, children }: ListToolbarProps) {
  return (
    <Paper
      variant="outlined"
      sx={{ mb: 2, p: 1.5, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', borderRadius: 2 }}
    >
      {onSearchChange && (
        <TextField
          size="small"
          label={searchLabel}
          value={search ?? ''}
          onChange={(event) => onSearchChange(event.target.value)}
          sx={{ flexGrow: 1, maxWidth: 340 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlinedIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            },
          }}
        />
      )}
      {children}
      <Box sx={{ flexGrow: 1 }} />
      {summary && (
        <Typography variant="body2" color="text.secondary">
          {summary}
        </Typography>
      )}
    </Paper>
  );
}
