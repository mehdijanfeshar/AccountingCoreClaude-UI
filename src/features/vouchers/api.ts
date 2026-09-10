import { createResourceApi, type ListParams } from '../../lib/api/createResourceApi';
import type { VoucherHeadDto } from '../../types/voucherHead';

/**
 * ⚠️ No `vahedCode` here on purpose — GET /api/voucher-heads does not (and
 * must not) accept it; the backend derives the organizational unit scope
 * server-side from the caller's token (VahedScopeBehavior, phase 19).
 */
export interface VoucherHeadListParams extends ListParams {
  year?: string;
}

export const voucherHeadsApi = createResourceApi<VoucherHeadDto, Partial<VoucherHeadDto>, Partial<VoucherHeadDto>, VoucherHeadListParams>(
  'voucher-heads',
);
