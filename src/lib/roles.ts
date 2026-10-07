import { useQuery } from '@tanstack/react-query';
import { meApi } from './api/meApi';
import type { NavGroup } from './navConfig';

/**
 * نقش‌های سامانهٔ مالی — همان نقش‌های سامانهٔ ورود سازمان (سیستم قدیم) + نقش مدیریتی سطح کشور.
 * سرور (`RoleAuthorizationBehavior`) قاعدهٔ اصلی را اعمال می‌کند؛ اینجا فقط منو و دکمه‌ها پنهان می‌شوند.
 */
export const ROLES = {
  SetadAdmin: 'FINANCIAL CORE SETAD ADMIN',
  MaliAdmin: 'FINANCIAL CORE MALI ADMIN',
  HltAdmin: 'FINANCIAL CORE HLT ADMIN',
  EdkAdmin: 'FINANCIAL CORE EDK ADMIN',
  User: 'FINANCIAL CORE USER',
  Report: 'FINANCIAL CORE REPORT',
  It: 'FINANCIAL CORE IT',
  National: 'FINANCIAL CORE NATIONAL',
} as const;

export const ROLE_LABELS: Record<string, string> = {
  [ROLES.SetadAdmin]: 'مدیر ستاد',
  [ROLES.MaliAdmin]: 'مسئول حسابداری',
  [ROLES.HltAdmin]: 'مدیر درمانی',
  [ROLES.EdkAdmin]: 'مدیر بیمه‌ای',
  [ROLES.User]: 'کارمند حسابداری',
  [ROLES.Report]: 'گزارش‌گیری و حسابرسی',
  [ROLES.It]: 'فناوری اطلاعات',
  [ROLES.National]: 'مدیریتی سطح کشور',
};

/**
 * قابلیت‌های زیرمنو (فاز ۵۴) — عین `AbilityCatalog` سرور. در «دسترسی نقش‌ها» زیر منوی خودشان تخصیص داده می‌شوند؛
 * مدیر ستاد مرکزی همیشه همه را دارد.
 */
export const ABILITIES = {
  TafsiliScope: 'tafsili.scope',
  ReportsUnitCategory: 'reports.unit-category',
  FsUnitCategory: 'fs.unit-category',
  TemplatesDefine: 'templates.define',
  SavedReportsDefine: 'saved-reports.define',
} as const;
export type Ability = (typeof ABILITIES)[keyof typeof ABILITIES];
const COUNTRY_ABILITIES: Ability[] = [ABILITIES.ReportsUnitCategory, ABILITIES.FsUnitCategory];

const OPERATORS: string[] = [ROLES.SetadAdmin, ROLES.MaliAdmin, ROLES.HltAdmin, ROLES.EdkAdmin, ROLES.User, ROLES.It];

export interface RoleState {
  loaded: boolean;
  roles: string[];
  /** هیچ نقشی در سامانهٔ مالی ندارد. */
  none: boolean;
  /** اجازهٔ ثبت و تغییر عملیاتی دارد. */
  canOperate: boolean;
  isSetad: boolean;
  isNational: boolean;
  /** نقش مدیریتی سطح کشور، یا مدیر ستاد در واحد ستاد مرکزی — دیدن همهٔ واحدها. */
  canSeeAllUnits: boolean;
  /** سطح هر منو وقتی «دسترسی نقش‌ها» پیکربندی شده؛ null = قاعدهٔ ثابت. */
  menuAccess: Record<string, number> | null;
  /** قابلیت زیرمنو — `ABILITIES`؛ سرور همان را کنترل می‌کند. */
  hasAbility: (ability: Ability) => boolean;
}

export function useRoles(): RoleState {
  const me = useQuery({ queryKey: ['me'], queryFn: () => meApi.getCurrentUser(), staleTime: 5 * 60 * 1000 });
  const roles = me.data?.roles ?? [];
  return {
    loaded: !!me.data,
    roles,
    none: !!me.data && roles.length === 0,
    canOperate: roles.some((r) => OPERATORS.includes(r)),
    isSetad: roles.includes(ROLES.SetadAdmin),
    isNational: roles.includes(ROLES.National),
    canSeeAllUnits: roles.includes(ROLES.National) || (roles.includes(ROLES.SetadAdmin) && !!me.data?.isHeadquarters),
    menuAccess: me.data?.menuAccess ?? null,
    hasAbility: (ability: Ability) => {
      const granted = me.data?.abilities;
      if (granted) return granted.includes(ability);
      // سرور قدیمی بدون abilities: همان قاعدهٔ پیش‌فرض.
      const hqAdmin = roles.includes(ROLES.SetadAdmin) && !!me.data?.isHeadquarters;
      return COUNTRY_ABILITIES.includes(ability) ? hqAdmin || roles.includes(ROLES.National) : hqAdmin;
    },
  };
}

function groupVisibleByFixedRules(g: NavGroup, state: RoleState): boolean {
  switch (g.access ?? 'any') {
    case 'operate':
      return state.canOperate;
    case 'operateOrNational':
      return state.canOperate || state.isNational;
    default:
      return !state.none;
  }
}

/**
 * منوهای قابل نمایش برای کاربر. تا بارگذاری نقش‌ها، همه نمایش داده می‌شوند.
 *
 * وقتی «دسترسی نقش‌ها» پیکربندی شده (`menuAccess` در `/api/me`)، هر منو جداگانه با سطح خودش (≥ مشاهده) فیلتر
 * می‌شود و گروهی که منوی دیدنی ندارد پنهان می‌شود؛ منویی که در فهرست سرور نیست (یا بی‌مسیر است) تابع قاعدهٔ ثابت
 * گروه می‌ماند. منوهای `setadOnly` فقط برای مدیر ستاد.
 */
export function visibleNavGroups(groups: NavGroup[], state: RoleState): NavGroup[] {
  if (!state.loaded) return groups;
  const access = state.menuAccess;
  return groups
    .map((g) => {
      const fixed = groupVisibleByFixedRules(g, state);
      const items = g.items.filter((item) => {
        if (item.setadOnly) return state.isSetad;
        if (access && item.to && item.to in access) return access[item.to] >= 1;
        return fixed;
      });
      return { ...g, items };
    })
    .filter((g) => g.items.some((item) => item.to));
}
