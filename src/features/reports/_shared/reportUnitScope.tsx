import { useCallback, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api/client';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import { ABILITIES, useRoles } from '../../../lib/roles';
import { onTabLifecycle, useTabId } from '../../../components/workspace-tabs/tabActivity';

/**
 * دامنهٔ واحد گزارش‌های تراز آزمایشی، مرور حساب‌ها، ماتریسی و دفتر کل (فاز ۴۸): واحد جاری (0)، واحد و زیرمجموعه
 * (1)، همهٔ واحدها (2، فقط نقش مدیریتی سطح کشور) + گروه واحدها (1 بیمه‌ای، 2 درمانی، 3 ستادی) + استان.
 *
 * <b>برای هر تب جدا</b> (کلید = شناسهٔ تب): چند نسخه از یک گزارش کنار هم باید دامنهٔ مستقل داشته باشند. مقدار در
 * کلید کوئری هر گزارش هست، پس تغییرش فقط کوئری همان تب را تازه می‌کند. پیوند بین گزارش‌ها (`accountBreakdownUrl`)
 * دامنه را در آدرس می‌برد و تب مقصد اولین بار از آدرس مقداردهی می‌شود. «نسخهٔ دیگر» دامنه را کپی می‌کند.
 */
export interface ReportUnitScopeValue {
  unitScope: 0 | 1 | 2;
  unitCategory: 1 | 2 | 3 | null;
  /** کد استان (`TB_PROVINCE.PROVINCECODE`، از شهر واحد) — همهٔ گزارش‌های چندواحدی. */
  provinceCode: string | null;
}

const DEFAULT_SCOPE: ReportUnitScopeValue = { unitScope: 0, unitCategory: null, provinceCode: null };

const scopes = new Map<string, ReportUnitScopeValue>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

onTabLifecycle({
  closed: (ids) => ids.forEach((id) => scopes.delete(id)),
  duplicated: (fromId, toId) => {
    const value = scopes.get(fromId);
    if (value) scopes.set(toId, value);
  },
});

/** دامنه از آدرس (`unitScope`، `unitCategory`، `province`) — مقدار اولیهٔ تبی که از پیوند گزارش دیگر باز شده. */
function scopeFromUrl(params: URLSearchParams): ReportUnitScopeValue {
  const unitScope = Number(params.get('unitScope'));
  if (unitScope !== 1 && unitScope !== 2) return DEFAULT_SCOPE;
  const category = Number(params.get('unitCategory'));
  return {
    unitScope,
    unitCategory: category === 1 || category === 2 || category === 3 ? category : null,
    provinceCode: params.get('province')?.trim() || null,
  };
}

/** دامنهٔ واحد تبِ همین صفحه و تابع تغییر آن. */
export function useReportUnitScope(): [ReportUnitScopeValue, (next: ReportUnitScopeValue) => void] {
  const tabId = useTabId();
  const [searchParams] = useSearchParams();
  // بار اول برای این تب: از آدرس (بدون اعلام به شنونده‌ها — فقط مقدار اولیه است).
  if (!scopes.has(tabId)) scopes.set(tabId, scopeFromUrl(searchParams));
  const value = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => scopes.get(tabId) ?? DEFAULT_SCOPE,
  );
  const setValue = useCallback(
    (next: ReportUnitScopeValue) => {
      scopes.set(tabId, next);
      emit();
    },
    [tabId],
  );
  return [value, setValue];
}

/** پارامترهای query برای افزودن به درخواست گزارش (خالی = رفتار قبلی). */
export function reportUnitScopeParams(scope: ReportUnitScopeValue): Record<string, number | string> {
  const p: Record<string, number | string> = {};
  if (scope.unitScope !== 0) p.unitScope = scope.unitScope;
  if (scope.unitScope !== 0 && scope.unitCategory) p.unitCategory = scope.unitCategory;
  if (scope.unitScope !== 0 && scope.provinceCode) p.provinceCode = scope.provinceCode;
  return p;
}

/** همان دامنه به شکل پارامترهای آدرس صفحه — برای پیوند به گزارش دیگر. */
export function reportUnitScopeUrlParams(scope: ReportUnitScopeValue): Record<string, number | string | null> {
  if (scope.unitScope === 0) return {};
  return { unitScope: scope.unitScope, unitCategory: scope.unitCategory, province: scope.provinceCode };
}

interface ReportProvince {
  code: string;
  name: string;
  unitCount: number;
}

/** `allowProvince`: انتخاب استان (پیش‌فرض روشن). */
export function ReportUnitScopeBar({ allowProvince = true, hint }: { allowProvince?: boolean; hint?: string } = {}) {
  const [value, change] = useReportUnitScope();
  // «همهٔ واحدها» و گروه واحد = قابلیت «reports.unit-category» (پیش‌فرض: ستاد مرکزی یا سطح کشور).
  const { hasAbility } = useRoles();
  const canSeeAllUnits = hasAbility(ABILITIES.ReportsUnitCategory);
  const showProvince = allowProvince && canSeeAllUnits && value.unitScope !== 0;
  const provinces = useQuery({
    queryKey: ['report-provinces'],
    queryFn: () => apiClient.get<ReportProvince[]>('/reports/provinces').then((r) => r.data),
    enabled: showProvince,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }} className="no-print">
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <PublicOutlinedIcon fontSize="small" color="action" />
        <Typography variant="body2" sx={{ fontWeight: 700 }}>دامنهٔ واحد</Typography>
      </Stack>
      <TextField
        select
        size="small"
        value={value.unitScope}
        onChange={(e) => change({ ...value, unitScope: Number(e.target.value) as 0 | 1 | 2 })}
        sx={{ minWidth: 200 }}
      >
        <MenuItem value={0}>فقط واحد جاری</MenuItem>
        <MenuItem value={1}>واحد جاری و زیرمجموعه</MenuItem>
        {canSeeAllUnits && <MenuItem value={2}>همهٔ واحدهای کشور</MenuItem>}
      </TextField>
      {showProvince && (
        <TextField
          select
          size="small"
          label="استان"
          value={value.provinceCode ?? ''}
          onChange={(e) => change({ ...value, provinceCode: e.target.value === '' ? null : e.target.value })}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">همهٔ استان‌ها</MenuItem>
          {(provinces.data ?? []).map((p) => (
            <MenuItem key={p.code} value={p.code}>
              {p.name}
            </MenuItem>
          ))}
        </TextField>
      )}
      {value.unitScope !== 0 && canSeeAllUnits && (
        <TextField
          select
          size="small"
          label="گروه واحدها"
          value={value.unitCategory ?? ''}
          onChange={(e) => change({ ...value, unitCategory: e.target.value === '' ? null : (Number(e.target.value) as 1 | 2 | 3) })}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">همهٔ گروه‌ها</MenuItem>
          <MenuItem value={1}>بیمه‌ای</MenuItem>
          <MenuItem value={2}>درمانی</MenuItem>
          <MenuItem value={3}>ستادی</MenuItem>
        </TextField>
      )}
      {value.unitScope !== 0 && (
        <Typography variant="caption" color="text.secondary">
          {hint ?? 'مبالغ جمع همهٔ واحدهای دامنه است.'}
        </Typography>
      )}
    </Paper>
  );
}
