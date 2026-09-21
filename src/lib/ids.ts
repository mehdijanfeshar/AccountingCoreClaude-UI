/**
 * A unique id for a client-side list row.
 *
 * <b>Why this is not just `crypto.randomUUID()`.</b> That function only exists in a secure
 * context — HTTPS, or `localhost`. Opened over plain HTTP on a LAN address, which is how this app
 * is reached during development (`http://172.16.15.65:4200`), it is simply not defined, and
 * calling it throws `TypeError: crypto.randomUUID is not a function`. The voucher form called it
 * while building its default values, so the whole page died before a single request went out —
 * a blank screen with no network activity to explain it.
 *
 * `crypto.getRandomValues`, unlike `randomUUID`, is available in insecure contexts too, so it is
 * the preferred path here. The final fallback exists only for environments that have no Web Crypto
 * at all.
 *
 * These ids never leave the browser: they key React list items and map a form row to the database
 * row it came from. Uniqueness within one page is the entire requirement — this is not a value
 * anything depends on being unguessable, and it must never be used as one.
 */
export function newClientId(): string {
  const cryptoApi = globalThis.crypto;

  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  if (typeof cryptoApi?.getRandomValues === 'function') {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));

    // RFC 4122 version and variant bits, so the value still reads as a UUID in logs and dev tools
    // rather than as an unexplained hex blob.
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // No Web Crypto at all. Weak, and deliberately last: good enough to keep row keys distinct,
  // which is all these ids are for.
  return `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
