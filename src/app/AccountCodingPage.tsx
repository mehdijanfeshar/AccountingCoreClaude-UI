import { useMemo, useState, type SyntheticEvent } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import CallSplitOutlinedIcon from '@mui/icons-material/CallSplitOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import { StatTiles, type StatTile } from '../components/StatTiles';
import { AccountCodeLevelTab } from '../features/chart-of-accounts/AccountCodeLevelTab';
import { useAllAccountCodes } from '../features/chart-of-accounts/useAllAccountCodes';
import { TafsilisTab } from '../features/tafsilis/TafsilisTab';
import { AccountTafsilGroupLinksTab } from '../features/account-tafsil-group-links/AccountTafsilGroupLinksTab';
import { toPersianDigits } from '../lib/format/numbers';

const TABS = ['group', 'kol', 'moin', 'tafsili', 'moinTafsiliLink'] as const;
type TabKey = (typeof TABS)[number];

/**
 * ۵-تب «کدینگ حسابداری» — مثل `base-coding.component` در اپ Angular قدیمی: گروه/کل/معین همه از
 * یک جدول (`TB_ACCOUNTCODE`) می‌آیند و فقط با طول `accCode` (۲/۴/۶) از هم جدا می‌شوند (به
 * `useAllAccountCodes.ts` رجوع شود). تفصیلی و ارتباط معین-گروه‌تفصیلی، جدول‌های واقعاً جدا با
 * endpoint اختصاصی خودشان هستند.
 */
/** Tab label with its icon and — once the shared account-code list has loaded — its row count. */
function TabLabel({ text, count }: { text: string; count?: number }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <span>{text}</span>
      {count !== undefined && (
        <Chip
          label={toPersianDigits(count)}
          size="small"
          sx={{ height: 20, minWidth: 28, fontSize: '0.7rem', bgcolor: 'action.selected' }}
        />
      )}
    </Stack>
  );
}

export function AccountCodingPage() {
  const [tab, setTab] = useState<TabKey>('group');
  // Same cached query the گروه/کل/معین tabs already use — reading it here costs no extra request.
  const { items, isLoading } = useAllAccountCodes();

  const counts = useMemo(() => {
    const byLength = { 2: 0, 4: 0, 6: 0 } as Record<number, number>;
    items.forEach((row) => {
      const length = (row.accCode ?? '').length;
      if (length in byLength) byLength[length] += 1;
    });
    return byLength;
  }, [items]);

  function handleChange(_event: SyntheticEvent, value: TabKey) {
    setTab(value);
  }

  function levelCount(codeLength: number): number | undefined {
    return isLoading ? undefined : counts[codeLength];
  }

  const tabIconSx = { mb: '0 !important', mr: 0, ml: 1 } as const;

  /**
   * One tile per coding level. Each is also the switch to that level's tab, so the number and the
   * way to see the accounts behind it are the same control rather than two separate steps.
   *
   * Only the three levels that share `TB_ACCOUNTCODE` get a tile — تفصیلی and the معین↔گروه link
   * are different tables, and a tile row that mixes them would imply a hierarchy that is not there.
   */
  const statTiles: StatTile[] = [
    { key: 'group', label: 'حساب‌های گروه', tone: 'primary' as const, tab: 'group' as const, count: levelCount(2) },
    { key: 'kol', label: 'حساب‌های کل', tone: 'info' as const, tab: 'kol' as const, count: levelCount(4) },
    { key: 'moin', label: 'حساب‌های معین', tone: 'success' as const, tab: 'moin' as const, count: levelCount(6) },
  ].map((tile) => ({
    key: tile.key,
    label: tile.label,
    value: tile.count ?? null,
    tone: tile.tone,
    icon: <AccountTreeOutlinedIcon fontSize="small" />,
    active: tab === tile.tab,
    onClick: () => setTab(tile.tab),
  }));

  return (
    <Box>
      <StatTiles tiles={statTiles} isLoading={isLoading} />

      <Paper variant="outlined" sx={{ mb: 3, px: 1, borderRadius: 2 }}>
        <Tabs value={tab} onChange={handleChange} variant="scrollable" scrollButtons="auto">
          <Tab
            value="group"
            iconPosition="start"
            icon={<AccountTreeOutlinedIcon fontSize="small" sx={tabIconSx} />}
            label={<TabLabel text="گروه" count={levelCount(2)} />}
          />
          <Tab
            value="kol"
            iconPosition="start"
            icon={<CallSplitOutlinedIcon fontSize="small" sx={tabIconSx} />}
            label={<TabLabel text="کل" count={levelCount(4)} />}
          />
          <Tab
            value="moin"
            iconPosition="start"
            icon={<AccountBalanceWalletOutlinedIcon fontSize="small" sx={tabIconSx} />}
            label={<TabLabel text="معین" count={levelCount(6)} />}
          />
          <Tab
            value="tafsili"
            iconPosition="start"
            icon={<CategoryOutlinedIcon fontSize="small" sx={tabIconSx} />}
            label={<TabLabel text="تفصیلی" />}
          />
          <Tab
            value="moinTafsiliLink"
            iconPosition="start"
            icon={<LinkOutlinedIcon fontSize="small" sx={tabIconSx} />}
            label={<TabLabel text="ارتباط معین با گروه تفصیلی" />}
          />
        </Tabs>
      </Paper>

      {tab === 'group' && (
        <AccountCodeLevelTab
          title="گروه"
          description="سطح اول کدینگ حسابداری — حساب‌های گروه، بدون حساب والد."
          icon={<AccountTreeOutlinedIcon />}
          codeLength={2}
          codeLengthHint="معمولاً ۲ رقم"
          parentCodeLength={null}
          addButtonLabel="افزودن گروه"
          emptyMessage="هیچ حساب گروهی یافت نشد."
        />
      )}

      {tab === 'kol' && (
        <AccountCodeLevelTab
          title="کل"
          description="سطح دوم کدینگ حسابداری — هر حساب کل باید یک حساب گروه را به‌عنوان والد داشته باشد."
          icon={<CallSplitOutlinedIcon />}
          codeLength={4}
          codeLengthHint="معمولاً ۴ رقم"
          parentCodeLength={2}
          parentFieldLabel="حساب گروه (کد - عنوان)"
          parentColumnHeader="حساب گروه"
          addButtonLabel="افزودن کل"
          emptyMessage="هیچ حساب کلی یافت نشد."
        />
      )}

      {tab === 'moin' && (
        <AccountCodeLevelTab
          title="معین"
          description="سطح سوم کدینگ حسابداری — هر حساب معین باید یک حساب کل را به‌عنوان والد داشته باشد."
          icon={<AccountBalanceWalletOutlinedIcon />}
          codeLength={6}
          codeLengthHint="معمولاً ۶ رقم"
          parentCodeLength={4}
          parentFieldLabel="حساب کل (کد - عنوان)"
          parentColumnHeader="حساب کل"
          addButtonLabel="افزودن معین"
          emptyMessage="هیچ حساب معینی یافت نشد."
        />
      )}

      {tab === 'tafsili' && <TafsilisTab />}

      {tab === 'moinTafsiliLink' && <AccountTafsilGroupLinksTab />}
    </Box>
  );
}
