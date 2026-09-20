import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, useLocation, useRoutes } from 'react-router-dom';
import * as motion from 'motion/react-client';
import { useReducedMotion } from 'motion/react';
import { queryClient } from './queryClient';
import { routes, PUBLIC_PATHS } from './routes';
import { AuthProvider } from '../lib/auth/AuthContext';
import { RequireAuth } from '../lib/auth/RequireAuth';
import { SessionProvider } from '../lib/session/SessionContext';
import { NotificationProvider } from '../lib/notifications/NotificationProvider';
import { Layout } from '../components/Layout';

function AppRoutes() {
  const location = useLocation();
  const element = useRoutes(routes);

  // /login has no Layout/nav shell (it's the pre-auth entry point) and must
  // never itself be behind RequireAuth, or a signed-out user could never
  // reach the button that starts the SSO redirect.
  if (PUBLIC_PATHS.has(location.pathname)) {
    return element;
  }

  return (
    <RequireAuth>
      <Layout>
        <PageTransition routeKey={location.pathname}>{element}</PageTransition>
      </Layout>
    </RequireAuth>
  );
}

/**
 * A short fade-and-rise on route change, so a navigation reads as the page being replaced rather
 * than the content blinking.
 *
 * <b>Deliberately minimal.</b> The skill's rule 12 warns that animation used as decoration is
 * distraction; on an operator tool someone uses all day, anything longer or larger than this
 * starts costing time on every single navigation. 8px over 180ms is enough to be perceived and
 * short enough never to be waited on.
 *
 * `prefers-reduced-motion` removes it entirely rather than shortening it — the point of that
 * setting is no movement at all (skill rule `reduced-motion`).
 */
function PageTransition({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  return (
    <motion.div
      key={routeKey}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SessionProvider>
          <NotificationProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </NotificationProvider>
        </SessionProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
