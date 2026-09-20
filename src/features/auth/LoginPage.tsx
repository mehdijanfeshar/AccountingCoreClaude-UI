import { Navigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined';
import { useAuth } from '../../lib/auth/AuthContext';
import { getRedirectPath } from '../../lib/auth/tokenStore';
import { SHELL } from '../../theme';

/**
 * There is no username/password form here on purpose: the organization has
 * no in-app credential form — the actual sign-in happens on the IDP's own
 * page (account-pilot.tamin.ir) after this button redirects there. See
 * src/lib/auth/oauth.ts.
 */
export function LoginPage() {
  const { isAuthenticated, login } = useAuth();

  if (isAuthenticated) {
    // Already signed in (e.g. user navigated to /login by hand) — send them
    // back into the app instead of showing this page for no reason.
    return <Navigate to="/" replace />;
  }

  function handleLogin() {
    const returnTo = getRedirectPath() ?? undefined;
    login(returnTo);
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        backgroundColor: SHELL.main,
        backgroundImage: (theme) =>
          `linear-gradient(120deg, ${SHELL.main} 0%, ${SHELL.soft} 60%, ${theme.palette.primary.dark} 100%)`,
      }}
    >
      <Paper
        elevation={6}
        sx={{ p: { xs: 3, sm: 5 }, maxWidth: 420, width: '100%', textAlign: 'center', borderRadius: 3 }}
      >
        <Stack spacing={3} sx={{ alignItems: 'center' }}>
          <Avatar
            variant="rounded"
            sx={{ width: 56, height: 56, bgcolor: SHELL.main, color: 'secondary.light' }}
          >
            <CalculateOutlinedIcon />
          </Avatar>

          <Stack spacing={0.5}>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
              سامانهٔ حسابداری متمرکز
            </Typography>
            <Typography variant="body2" color="text.secondary">
              سازمان تأمین اجتماعی
            </Typography>
          </Stack>

          <Typography variant="body2" color="text.secondary">
            برای ورود به سامانه، از حساب کاربری سازمانی خود استفاده کنید. نام کاربری و رمز عبور در
            همین صفحه وارد نمی‌شود؛ پس از کلیک، به صفحهٔ ورود سازمان منتقل خواهید شد.
          </Typography>

          <Button
            variant="contained"
            size="large"
            fullWidth
            startIcon={<LoginOutlinedIcon />}
            onClick={handleLogin}
          >
            ورود با حساب سازمانی
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
