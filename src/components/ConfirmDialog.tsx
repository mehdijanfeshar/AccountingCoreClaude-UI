import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import { ErrorBanner } from './ErrorBanner';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: 'error' | 'primary';
  pending?: boolean;
  /**
   * خطای همین عمل (مثلاً ۴۰۹ «به دلیل گردش مالی امکان حذف نیست») — داخل خود دیالوگ نشان داده می‌شود. بیرون
   * دیالوگ، پشت پس‌زمینهٔ تیره دیده نمی‌شد و کاربر فقط می‌دید که «حذف» کاری نکرد.
   */
  error?: unknown;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Generic yes/no confirmation dialog — used before every destructive (soft-delete) action. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'تأیید',
  cancelLabel = 'انصراف',
  confirmColor = 'error',
  pending = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const hasError = error !== undefined && error !== null;
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      {(description || hasError) && (
        <DialogContent>
          {description && <DialogContentText>{description}</DialogContentText>}
          {hasError && (
            <Box sx={{ mt: description ? 2 : 0 }}>
              <ErrorBanner error={error} />
            </Box>
          )}
        </DialogContent>
      )}
      <DialogActions>
        <Button onClick={onCancel} color="inherit" disabled={pending}>
          {hasError ? 'بستن' : cancelLabel}
        </Button>
        <Button onClick={onConfirm} color={confirmColor} variant="contained" disabled={pending} autoFocus={!hasError}>
          {pending ? 'در حال انجام...' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
