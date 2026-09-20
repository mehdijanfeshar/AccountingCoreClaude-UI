import { useState, type SyntheticEvent } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import BookOutlinedIcon from '@mui/icons-material/BookOutlined';
import { PageHeader } from '../components/PageHeader';
import { BankAccountsTab } from '../features/bank-accounts/BankAccountsTab';
import { CheckBooksTab } from '../features/check-books/CheckBooksTab';

const TABS = ['accounts', 'checkBooks'] as const;
type TabKey = (typeof TABS)[number];

/**
 * ۲-تب «بانک» — حساب‌های بانکی و دسته‌چک‌هایشان.
 *
 * <b>Why دسته‌چک moved here from عملیات.</b> `TB_CHECKBOOK.ACCOUNT_ID` is a *required* FK to
 * `TB_ACCOUNT`: a دسته‌چک cannot exist without the bank account it belongs to. Listing it as a
 * standalone عملیات entry implied it was an operation in its own right, when it is really a
 * property of an account — so it is a tab here, the same shape `AccountCodingPage` and
 * `FeaturesPage` use for their own multi-level concepts.
 *
 * Opening an account's دسته‌چک‌ها from its row carries the account into the other tab's filter,
 * which is the question someone actually has when they click it.
 */
export function BankPage() {
  const [tab, setTab] = useState<TabKey>('accounts');
  const [accountFilter, setAccountFilter] = useState('');

  function handleChange(_event: SyntheticEvent, value: TabKey) {
    setTab(value);
  }

  function openCheckBooksOf(accountId: string) {
    setAccountFilter(accountId);
    setTab('checkBooks');
  }

  const tabIconSx = { mb: '0 !important', mr: 0, ml: 1 } as const;

  return (
    <Box>
      <PageHeader
        eyebrow="اطلاعات پایه"
        icon={<AccountBalanceOutlinedIcon />}
        title="بانک"
        description="حساب‌های بانکی سازمان و دسته‌چک‌های صادرشده برای هر حساب."
      />

      <Paper variant="outlined" sx={{ mb: 3, px: 1, borderRadius: 2 }}>
        <Tabs value={tab} onChange={handleChange} variant="scrollable" scrollButtons="auto">
          <Tab
            value="accounts"
            iconPosition="start"
            icon={<AccountBalanceOutlinedIcon fontSize="small" sx={tabIconSx} />}
            label="حساب‌های بانکی"
          />
          <Tab
            value="checkBooks"
            iconPosition="start"
            icon={<BookOutlinedIcon fontSize="small" sx={tabIconSx} />}
            label="دسته‌چک"
          />
        </Tabs>
      </Paper>

      {tab === 'accounts' && <BankAccountsTab onOpenCheckBooks={openCheckBooksOf} />}

      {tab === 'checkBooks' && (
        <CheckBooksTab accountFilter={accountFilter} onAccountFilterChange={setAccountFilter} />
      )}
    </Box>
  );
}
