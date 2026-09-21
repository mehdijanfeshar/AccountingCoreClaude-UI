import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CacheProvider } from '@emotion/react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/600.css';
import '@fontsource/vazirmatn/700.css';
import { App } from './app/App';
import { theme } from './theme';
import { rtlCache } from './theme/rtlCache';
import { bootstrapAuth } from './lib/auth/authBootstrap';
import './tailwind.css';
import './index.css';

// Must resolve before the app renders: if the URL is the IDP redirecting
// back with a token in the hash, we want that token already in storage
// (and the hash already stripped) before AuthProvider/RequireAuth make
// their first authenticated/not-authenticated decision. See
// src/lib/auth/authBootstrap.ts for why there is no separate route for this.
void bootstrapAuth().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <CacheProvider value={rtlCache}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <App />
        </ThemeProvider>
      </CacheProvider>
    </StrictMode>,
  );
});
