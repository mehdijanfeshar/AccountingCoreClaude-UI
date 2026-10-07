import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // The /api proxy target is per-machine, so it lives in `.env.development.local`
  // (git-ignored), never in this shared file. See `.env.example`.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'https://localhost:7155';

  return {
    plugins: [react()],
    server: {
      // Fixed at 4200 on purpose: the organization's IDP (account-pilot.tamin.ir)
      // only issues tokens for pre-registered redirect_uri values, and
      // http://localhost:4200 is already registered for our client_id. Do not
      // change this without registering the new URL with the IDP first.
      port: 4200,
      strictPort: true,
      // Bind to all interfaces so the dev server is reachable from other machines on the LAN.
      // Dev-only: this exposes both the app and — through the /api proxy below — the backend
      // to anyone on the same network.
      host: true,
      proxy: {
        // The dev server proxies /api so browser requests stay same-origin (the backend only
        // sends CORS headers for origins listed in its `Cors:AllowedOrigins`).
        //
        // ⚠️ `target` takes ONE host and ONE port. A value like
        // `http://172.16.15.65:8090:7155` is not a URL, and Vite answers every proxied
        // request with a bare **500 and an empty body** — which looks exactly like a
        // backend error but never reaches the backend at all. If /api starts returning
        // 500 with nothing in it, check VITE_API_PROXY_TARGET before suspecting the API.
        //
        // For an IIS deployment use the machine's LAN IP, not `localhost`: an IIS site bound
        // to a specific IP answers `localhost` with 400 (host mismatch).
        //
        // Default (`https://localhost:7155`) is the backend's `https` launch profile.
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          // The local backend's dev certificate is self-signed. Harmless over plain http.
          secure: false,
        },
      },
    },
  };
});
