import { Link } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Avatar from '@mui/material/Avatar';
import { NAV_GROUPS } from '../lib/navConfig';

export function HomePage() {
  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="h1" component="h1">
          سیستم حسابداری
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          یکی از گزینه‌های زیر یا منوی سمت راست را انتخاب کنید.
        </Typography>
      </Box>

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
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 14px rgba(16,24,40,0.10)',
                        borderColor: `${group.color}.main`,
                      },
                    }}
                  >
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                      <Avatar
                        variant="rounded"
                        sx={{
                          bgcolor: (theme) => `${theme.palette[group.color].main}1a`,
                          color: `${group.color}.main`,
                        }}
                      >
                        {item.icon}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700 }}>{item.label}</Typography>
                        {item.description && (
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {item.description}
                          </Typography>
                        )}
                      </Box>
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
