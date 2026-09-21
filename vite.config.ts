import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Fixed at 4200 on purpose: the organization's IDP (account-pilot.tamin.ir)
    // only issues tokens for pre-registered redirect_uri values, and
    // http://localhost:4200 is already registered for our client_id. Do not
    // change this without registering the new URL with the IDP first.
    port: 4200,
    strictPort: true,
    // Bind to all interfaces so the dev server is reachable from other machines on the LAN
    // (e.g. http://172.16.15.65:4200). Dev-only: this exposes both the app and — through the
    // /api proxy below — the backend to anyone on the same network.
    host: true,
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
