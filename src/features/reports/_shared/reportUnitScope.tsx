import { useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import { ABILITIES, useRoles } from '../../../lib/roles';

/**
 * دامنهٔ واحد گزارش‌های تراز آزمایشی، مرور حساب‌ها و ماتریسی (فاز ۴۸): واحد جاری (0)، واحد و زیرمجموعه (1)،
 * همهٔ واحدها (2، فقط نقش مدیریتی سطح کشور) + گروه واحدها (1 بیمه‌ای، 2 درمانی، 3 ستادی). یک انبار مشترک ساده تا
 * api.ts هر گزارش بدون تغییر امضا آن را به درخواست بیفزاید؛ با تغییرش فقط کوئری‌های همین سه گزارش تازه می‌شوند.
 */
export interface ReportUnitScopeValue {
  unitScope: 0 | 1 | 2;
  unitCategory: 1 | 2 | 3 | null;
}

let current: ReportUnitScopeValue = { unitScope: 0, unitCategory: null };
const listeners = new Set<() => void>();

export function getReportUnitScope(): ReportUnitScopeValue {
  return current;
}

function setReportUnitScope(next: ReportUnitScopeValue) {
  current = next;
  listeners.forEach((l) => l());
}

/** پارامترهای query برای افزودن به درخواست گزارش (خالی = رفتار قبلی). */
export function reportUnitScopeParams(): Record<string, number> {
  const p: Record<string, number> = {};
  if (current.unitScope !== 0) p.unitScope = current.unitScope;
  if (current.unitScope !== 0 && current.unitCategory) p.unitCategory = current.unitCategory;
  return p;
}

const REPORT_QUERY_ROOTS = ['trial-balance', 'account-review', 'matrix-report'];

export function ReportUnitScopeBar() {
  const value = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getReportUnitScope,
  );
  const queryClient = useQueryClient();
  // «همهٔ واحدها» و گروه واحد = قابلیت «reports.unit-category» (پیش‌فرض: ستاد مرکزی یا سطح کشور).
  const { hasAbility } = useRoles();
  const canSeeAllUnits = hasAbility(ABILITIES.ReportsUnitCategory);

  function change(next: ReportUnitScopeValue) {
    setReportUnitScope(next);
    void queryClient.invalidateQueries({ predicate: (q) => REPORT_QUERY_ROOTS.includes(String(q.queryKey[0])) });
  }

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
        onChange={(e) => change({ unitScope: Number(e.target.value) as 0 | 1 | 2, unitCategory: value.unitCategory })}
        sx={{ minWidth: 200 }}
      >
        <MenuItem value={0}>فقط واحد جاری</MenuItem>
        <MenuItem value={1}>واحد جاری و زیرمجموعه</MenuItem>
        {canSeeAllUnits && <MenuItem value={2}>همهٔ واحدهای کشور</MenuItem>}
      </TextField>
      {value.unitScope !== 0 && canSeeAllUnits && (
        <TextField
          select
          size="small"
          label="گروه واحدها"
          value={value.unitCategory ?? ''}
          onChange={(e) => change({ unitScope: value.unitScope, unitCategory: e.target.value === '' ? null : (Number(e.target.value) as 1 | 2 | 3) })}
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
          مبالغ جمع همهٔ واحدهای دامنه است؛ ریز سند هنوز فقط برای واحد جاری باز می‌شود.
        </Typography>
      )}
    </Paper>
  );
}
