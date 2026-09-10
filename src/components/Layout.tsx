import { Fragment, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListSubheader from '@mui/material/ListSubheader';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import MenuIcon from '@mui/icons-material/Menu';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '../lib/auth/AuthContext';
import { useSession } from '../lib/session/SessionContext';

/**
 * Three top-level groups, carried over from the old Angular app's page
 * structure (pages/base, pages/operation, pages/report). Routes not built
 * yet are rendered as disabled "به‌زودی" (coming soon) entries rather than
 * dead links.
 *
 * Adding a new page = adding one `{ label, to }` entry to the relevant
 * group below (or turning an existing label-only placeholder into one).
 */
interface NavItem {
  label: string;
  to?: string;
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'اطلاعات پایه',
    items: [
      { label: 'کدینگ حسابداری', to: '/base/account-codes' },
      { label: 'گروه تفصیلی' },
      { label: 'بانک' },
      { label: 'هزینه' },
      { label: 'تنخواه' },
      { label: 'ویژگی' },
      { label: 'کارگاه' },
      { label: 'سال مالی' },
    ],
  },
  {
    title: 'عملیات',
    items: [
      { label: 'اسناد حسابداری', to: '/operation/voucher-heads' },
      { label: 'صدور سند (تفصیلی داینامیک)', to: '/operation/vouchers/new' },
      { label: 'دریافت و پرداخت' },
      { label: 'کارتابل' },
      { label: 'دسته‌چک' },
    ],
  },
  {
    title: 'گزارش‌ها',
    items: [
      { label: 'تراز آزمایشی' },
      { label: 'دفتر کل' },
      { label: 'دفتر روزنامه' },
      { label: 'مرور حساب‌ها' },
      { label: 'ترازنامه' },
      { label: 'گزارش ماتریسی' },
    ],
  },
];

const DRAWER_WIDTH = 240;

function NavListItem({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const location = useLocation();

  if (!item.to) {
    return (
      <ListItemButton disabled sx={{ pr: 4 }}>
        <ListItemText primary={item.label} secondary="(به‌زودی)" />
      </ListItemButton>
    );
  }

  return (
    <ListItemButton
      component={Link}
      to={item.to}
      selected={location.pathname === item.to}
      onClick={onNavigate}
      sx={{ pr: 4 }}
    >
      <ListItemText primary={item.label} />
    </ListItemButton>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <List component="nav" aria-label="منوی اصلی" disablePadding>
      {NAV_GROUPS.map((group) => (
        <Fragment key={group.title}>
          <ListSubheader component="div">{group.title}</ListSubheader>
          {group.items.map((item) => (
            <NavListItem key={item.label} item={item} onNavigate={onNavigate} />
          ))}
        </Fragment>
      ))}
    </List>
  );
}

/** Dev-only helper to set the Bearer token by hand until a real login/IDP flow exists. */
function DevTokenBar() {
  const { isAuthenticated, setToken, signOut } = useAuth();
  const [draft, setDraft] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (draft.trim()) {
      setToken(draft.trim());
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
        placeholder="Bearer token"
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
          <Typography
            component={Link}
            to="/"
            variant="h6"
            sx={{ textDecoration: 'none', color: 'inherit', fontWeight: 700 }}
          >
            سیستم حسابداری
          </Typography>
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
            sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
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
              '& .MuiDrawer-paper': { width: DRAWER_WIDTH, position: 'relative' },
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
