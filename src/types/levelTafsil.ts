/** Mirrors Accounting.Api's LevelTafsilDto exactly (camelCase over the wire) — `api/level-tafsils`. */
export interface LevelTafsilDto {
  id: string; // guid
  levelCode: string;
  levelName: string;
  createdDate: string | null;
  updatedDate: string | null;
  addUserId: string | null;
  changeUserId: string | null;
  isDeleted: boolean;
}
