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
      //
      // Headings carry a very slight negative tracking. At 700 weight Vazirmatn's default spacing
      // reads a touch loose for a title, and tightening it is what makes a heading look *set*
      // rather than merely bigger. Body text is left alone: tightening running Persian text hurts
      // it, because the connected forms already supply the rhythm.
      h1: { fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.35, letterSpacing: '-0.012em' },
      h2: { fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.4, letterSpacing: '-0.01em' },
      h3: { fontSize: '1.125rem', fontWeight: 700, lineHeight: 1.45, letterSpacing: '-0.008em' },
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
            fontSize: '0.78rem',
            color: '#475569',
            backgroundColor: '#F4F7FA',
            whiteSpace: 'nowrap',
            // Headers are labels, not data. Letting them sit slightly wider and quieter than the
            // body separates the two without needing a heavier rule between them.
            letterSpacing: '0.02em',
          },
          body: {
            fontSize: '0.875rem',
            // The single biggest legibility win in an accounting grid: tabular figures give every
            // digit the same advance width, so amounts and voucher numbers line up as columns and
            // a wrong order of magnitude is visible by shape alone. Proportional digits (the
            // default) let ۱ sit narrower than ۸ and the column edge wander.
            fontVariantNumeric: 'tabular-nums lining-nums',
          },
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
      /*
       * Inputs carry most of a form's visual weight, so they get the most attention here.
       *
       * They sit on a tinted ground rather than plain white: against an outlined white card a
       * white field has only its 1px border to say "you can type here", and a column of them
       * reads as ruled lines. The tint makes each field legible as a target at a glance, and it
       * goes fully white on focus so the active field is unmistakable.
       */
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: '#F8FAFC',
            transition: 'background-color 160ms, box-shadow 160ms',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: BORDER },
            '&:hover': { backgroundColor: '#F1F5F9' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#94A3B8' },
            '&.Mui-focused': {
              backgroundColor: '#FFFFFF',
              // A soft ring rather than only a thicker border — the field lifts off the card
              // instead of just darkening, which is far easier to track while tabbing.
              boxShadow: `0 0 0 3px ${alpha('#1E3A8A', 0.12)}`,
            },
            '&.Mui-disabled': { backgroundColor: '#F1F5F9' },
            '&.Mui-error.Mui-focused': { boxShadow: `0 0 0 3px ${alpha('#B91C1C', 0.12)}` },
          },
          input: {
            // Accounting forms are mostly numbers; lining tabular figures keep digits aligned
            // and stop `۱` from sitting narrower than `۸`.
            fontVariantNumeric: 'tabular-nums lining-nums',
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: { fontWeight: 500, '&.Mui-focused': { fontWeight: 600 } },
          // Required fields are marked by colour and weight, not the pale asterisk MUI renders
          // by default, which disappears in a dense form.
          asterisk: { color: '#B91C1C', fontWeight: 700 },
        },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: { marginInlineStart: 2, marginTop: 5, fontSize: '0.72rem', lineHeight: 1.6 },
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
      /*
       * Status badges — وضعیت سند, «تکراری», «واحد شما», «به‌زودی».
       *
       * MUI's filled chips are solid, fully-saturated blocks. In a dense accounting grid a column
       * of them reads as a stripe of loud colour that pulls the eye off the numbers, and
       * white-on-mid-green/amber sits near the contrast floor at this size.
       *
       * These are tonal instead: a pale wash of the hue, with the dark end of the same hue for the
       * text. The state stays instantly readable by colour, contrast is far higher than
       * white-on-fill, and the badge stops competing with the data. The hairline border is what
       * keeps a pale chip from dissolving into a hovered row.
       */
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            borderRadius: 7,
            // Chips live inside table rows; MUI's default 32px forces the row taller than its text.
            height: 24,
            letterSpacing: 0,
            border: '1px solid transparent',
            '& .MuiChip-label': { paddingInline: 9 },

            // Neutral (یادداشت) is styled deliberately rather than left as MUI's grey default, so
            // "no strong signal yet" reads as a considered state, not a missing one.
            '&.MuiChip-filled': { backgroundColor: '#F1F5F9', color: '#334155', borderColor: '#DDE5EE' },
            '&.MuiChip-colorPrimary.MuiChip-filled': {
              backgroundColor: '#E8EDFB', color: '#1E3A8A', borderColor: '#CCD8F4',
            },
            '&.MuiChip-colorSecondary.MuiChip-filled': {
              backgroundColor: '#FBF3DF', color: '#7A4A0B', borderColor: '#F2E0B4',
            },
            '&.MuiChip-colorSuccess.MuiChip-filled': {
              backgroundColor: '#E4F6E9', color: '#166534', borderColor: '#C3E9CE',
            },
            '&.MuiChip-colorWarning.MuiChip-filled': {
              backgroundColor: '#FDF0DB', color: '#92400E', borderColor: '#F6DDB4',
            },
            '&.MuiChip-colorInfo.MuiChip-filled': {
              backgroundColor: '#E3EDFC', color: '#1E40AF', borderColor: '#C6D9F7',
            },
            '&.MuiChip-colorError.MuiChip-filled': {
              backgroundColor: '#FCE7E7', color: '#991B1B', borderColor: '#F6C9C9',
            },
          },
          sizeSmall: { height: 22, fontSize: '0.72rem' },
        },
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
