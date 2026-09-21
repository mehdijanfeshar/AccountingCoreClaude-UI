import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import { alpha } from '@mui/material/styles';

interface FormActionsProps {
  onCancel: () => void;
  pending?: boolean;
  /** Overrides the submit label — defaults to ذخیره / در حال ذخیره…. */
  submitLabel?: string;
  /** Number of invalid fields, if the caller tracks it — shown as a count, not a list. */
  errorCount?: number;
  /** Extra controls (e.g. «ذخیره و جدید») placed before the cancel button. */
  extra?: React.ReactNode;
}

/**
 * The submit/cancel row for a form, pinned to the bottom of the viewport.
 *
 * <b>Why sticky.</b> Several of these forms are taller than a laptop screen — صدور شناسنامه grows
 * a field per subgroup, and the voucher form grows per line. With the buttons at the end of the
 * document, saving meant scrolling past everything you just filled in, and on a long form people
 * genuinely lose the button. Pinned, the primary action is always one click away and the form
 * reads as an application rather than a web page.
 *
 * <b>The error count, not an error list.</b> When a submit fails validation the fields already
 * show their own messages; repeating them here would duplicate the same text twice on screen.
 * A count answers the one thing the field-level messages cannot — "how many more are there,
 * including the ones scrolled out of view".
 *
 * The submit button disables itself while pending and shows a spinner in place of its icon —
 * the skill's `loading-buttons` rule, which exists to stop double submission.
 */
export function FormActions({ onCancel, pending, submitLabel, errorCount, extra }: FormActionsProps) {
  const hasErrors = (errorCount ?? 0) > 0;

  return (
    <Box
      sx={{
        position: 'sticky',
        bottom: 0,
        zIndex: 2,
        mt: 4,
        // Pull the bar to the card's edges so it reads as a footer of the card rather than a
        // floating strip sitting on top of the last field.
        mx: -3,
        mb: -3,
        px: 3,
        py: 2,
        borderTop: 1,
        borderColor: 'divider',
        backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.92),
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        flexWrap: 'wrap',
      }}
    >
      {hasErrors && (
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', color: 'error.main' }}>
          <ErrorOutlineOutlinedIcon fontSize="small" />
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {errorCount} فیلد نیاز به اصلاح دارد
          </Typography>
        </Stack>
      )}

      <Box sx={{ flexGrow: 1 }} />

      {extra}

      <Button variant="text" onClick={onCancel} disabled={pending}>
        انصراف
      </Button>

      <Button
        type="submit"
        variant="contained"
        disabled={pending}
        startIcon={pending ? <CircularProgress size={16} color="inherit" /> : <SaveOutlinedIcon />}
      >
        {pending ? 'در حال ذخیره…' : (submitLabel ?? 'ذخیره')}
      </Button>
    </Box>
  );
}
