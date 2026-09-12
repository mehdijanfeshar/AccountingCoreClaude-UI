import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import type { NavAccentColor } from '../lib/navConfig';

interface PageHeaderProps {
  /** Small label above the title (e.g. "اطلاعات پایه") for section orientation. */
  eyebrow?: string;
  /** Icon shown in a colored circular avatar next to the title (e.g. the page's nav icon). */
  icon?: ReactNode;
  accentColor?: NavAccentColor;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, icon, accentColor = 'primary', title, description, actions }: PageHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{
        mb: 3,
        justifyContent: 'space-between',
        alignItems: { xs: 'stretch', sm: 'flex-start' },
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
        {icon && (
          <Avatar
            variant="rounded"
            sx={{
              width: 44,
              height: 44,
              bgcolor: (theme) => `${theme.palette[accentColor].main}1a`,
              color: `${accentColor}.main`,
            }}
          >
            {icon}
          </Avatar>
        )}
        <Box>
          {eyebrow && (
            <Typography
              variant="overline"
              color={`${accentColor}.main`}
              sx={{ display: 'block', lineHeight: 1.4, fontWeight: 700 }}
            >
              {eyebrow}
            </Typography>
          )}
          <Typography variant="h1" component="h1">
            {title}
          </Typography>
          {description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {description}
            </Typography>
          )}
        </Box>
      </Stack>
      {actions && <Box>{actions}</Box>}
    </Stack>
  );
}
