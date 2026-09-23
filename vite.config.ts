import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
      //
      // Currently pointed at the IIS deployment rather than a locally-run backend.
      //
      // ⚠️ `target` takes ONE host and ONE port. A value like
      // `http://172.16.15.65:8090:7155` is not a URL, and Vite answers every proxied
      // request with a bare **500 and an empty body** — which looks exactly like a
      // backend error but never reaches the backend at all. If /api starts returning
      // 500 with nothing in it, check this line before suspecting the API.
      //
      // Use the machine's LAN IP, not `localhost`: the IIS site is bound to
      // 172.16.15.65:8090, and `http://localhost:8090` answers 400 (host mismatch).
      //
      // To go back to a locally-run backend instead, use `https://localhost:7155`
      // (the `https` launch profile) and keep `secure: false` for its dev cert.
      '/api': {
        target: 'http://172.16.15.65:8090',
        changeOrigin: true,
        // Kept for the https://localhost:7155 case above, where the backend's dev
        // certificate is self-signed. Harmless over plain http.
        secure: false,
      },
    },
  },
});
