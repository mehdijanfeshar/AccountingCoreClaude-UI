import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Backend (Accounting.Api) sets no CORS headers, so the dev server
      // proxies /api to make browser requests same-origin instead.
      '/api': {
        target: 'https://localhost:7155',
        changeOrigin: true,
        // Backend dev cert is typically self-signed/untrusted -> disable
        // TLS verification for the proxy only (dev-only setting).
        secure: false,
      },
    },
  },
});
