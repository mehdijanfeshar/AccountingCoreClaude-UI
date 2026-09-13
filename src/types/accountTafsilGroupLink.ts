/**
 * Mirrors Accounting.Api's AccountTafsilGroupLinkDto exactly (camelCase over the wire) —
 * "ارتباط معین با گروه تفصیلی". Backs the parent-scoped nested endpoints
 * `api/account-codes/{accountCodeId}/tafsil-group-links...` (not an independent resource — see
 * `src/features/account-tafsil-group-links/api.ts`).
 */
export interface AccountTafsilGroupLinkDto {
  id: string; // guid
  accountId: string; // guid — TB_ACCOUNTCODE.ID (معین)
  levelId: string; // guid — TB_LEVEL_TAFSIL.ID
  tafsilGroupId: string; // guid — TB_TAFSIL_GROUP.ID
  createdDate: string | null;
  updatedDate: string | null;
  addUserId: string | null;
  changeUserId: string | null;
  isDeleted: boolean;
}
