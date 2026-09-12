import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, useRoutes } from 'react-router-dom';
import { queryClient } from './queryClient';
import { routes } from './routes';
import { AuthProvider } from '../lib/auth/AuthContext';
import { SessionProvider } from '../lib/session/SessionContext';
import { NotificationProvider } from '../lib/notifications/NotificationProvider';
import { Layout } from '../components/Layout';

function AppRoutes() {
  const element = useRoutes(routes);
  return <Layout>{element}</Layout>;
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
