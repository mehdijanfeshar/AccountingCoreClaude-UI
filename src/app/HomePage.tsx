import { Link } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import ChevronLeftOutlinedIcon from '@mui/icons-material/ChevronLeftOutlined';
import { NAV_GROUPS } from '../lib/navConfig';
import { useSession } from '../lib/session/SessionContext';
import { SHELL } from '../theme';
import { toPersianDigits } from '../lib/format/numbers';

export function HomePage() {
  const { financialYear } = useSession();

  return (
    <Stack spacing={4}>
      <Paper
        sx={{
          position: 'relative',
          overflow: 'hidden',
          p: { xs: 3, sm: 4 },
          color: SHELL.text,
          backgroundColor: SHELL.main,
          backgroundImage: (theme) =>
            `linear-gradient(120deg, ${SHELL.main} 0%, ${SHELL.soft} 60%, ${alpha(theme.palette.primary.dark, 0.9)} 100%)`,
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            insetInlineEnd: -40,
            top: -40,
            fontSize: 220,
            lineHeight: 0,
            color: (theme) => theme.palette.secondary.light,
            opacity: 0.07,
            pointerEvents: 'none',
            '& svg': { fontSize: 'inherit' },
          }}
        >
          <CalculateOutlinedIcon />
        </Box>
        <Stack spacing={1.5} sx={{ position: 'relative', maxWidth: 620 }}>
          <Typography variant="overline" sx={{ color: 'secondary.light' }}>
            سازمان تأمین اجتماعی
          </Typography>
          <Typography variant="h1" component="h1" sx={{ color: '#FFFFFF', fontSize: { xs: '1.6rem', sm: '2rem' } }}>
            سامانهٔ حسابداری متمرکز
          </Typography>
          <Typography variant="body2" sx={{ color: SHELL.muted }}>
            ثبت اسناد حسابداری، مدیریت کدینگ و تفصیلی‌ها، دریافت و پرداخت، و گزارش‌های مالی — همه در یک محیط واحد.
          </Typography>
          {financialYear && (
            <Box>
              <Chip
                icon={<EventOutlinedIcon />}
                label={`سال مالی ${toPersianDigits(financialYear)}`}
                size="small"
                sx={{
                  mt: 0.5,
                  color: SHELL.text,
                  bgcolor: alpha('#FFFFFF', 0.1),
                  '& .MuiChip-icon': { color: 'secondary.light' },
                }}
              />
            </Box>
          )}
        </Stack>
      </Paper>

      {NAV_GROUPS.map((group) => {
        const liveItems = group.items.filter((item) => item.to);
        if (liveItems.length === 0) return null;

        return (
          <Box key={group.title}>
            <Stack direction="row" spacing={1} sx={{ mb: 1.5, alignItems: 'center', color: `${group.color}.main` }}>
              {group.icon}
              <Typography variant="h2" component="h2" sx={{ color: 'text.primary' }}>
                {group.title}
              </Typography>
            </Stack>
            <Grid container spacing={2}>
              {liveItems.map((item) => (
                <Grid key={item.label} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Paper
                    component={Link}
                    to={item.to as string}
                    variant="outlined"
                    sx={{
                      display: 'block',
                      p: 2.5,
                      height: '100%',
                      textDecoration: 'none',
                      color: 'inherit',
                      // Stable hover: only colour/shadow change, never a transform that nudges
                      // the card out from under the pointer.
                      transition: 'box-shadow 180ms, border-color 180ms, background-color 180ms',
                      '&:hover': {
                        borderColor: `${group.color}.main`,
                        boxShadow: (theme) => `0 8px 24px -12px ${alpha(theme.palette[group.color].main, 0.55)}`,
                        '& .nav-card-chevron': { opacity: 1, transform: 'translateX(-3px)' },
                      },
                    }}
                  >
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                      <Avatar
                        variant="rounded"
                        sx={{
                          bgcolor: (theme) => alpha(theme.palette[group.color].main, 0.1),
                          color: `${group.color}.main`,
                        }}
                      >
                        {item.icon}
                      </Avatar>
                      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Typography sx={{ fontWeight: 700 }}>{item.label}</Typography>
                        {item.description && (
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {item.description}
                          </Typography>
                        )}
                      </Box>
                      <ChevronLeftOutlinedIcon
                        className="nav-card-chevron"
                        fontSize="small"
                        sx={{
                          color: `${group.color}.main`,
                          opacity: 0.35,
                          transition: 'opacity 180ms, transform 180ms',
                        }}
                      />
                    </Stack>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
        );
      })}
    </Stack>
  );
}
