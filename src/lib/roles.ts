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
  };
}

/** گروه‌های منوی قابل نمایش برای نقش‌های کاربر. تا بارگذاری نقش‌ها، همه نمایش داده می‌شوند. */
export function visibleNavGroups(groups: NavGroup[], state: RoleState): NavGroup[] {
  if (!state.loaded) return groups;
  return groups.filter((g) => {
    switch (g.access ?? 'any') {
      case 'operate':
        return state.canOperate;
      case 'operateOrNational':
        return state.canOperate || state.isNational;
      default:
        return !state.none;
    }
  });
}
