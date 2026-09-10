import { createTheme } from '@mui/material/styles';
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
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: ['Vazirmatn', 'Tahoma', 'Segoe UI', 'system-ui', 'sans-serif'].join(','),
      h1: { fontSize: '1.5rem', fontWeight: 700 },
      h2: { fontSize: '1.1rem', fontWeight: 700 },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: 8 } },
      },
      MuiAppBar: {
        defaultProps: { color: 'inherit', elevation: 0 },
        styleOverrides: { root: { borderBottom: '1px solid rgba(0,0,0,0.08)' } },
      },
      MuiTableCell: {
        styleOverrides: { head: { fontWeight: 600, backgroundColor: '#f5f6f8' } },
      },
      MuiAlert: {
        styleOverrides: { root: { alignItems: 'center' } },
      },
    },
  },
  faIR,
);
