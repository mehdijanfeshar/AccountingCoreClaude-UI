/* ح-۶ — یادداشت‌های توضیحی متنی (سند منبع §۹). */

/** 1 پیش‌نویس، 2 در بازبینی، 3 تأییدشده، 4 نیازمند اصلاح. */
export type FsNarrativeStateValue = 1 | 2 | 3 | 4;

export const FS_NARRATIVE_STATE_META: Record<FsNarrativeStateValue, { label: string; color: 'default' | 'info' | 'success' | 'warning' }> = {
  1: { label: 'پیش‌نویس', color: 'default' },
  2: { label: 'در بازبینی', color: 'info' },
  3: { label: 'تأییدشده', color: 'success' },
  4: { label: 'نیازمند اصلاح', color: 'warning' },
};

export const FS_NARRATIVE_ACTION = { Submit: 1, Approve: 2, Return: 3 } as const;

export interface FsNarrativeDto {
  id: string;
  orderNo: number;
  titleFa: string;
  linkedTemplateCode: string | null;
  /** سند Tiptap (JSON). */
  contentJson: string | null;
  state: FsNarrativeStateValue;
  responsibleUserId: string | null;
  reviewComment: string | null;
  versionNo: number;
  lastEditedBy: string;
  lastEditedDate: string;
}

export interface FsNarrativeVersionDto {
  versionNo: number;
  titleFa: string;
  contentJson: string | null;
  addUserId: string;
  createdDate: string;
}

export interface FsRunNarrativeDto {
  id: string;
  orderNo: number;
  titleFa: string;
  linkedTemplateCode: string | null;
  contentJson: string | null;
  state: FsNarrativeStateValue | null;
  /** کپی زمان انتشار (ثابت). */
  isSnapshot: boolean;
}
