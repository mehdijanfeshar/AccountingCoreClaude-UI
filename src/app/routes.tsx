import type { RouteObject } from 'react-router-dom';
import { HomePage } from './HomePage';
import { AccountCodingPage } from './AccountCodingPage';
import { AccountCodeFormPage } from '../features/chart-of-accounts/AccountCodeFormPage';
import { TafsilGroupsListPage } from '../features/tafsil-groups/TafsilGroupsListPage';
import { TafsilGroupFormPage } from '../features/tafsil-groups/TafsilGroupFormPage';
import { BankAccountsListPage } from '../features/bank-accounts/BankAccountsListPage';
import { BankAccountFormPage } from '../features/bank-accounts/BankAccountFormPage';
import { ExpensesListPage } from '../features/expenses/ExpensesListPage';
import { ExpenseFormPage } from '../features/expenses/ExpenseFormPage';
import { RevolvingFundsListPage } from '../features/revolving-funds/RevolvingFundsListPage';
import { RevolvingFundFormPage } from '../features/revolving-funds/RevolvingFundFormPage';
import { AttribForAccountCodesListPage } from '../features/attrib-for-account-codes/AttribForAccountCodesListPage';
import { AttribForAccountCodeFormPage } from '../features/attrib-for-account-codes/AttribForAccountCodeFormPage';
import { WorkShopsListPage } from '../features/work-shops/WorkShopsListPage';
import { WorkShopFormPage } from '../features/work-shops/WorkShopFormPage';
import { VoucherHeadsListPage } from '../features/vouchers/VoucherHeadsListPage';
import { VoucherEntryPage } from '../features/vouchers/VoucherEntryPage';
import { PayReciveHeadsListPage } from '../features/pay-recive-heads/PayReciveHeadsListPage';
import { PayReciveHeadFormPage } from '../features/pay-recive-heads/PayReciveHeadFormPage';
import { CheckBooksListPage } from '../features/check-books/CheckBooksListPage';
import { CheckBookFormPage } from '../features/check-books/CheckBookFormPage';

export const routes: RouteObject[] = [
  { path: '/', element: <HomePage /> },

  { path: '/base/account-codes', element: <AccountCodingPage /> },
  { path: '/base/account-codes/new', element: <AccountCodeFormPage /> },
  { path: '/base/account-codes/:id/edit', element: <AccountCodeFormPage /> },

  { path: '/base/tafsil-groups', element: <TafsilGroupsListPage /> },
  { path: '/base/tafsil-groups/new', element: <TafsilGroupFormPage /> },
  { path: '/base/tafsil-groups/:id/edit', element: <TafsilGroupFormPage /> },

  { path: '/base/bank-accounts', element: <BankAccountsListPage /> },
  { path: '/base/bank-accounts/new', element: <BankAccountFormPage /> },
  { path: '/base/bank-accounts/:id/edit', element: <BankAccountFormPage /> },

  { path: '/base/expenses', element: <ExpensesListPage /> },
  { path: '/base/expenses/new', element: <ExpenseFormPage /> },
  { path: '/base/expenses/:id/edit', element: <ExpenseFormPage /> },

  { path: '/base/revolving-funds', element: <RevolvingFundsListPage /> },
  { path: '/base/revolving-funds/new', element: <RevolvingFundFormPage /> },
  { path: '/base/revolving-funds/:id/edit', element: <RevolvingFundFormPage /> },

  { path: '/base/attrib-for-account-codes', element: <AttribForAccountCodesListPage /> },
  { path: '/base/attrib-for-account-codes/new', element: <AttribForAccountCodeFormPage /> },
  { path: '/base/attrib-for-account-codes/:id/edit', element: <AttribForAccountCodeFormPage /> },

  { path: '/base/work-shops', element: <WorkShopsListPage /> },
  { path: '/base/work-shops/new', element: <WorkShopFormPage /> },
  { path: '/base/work-shops/:id/edit', element: <WorkShopFormPage /> },

  { path: '/operation/voucher-heads', element: <VoucherHeadsListPage /> },
  { path: '/operation/vouchers/new', element: <VoucherEntryPage /> },

  { path: '/operation/pay-recive-heads', element: <PayReciveHeadsListPage /> },
  { path: '/operation/pay-recive-heads/new', element: <PayReciveHeadFormPage /> },
  { path: '/operation/pay-recive-heads/:id/edit', element: <PayReciveHeadFormPage /> },

  { path: '/operation/check-books', element: <CheckBooksListPage /> },
  { path: '/operation/check-books/new', element: <CheckBookFormPage /> },
  { path: '/operation/check-books/:id/edit', element: <CheckBookFormPage /> },
];
