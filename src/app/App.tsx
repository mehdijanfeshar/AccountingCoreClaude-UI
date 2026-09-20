import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, useLocation, useRoutes } from 'react-router-dom';
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
      <Layout>{element}</Layout>
    </RequireAuth>
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
