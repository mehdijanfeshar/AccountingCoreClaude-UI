/**
 * Mirrors Accounting.Api's SysTypeDto exactly (camelCase over the wire) — `TB_SYSTYPE`, the
 * نوع سند lookup behind `TB_VOUCHERSHEAD.SYSTEM_TYPE`. Returned as a bare array (never paged):
 * it is a small static reference table.
 */
export interface SysTypeDto {
  id: string; // guid
  sysCode: string;
  sysName: string | null;
}
