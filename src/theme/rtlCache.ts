import createCache from '@emotion/cache';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';

/**
 * Emotion cache that runs MUI's generated CSS through `stylis-plugin-rtl`
 * before it hits the DOM. This is what actually flips logical-looking but
 * physical properties (`margin-left`, `padding-right`, `left`, text-align,
 * flex-direction, etc.) that MUI's `sx`/`styled` output still contains —
 * `dir="rtl"` on <html> alone only affects native block/inline flow and
 * text direction, not these physical CSS properties.
 *
 * Must be provided via `<CacheProvider value={rtlCache}>` wrapping
 * `<ThemeProvider>` in `main.tsx`.
 */
export const rtlCache = createCache({
  key: 'muirtl',
  stylisPlugins: [prefixer, rtlPlugin],
});
