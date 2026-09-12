import { alpha, createTheme } from '@mui/material/styles';
import { faIR } from '@mui/material/locale';

/**
 * Single app-wide theme. Deliberately simple — see task brief ("پیچیده
 * نکن"). `faIR` translates MUI's built-in component strings (e.g.
 * TablePagination's "Rows per page" / "of") to Persian; it does NOT set
 * direction or fonts, both done explicitly below.
 */
export const theme = createTheme(
  {
    direction: 'rtl',
    palette: {
      mode: 'light',
      primary: { main: '#0b5ed7' },
      secondary: { main: '#2e7d32' },
      error: { main: '#c62828' },
      background: { default: '#f5f6f8', paper: '#ffffff' },
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: ['Vazirmatn', 'Tahoma', 'Segoe UI', 'system-ui', 'sans-serif'].join(','),
      h1: { fontSize: '1.5rem', fontWeight: 700 },
      h2: { fontSize: '1.1rem', fontWeight: 700 },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: 8, fontWeight: 600 } },
      },
      MuiAppBar: {
        defaultProps: { color: 'inherit', elevation: 0 },
        styleOverrides: { root: { borderBottom: '1px solid rgba(0,0,0,0.08)' } },
      },
      MuiPaper: {
        styleOverrides: {
          outlined: {
            borderColor: 'rgba(16,24,40,0.08)',
            boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 700,
            backgroundColor: alpha('#0b5ed7', 0.06),
          },
        },
      },
      MuiAlert: {
        styleOverrides: { root: { alignItems: 'center' } },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            marginInline: 8,
            marginBlock: 1,
          },
        },
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 600 } },
      },
    },
  },
  faIR,
);
