import type { FormEventHandler, ReactNode } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import type { NavAccentColor } from '../lib/navConfig';

interface FormDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  accentColor?: NavAccentColor;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg';
  onSubmit: FormEventHandler;
  actions: ReactNode;
  children: ReactNode;
}

/**
 * Shared dialog shell for every add/edit form rendered as a Dialog (کدینگ حسابداری تب‌ها و
 * مشابه): accent strip, tinted header with icon + title + subtitle and a close button, the form
 * body, then a tinted action bar. Matches `FormCard`'s treatment so a record edited in a dialog
 * and the same record edited on its own page read as the same product.
 */
export function FormDialog({
  open,
  onClose,
  title,
  subtitle,
  icon,
  accentColor = 'primary',
  maxWidth = 'md',
  onSubmit,
  actions,
  children,
}: FormDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth
      aria-label={title}
      slotProps={{ paper: { sx: { overflow: 'hidden' } } }}
    >
      <Box sx={{ height: 3, bgcolor: `${accentColor}.main` }} />
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          pl: 1.5,
          pr: 3,
          py: 2,
          bgcolor: (theme) => alpha(theme.palette[accentColor].main, 0.04),
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
          {icon && (
            <Avatar
              variant="rounded"
              sx={{
                width: 40,
                height: 40,
                flexShrink: 0,
                bgcolor: (theme) => alpha(theme.palette[accentColor].main, 0.12),
                color: `${accentColor}.main`,
              }}
            >
              {icon}
            </Avatar>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.3 }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
        </Stack>
        <IconButton onClick={onClose} size="small" aria-label="بستن">
          <CloseOutlinedIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Divider />
      <Box component="form" onSubmit={onSubmit} noValidate>
        <DialogContent sx={{ pt: 3 }}>{children}</DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, bgcolor: 'action.hover' }}>{actions}</DialogActions>
      </Box>
    </Dialog>
  );
}
