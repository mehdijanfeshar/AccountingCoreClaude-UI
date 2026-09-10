/**
 * Shape returned by every list ("GET /api/{resource}?pageNumber&pageSize")
 * endpoint in Accounting.Api. The backend has NO envelope
 * (`{ succeeded, code, messages, data }` from the old Angular project does
 * NOT apply here) — this is the raw, flat shape.
 */
export interface PagedResult<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
}
