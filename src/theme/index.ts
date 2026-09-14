import { alpha, createTheme } from '@mui/material/styles';
import { faIR } from '@mui/material/locale';

/**
 * Single app-wide theme.
 *
 * Palette/typography direction comes from the `ui-ux-pro-max` skill's reasoning row for
 * **Banking/Traditional Finance** (`.claude/skills/ui-ux-pro-max/data/`): pattern "Trust &
 * Authority", style "Minimalism + Accessible & Ethical", colors "Trust navy + premium gold",
 * typography "Professional + Trustworthy". Its listed anti-patterns are deliberately avoided:
 * no playful shapes, no purple/pink gradients.
 *
 * The navy (`SHELL`) is the app frame — sidebar and brand — not `primary.main`, because a
 * near-black primary turns every button and link black. `primary` stays a readable deep blue
 * and `secondary` carries the gold accent.
 *
 * `faIR` translates MUI's built-in component strings (e.g. TablePagination's "Rows per page")
 * to Persian; it does NOT set direction or fonts, both done explicitly below.
 */

/** Dark navy used for the app shell (sidebar, brand mark). Skill palette row 44, "Primary". */
export const SHELL = {
  main: '#0F172A',
  soft: '#1B2942',
  text: '#E2E8F0',
  muted: '#94A3B8',
};

const BORDER = '#E2E8F0';

export const theme = createTheme(
  {
    direction: 'rtl',
    palette: {
      mode: 'light',
      primary: { main: '#1E3A8A', light: '#3B5BB5', dark: '#172554' },
      // Premium gold — the skill's CTA/accent for this product type.
      secondary: { main: '#B58108', light: '#CA8A04', dark: '#854D0E' },
      success: { main: '#15803D' },
      warning: { main: '#B45309' },
      error: { main: '#B91C1C' },
      background: { default: '#F5F7FA', paper: '#FFFFFF' },
      text: { primary: '#0F172A', secondary: '#475569' },
      divider: BORDER,
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: ['Vazirmatn', 'Tahoma', 'Segoe UI', 'system-ui', 'sans-serif'].join(','),
      // A real scale, not just h1/h2 — undifferentiated type is what made every page read flat.
      h1: { fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.35 },
      h2: { fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.4 },
      h3: { fontSize: '1.125rem', fontWeight: 700, lineHeight: 1.45 },
      h4: { fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.5 },
      h5: { fontSize: '1rem', fontWeight: 700, lineHeight: 1.5 },
      h6: { fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.5 },
      subtitle1: { fontSize: '0.95rem', fontWeight: 600 },
      subtitle2: { fontSize: '0.85rem', fontWeight: 600 },
      body1: { fontSize: '0.95rem', lineHeight: 1.7 },
      body2: { fontSize: '0.875rem', lineHeight: 1.7 },
      caption: { fontSize: '0.75rem', lineHeight: 1.6 },
      overline: { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', lineHeight: 1.6 },
      // Persian text must never be uppercased — the transform does nothing useful and breaks
      // the rhythm of mixed Latin/Persian button labels.
      button: { fontSize: '0.875rem', fontWeight: 600, textTransform: 'none' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '*::-webkit-scrollbar': { width: 10, height: 10 },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor: '#CBD5E1',
            borderRadius: 8,
            border: '2px solid transparent',
            backgroundClip: 'content-box',
          },
          '*::-webkit-scrollbar-thumb:hover': { backgroundColor: '#94A3B8' },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 8, paddingInline: 16, transition: 'background-color 180ms, border-color 180ms, color 180ms' },
          contained: {
            boxShadow: `0 1px 2px ${alpha('#0F172A', 0.18)}`,
            '&:hover': { boxShadow: `0 2px 6px ${alpha('#0F172A', 0.22)}` },
          },
        },
      },
      MuiAppBar: {
        defaultProps: { color: 'inherit', elevation: 0 },
        styleOverrides: {
          root: { backgroundColor: '#FFFFFF', borderBottom: `1px solid ${BORDER}` },
        },
      },
      MuiPaper: {
        styleOverrides: {
          outlined: {
            borderColor: BORDER,
            boxShadow: `0 1px 2px ${alpha('#0F172A', 0.04)}, 0 8px 24px -12px ${alpha('#0F172A', 0.12)}`,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottomColor: BORDER },
          head: {
            fontWeight: 700,
            fontSize: '0.8rem',
            color: '#334155',
            backgroundColor: '#F1F5F9',
            whiteSpace: 'nowrap',
          },
          body: { fontSize: '0.875rem' },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background-color 150ms',
            '&:last-of-type td': { borderBottom: 0 },
          },
          hover: { '&:hover': { backgroundColor: '#F8FAFC' } },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: '#FFFFFF',
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#94A3B8' },
          },
        },
      },
      MuiAlert: {
        styleOverrides: { root: { alignItems: 'center', borderRadius: 10 } },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            marginInline: 8,
            marginBlock: 2,
            transition: 'background-color 150ms, color 150ms',
          },
        },
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 600 } },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { backgroundColor: SHELL.main, fontSize: '0.75rem', paddingBlock: 6, paddingInline: 10 },
          arrow: { color: SHELL.main },
        },
      },
    },
  },
  faIR,
);
