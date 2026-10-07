/** Mirrors Accounting.Api's CurrentUserDto exactly — `GET /api/me`. */
export interface CurrentUserDto {
  userId: string;
  /** The user's OWN unit, from their token. Null when the token carries no org claim. */
  vahedCode: string | null;
  /** Null also when the token's unit code matches no TB_VAHED_INFO row. */
  vahedName: string | null;
  /** True when this unit may act as every unit (TYPECODE 17 / ستاد مرکزی). */
  isHeadquarters: boolean;
  /** نقش‌های سامانهٔ مالی کاربر (از توکن سامانهٔ ورود). */
  roles?: string[];
  /**
   * سطح دسترسی به هر منو (کلید = مسیر صفحه؛ ۰ بدون دسترسی، ۱ مشاهده، ۲ ثبت و تغییر) وقتی «دسترسی نقش‌ها»
   * پیکربندی شده؛ null/نبود = منو با قاعدهٔ ثابت گروه‌ها فیلتر می‌شود.
   */
  menuAccess?: Record<string, number> | null;
  /** قابلیت‌های زیرمنو که کاربر دارد (مثل `tafsili.scope`) — بخش‌ها و دکمه‌های داخل فرم با آن فعال می‌شوند. */
  abilities?: string[] | null;
}

/** Mirrors Accounting.Api's AccessibleUnitDto exactly — `GET /api/me/accessible-units`. */
export interface AccessibleUnitDto {
  id: string;
  vahedCode: string;
  vahedName: string;
  /** Null for a root unit. 73 of the 1046 live units are roots. */
  parentId: string | null;
  /** Server-computed: true for exactly the caller's own unit. Never compare codes client-side. */
  isDefault: boolean;
}

/**
 * Mirrors Accounting.Api's YearDto exactly — `GET /api/years`.
 *
 * ⚠️ No `id` field: TB_YEAR's primary key IS the year number, so `workingYear` is both the
 * identity and the label. The old Angular app's `{id, describtion}` shape does not exist here.
 */
export interface YearDto {
  workingYear: number;
  isCurrent: boolean | null;
  lastNumber: number | null;
}
