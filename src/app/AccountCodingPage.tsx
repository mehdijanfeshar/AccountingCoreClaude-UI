import { useState, type SyntheticEvent } from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import CallSplitOutlinedIcon from '@mui/icons-material/CallSplitOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import { AccountCodeLevelTab } from '../features/chart-of-accounts/AccountCodeLevelTab';
import { TafsilisTab } from '../features/tafsilis/TafsilisTab';
import { AccountTafsilGroupLinksTab } from '../features/account-tafsil-group-links/AccountTafsilGroupLinksTab';

const TABS = ['group', 'kol', 'moin', 'tafsili', 'moinTafsiliLink'] as const;
type TabKey = (typeof TABS)[number];

/**
 * ۵-تب «کدینگ حسابداری» — مثل `base-coding.component` در اپ Angular قدیمی: گروه/کل/معین همه از
 * یک جدول (`TB_ACCOUNTCODE`) می‌آیند و فقط با طول `accCode` (۲/۴/۶) از هم جدا می‌شوند (به
 * `useAllAccountCodes.ts` رجوع شود). تفصیلی و ارتباط معین-گروه‌تفصیلی، جدول‌های واقعاً جدا با
 * endpoint اختصاصی خودشان هستند.
 */
export function AccountCodingPage() {
  const [tab, setTab] = useState<TabKey>('group');

  function handleChange(_event: SyntheticEvent, value: TabKey) {
    setTab(value);
  }

  return (
    <Box>
      <Tabs value={tab} onChange={handleChange} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="group" label="گروه" />
        <Tab value="kol" label="کل" />
        <Tab value="moin" label="معین" />
        <Tab value="tafsili" label="تفصیلی" />
        <Tab value="moinTafsiliLink" label="ارتباط معین با گروه تفصیلی" />
      </Tabs>

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
          addButtonLabel="افزودن معین"
          emptyMessage="هیچ حساب معینی یافت نشد."
        />
      )}

      {tab === 'tafsili' && <TafsilisTab />}

      {tab === 'moinTafsiliLink' && <AccountTafsilGroupLinksTab />}
    </Box>
  );
}
