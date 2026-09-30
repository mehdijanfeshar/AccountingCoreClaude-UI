import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import BalanceOutlinedIcon from '@mui/icons-material/BalanceOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import { StatTiles, type StatTile } from '../../components/StatTiles';
import { toPersianDigits } from '../../lib/format/numbers';
import type { BankStatementSummaryDto } from '../../types/treasury';

/**
 * کارت‌های KPI جزئیات صورت‌حساب — خزانه‌داری بخش ۴-د. علامت مغایرت = بانک − دفتر (`Difference`
 * سمت سرور، بدون بازمحاسبه اینجا).
 */
export function BankStatementKpiTiles({ summary, isLoading }: { summary: BankStatementSummaryDto | undefined; isLoading: boolean }) {
  const tiles: StatTile[] = [
    {
      key: 'bank',
      label: 'مانده طبق بانک',
      value: summary?.closingBalance,
      icon: <AccountBalanceOutlinedIcon fontSize="small" />,
      tone: 'primary',
    },
    {
      key: 'book',
      label: 'مانده طبق دفتر',
      value: summary?.bookBalance,
      icon: <MenuBookOutlinedIcon fontSize="small" />,
      tone: 'secondary',
    },
    {
      key: 'difference',
      label: 'مغایرت خالص',
      value: summary?.difference,
      icon: <BalanceOutlinedIcon fontSize="small" />,
      tone: summary && summary.difference === 0 ? 'success' : 'warning',
      hint: 'علامت اختلاف = بانک − دفتر',
    },
    {
      key: 'unmatched',
      label: 'موارد باز',
      value: summary?.unmatchedCount,
      icon: <ReportProblemOutlinedIcon fontSize="small" />,
      tone: 'warning',
      hint:
        summary != null
          ? `تطبیق دستی: ${toPersianDigits(summary.manualMatchedCount)} — رفع‌شده: ${toPersianDigits(summary.resolvedCount)}`
          : undefined,
    },
    {
      key: 'auto-matched',
      label: 'تعداد تطبیق خودکار',
      value: summary?.autoMatchedCount,
      icon: <SyncOutlinedIcon fontSize="small" />,
      tone: 'info',
    },
  ];

  return <StatTiles tiles={tiles} isLoading={isLoading} />;
}
