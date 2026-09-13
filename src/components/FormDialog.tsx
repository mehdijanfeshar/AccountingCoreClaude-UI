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
 * مشابه): icon + title + subtitle header with a close button, a divider, content, and a
 * divider-separated actions bar — replaces each feature hand-rolling its own
 * DialogTitle/DialogContent/button-row layout so all coding forms look and behave the same.
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
    <Dialog open={open} onClose={onClose} maxWidth={maxWidth} fullWidth aria-label={title}>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: 'center', justifyContent: 'space-between', pl: 1.5, pr: 3, py: 2 }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
          {icon && (
            <Avatar
              variant="rounded"
              sx={{
                width: 40,
                height: 40,
                flexShrink: 0,
                bgcolor: (theme) => `${theme.palette[accentColor].main}1a`,
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
        <DialogActions sx={{ px: 3, py: 2 }}>{actions}</DialogActions>
      </Box>
    </Dialog>
  );
}
