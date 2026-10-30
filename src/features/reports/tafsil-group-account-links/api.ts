import { apiClient } from '../../../lib/api/client';

/**
 * ارتباط گروه تفصیلی با معین — فراگیر و فیلترپذیر روی همهٔ معین‌ها (`GET
 * /api/reports/tafsil-group-account-links`). بدون صفحه‌بندی سمت سرور، بدون دامنهٔ واحد (جدول
 * VAHEDCODE ندارد) — همهٔ پارامترها اختیاری؛ بدون هیچ فیلتر، همهٔ ردیف‌ها برمی‌گردد.
 *
 * ⚠️ `accountIds` با `URLSearchParams` دستی ساخته می‌شود، نه با آرایهٔ معمولی در `params` اکسیوس:
 * سریالایزر پیش‌فرض اکسیوس آرایه را `accountIds[]=...` می‌نویسد، درحالی‌که `[FromQuery] List<Guid>`
 * در ASP.NET Core فقط کلید تکرارشدهٔ ساده (`accountIds=a&accountIds=b`) را می‌شناسد.
 */
export interface TafsilGroupAccountLinkReportRowDto {
  accountId: string;
  moeinCode: string;
  moeinTitle: string | null;
  levelId: string;
  levelTitle: string;
  tafsilGroupId: string;
  groupCode: string;
  groupTitle: string;
}

export interface TafsilGroupAccountLinkReportFilter {
  accountIds?: string[];
  levelId?: string;
  tafsilGroupId?: string;
  tafsiliId?: string;
}

export const tafsilGroupAccountLinksReportApi = {
  get(filter: TafsilGroupAccountLinkReportFilter): Promise<TafsilGroupAccountLinkReportRowDto[]> {
    const params = new URLSearchParams();
    (filter.accountIds ?? []).forEach((id) => params.append('accountIds', id));
    if (filter.levelId) params.set('levelId', filter.levelId);
    if (filter.tafsilGroupId) params.set('tafsilGroupId', filter.tafsilGroupId);
    if (filter.tafsiliId) params.set('tafsiliId', filter.tafsiliId);
    return apiClient
      .get<TafsilGroupAccountLinkReportRowDto[]>('/reports/tafsil-group-account-links', { params })
      .then((r) => r.data);
  },
};
