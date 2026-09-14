import { Fragment, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import Stack from '@mui/material/Stack';
import MenuIcon from '@mui/icons-material/Menu';
import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha, useTheme } from '@mui/material/styles';
import { useAuth } from '../lib/auth/AuthContext';
import { useSession } from '../lib/session/SessionContext';
import { NAV_GROUPS, type NavItem } from '../lib/navConfig';
import { SHELL } from '../theme';

const DRAWER_WIDTH = 260;

/** Persists which nav groups the user has collapsed, so the sidebar remembers it across visits. */
const NAV_COLLAPSE_STORAGE_KEY = 'accounting.nav.collapsedGroups';

function readCollapsedGroups(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(NAV_COLLAPSE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function writeCollapsedGroups(value: Record<string, boolean>) {
  try {
    window.localStorage.setItem(NAV_COLLAPSE_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore storage failures
  }
}

function NavListItem({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const location = useLocation();

  if (!item.to) {
    return (
      <Tooltip title="این بخش هنوز پیاده‌سازی نشده است" placement="left">
        <span>
          <ListItemButton disabled sx={{ pr: 4, opacity: 0.45, '&.Mui-disabled': { opacity: 0.45 } }}>
            <ListItemIcon sx={{ minWidth: 36, color: SHELL.muted }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} slotProps={{ primary: { sx: { color: SHELL.text } } }} />
            <Chip
              label="به‌زودی"
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: '0.65rem', color: SHELL.muted, borderColor: alpha(SHELL.text, 0.25) }}
            />
          </ListItemButton>
        </span>
      </Tooltip>
    );
  }

  const selected = location.pathname === item.to;

  return (
    <ListItemButton
      component={Link}
      to={item.to}
      selected={selected}
      onClick={onNavigate}
      sx={{
        pr: 4,
        position: 'relative',
        color: selected ? '#FFFFFF' : SHELL.text,
        '&:hover': { bgcolor: alpha('#FFFFFF', 0.06) },
        '&.Mui-selected': {
          bgcolor: alpha('#FFFFFF', 0.1),
          '&:hover': { bgcolor: alpha('#FFFFFF', 0.14) },
          // Gold rail on the inline-start edge — the one accent that marks "you are here".
          '&::before': {
            content: '""',
            position: 'absolute',
            insetInlineStart: 0,
            top: 8,
            bottom: 8,
            width: 3,
            borderRadius: 3,
            backgroundColor: (theme) => theme.palette.secondary.light,
          },
        },
      }}
    >
      <ListItemIcon sx={{ minWidth: 36, color: selected ? 'secondary.light' : SHELL.muted }}>
        {item.icon}
      </ListItemIcon>
      <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontWeight: selected ? 700 : 500 } } }} />
    </ListItemButton>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(readCollapsedGroups);

  // Whichever group holds the currently active route is always forced open — a collapsed
  // group must never hide the page the user is actually on.
  useEffect(() => {
    const activeGroup = NAV_GROUPS.find((group) => group.items.some((item) => item.to === location.pathname));
    if (activeGroup && collapsed[activeGroup.title]) {
      setCollapsed((prev) => {
        const next = { ...prev, [activeGroup.title]: false };
        writeCollapsedGroups(next);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  function toggleGroup(title: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [title]: !prev[title] };
      writeCollapsedGroups(next);
      return next;
    });
  }

  return (
    <List component="nav" aria-label="منوی اصلی" disablePadding>
      {NAV_GROUPS.map((group, groupIndex) => {
        const isOpen = !collapsed[group.title];
        return (
          <Fragment key={group.title}>
            {groupIndex > 0 && <Divider sx={{ my: 1, borderColor: alpha('#FFFFFF', 0.08) }} />}
            <ListItemButton
              onClick={() => toggleGroup(group.title)}
              sx={{ py: 0.75, color: SHELL.muted, '&:hover': { bgcolor: alpha('#FFFFFF', 0.05) } }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>{group.icon}</ListItemIcon>
              <ListItemText
                primary={group.title}
                slotProps={{
                  primary: { sx: { fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.08em' } },
                }}
              />
              {isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </ListItemButton>
            <Collapse in={isOpen} timeout="auto" unmountOnExit>
              {group.items.map((item) => (
                <NavListItem key={item.label} item={item} onNavigate={onNavigate} />
              ))}
            </Collapse>
          </Fragment>
        );
      })}
    </List>
  );
}

/** Dev-only helper to set the Bearer token by hand until a real login/IDP flow exists. */
function DevTokenBar() {
  const { isAuthenticated, setToken, signOut } = useAuth();
  const [draft, setDraft] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (trimmed) {
      // The api client always prepends "Bearer " itself (see lib/api/client.ts),
      // so strip one if the user pasted it along with the token to avoid a
      // doubled-up "Bearer Bearer <token>" header.
      const value = trimmed.replace(/^Bearer\s+/i, '');
      setToken(value);
      setDraft('');
    }
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        border: '1px dashed',
        borderColor: 'divider',
        borderRadius: 1,
        px: 1,
        py: 0.5,
      }}
    >
      <Chip label="DEV" size="small" color="warning" variant="outlined" />
      <Typography variant="caption" color="text.secondary" noWrap>
        {isAuthenticated ? 'توکن تنظیم شده' : 'بدون توکن (۴۰۱)'}
      </Typography>
      <TextField
        type="password"
        autoComplete="off"
        placeholder="توکن (بدون Bearer)"
        size="small"
        variant="standard"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-label="توکن Bearer برای توسعه"
        sx={{ width: 160 }}
      />
      <Button type="submit" size="small" variant="text">
        تنظیم
      </Button>
      {isAuthenticated && (
        <Button type="button" size="small" variant="text" color="inherit" onClick={signOut}>
          پاک کردن
        </Button>
      )}
    </Box>
  );
}

function YearSelector() {
  const { financialYear, setFinancialYear } = useSession();

  return (
    <TextField
      label="سال مالی"
      inputMode="numeric"
      placeholder="مثلاً ۱۴۰۳"
      size="small"
      variant="standard"
      value={financialYear}
      onChange={(e) => setFinancialYear(e.target.value)}
      sx={{ width: 110 }}
    />
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { hasUnauthorizedError, dismissUnauthorizedError } = useAuth();
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <a className="skip-link" href="#main-content">
        رفتن به محتوای اصلی
      </a>

      <AppBar position="sticky">
        <Box
          sx={{
            height: 3,
            backgroundImage: (theme) =>
              `linear-gradient(90deg, ${SHELL.main}, ${theme.palette.primary.main} 55%, ${theme.palette.secondary.main})`,
          }}
        />
        <Toolbar sx={{ gap: 2, flexWrap: 'wrap', py: 1 }}>
          {isSmallScreen && (
            <IconButton
              edge="start"
              aria-label="باز کردن منو"
              onClick={() => setMobileOpen((v) => !v)}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Stack
            component={Link}
            to="/"
            direction="row"
            spacing={1.25}
            sx={{ alignItems: 'center', textDecoration: 'none', color: 'inherit' }}
          >
            <Avatar
              variant="rounded"
              sx={{
                width: 36,
                height: 36,
                bgcolor: SHELL.main,
                color: 'secondary.light',
                boxShadow: (theme) => `inset 0 0 0 1px ${alpha(theme.palette.secondary.light, 0.35)}`,
              }}
            >
              <CalculateOutlinedIcon fontSize="small" />
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                سیستم حسابداری
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
                تأمین اجتماعی
              </Typography>
            </Box>
          </Stack>
          <Box sx={{ flexGrow: 1 }} />
          <YearSelector />
          <DevTokenBar />
        </Toolbar>
      </AppBar>

      <Collapse in={hasUnauthorizedError}>
        <Alert
          role="alert"
          severity="warning"
          onClose={dismissUnauthorizedError}
          sx={{ borderRadius: 0 }}
        >
          نشست شما معتبر نیست یا منقضی شده (۴۰۱). لطفاً توکن را دوباره تنظیم کنید.
        </Alert>
      </Collapse>

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {isSmallScreen ? (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              '& .MuiDrawer-paper': {
                width: DRAWER_WIDTH,
                backgroundColor: SHELL.main,
                color: SHELL.text,
                backgroundImage: 'none',
                borderInlineStart: 0,
              },
            }}
          >
            <Toolbar />
            <NavList onNavigate={() => setMobileOpen(false)} />
          </Drawer>
        ) : (
          <Drawer
            variant="permanent"
            sx={{
              width: DRAWER_WIDTH,
              flexShrink: 0,
              '& .MuiDrawer-paper': {
                width: DRAWER_WIDTH,
                position: 'relative',
                backgroundColor: SHELL.main,
                color: SHELL.text,
                backgroundImage: 'none',
                borderInlineStart: 0,
                paddingBlock: 8,
              },
            }}
          >
            <NavList />
          </Drawer>
        )}

        <Box component="main" id="main-content" sx={{ flex: 1, minWidth: 0, p: 3 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
