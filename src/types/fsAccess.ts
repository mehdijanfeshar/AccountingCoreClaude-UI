/* ط-۲ — دسترسی سه‌بُعدی صورت‌های مالی (کاربر × دامنهٔ واحد × عملیات). */

export const FS_OPERATIONS = [
  { bit: 1, label: 'مشاهده' },
  { bit: 2, label: 'تهیهٔ صورت‌ها و یادداشت‌ها' },
  { bit: 4, label: 'تغییر قالب و تنظیمات' },
  { bit: 8, label: 'فعال‌سازی قالب' },
  { bit: 16, label: 'تأیید / برگشت' },
  { bit: 32, label: 'انتشار' },
  { bit: 64, label: 'بستن دوره' },
  { bit: 128, label: 'مدیریت دسترسی (همه)' },
] as const;

export interface FsPermissionDto {
  id: string;
  userId: string;
  userName: string | null;
  vahedCode: string;
  includeSub: boolean;
  /** بیت‌های جمع‌شدهٔ FS_OPERATIONS. */
  operations: number;
}
