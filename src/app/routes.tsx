import type { RouteObject } from 'react-router-dom';
import { HomePage } from './HomePage';
import { LoginPage } from '../features/auth/LoginPage';
import { AccountCodingPage } from './AccountCodingPage';
import { AccountCodeFormPage } from '../features/chart-of-accounts/AccountCodeFormPage';
import { TafsilGroupsListPage } from '../features/tafsil-groups/TafsilGroupsListPage';
import { TafsilGroupFormPage } from '../features/tafsil-groups/TafsilGroupFormPage';
import { BankPage } from './BankPage';
import { BankAccountFormPage } from '../features/bank-accounts/BankAccountFormPage';
import { ExpensesListPage } from '../features/expenses/ExpensesListPage';
import { ExpenseFormPage } from '../features/expenses/ExpenseFormPage';
import { RevolvingFundsListPage } from '../features/revolving-funds/RevolvingFundsListPage';
import { RevolvingFundFormPage } from '../features/revolving-funds/RevolvingFundFormPage';
import { AttribForAccountCodesListPage } from '../features/attrib-for-account-codes/AttribForAccountCodesListPage';
import { AttribForAccountCodeFormPage } from '../features/attrib-for-account-codes/AttribForAccountCodeFormPage';
import { FeaturesPage } from './FeaturesPage';
import { IdentityGroupFormPage } from '../features/identity/IdentityGroupFormPage';
import { IdentitySubGroupFormPage } from '../features/identity/IdentitySubGroupFormPage';
import { IdentityHeadFormPage } from '../features/identity/IdentityHeadFormPage';
import { WorkShopsListPage } from '../features/work-shops/WorkShopsListPage';
import { WorkShopFormPage } from '../features/work-shops/WorkShopFormPage';
import { VoucherHeadsListPage } from '../features/vouchers/VoucherHeadsListPage';
import { VoucherEntryPage } from '../features/vouchers/VoucherEntryPage';
import { PayReciveHeadsListPage } from '../features/pay-recive-heads/PayReciveHeadsListPage';
import { PayReciveHeadFormPage } from '../features/pay-recive-heads/PayReciveHeadFormPage';
import { CheckBookFormPage } from '../features/check-books/CheckBookFormPage';

/** Routes rendered without the authenticated Layout/RequireAuth shell — see App.tsx. */
export const PUBLIC_PATHS = new Set<string>(['/login']);

export const routes: RouteObject[] = [
  { path: '/', element: <HomePage /> },
  { path: '/login', element: <LoginPage /> },

  { path: '/base/account-codes', element: <AccountCodingPage /> },
  { path: '/base/account-codes/new', element: <AccountCodeFormPage /> },
  { path: '/base/account-codes/:id/edit', element: <AccountCodeFormPage /> },

  { path: '/base/tafsil-groups', element: <TafsilGroupsListPage /> },
  { path: '/base/tafsil-groups/new', element: <TafsilGroupFormPage /> },
  { path: '/base/tafsil-groups/:id/edit', element: <TafsilGroupFormPage /> },

  // بانک — یک صفحهٔ تب‌دار (حساب‌ها / دسته‌چک)، چون دسته‌چک FK اجباری به حساب دارد.
  { path: '/base/bank', element: <BankPage /> },
  { path: '/base/bank/accounts/new', element: <BankAccountFormPage /> },
  { path: '/base/bank/accounts/:id/edit', element: <BankAccountFormPage /> },
  { path: '/base/bank/check-books/new', element: <CheckBookFormPage /> },
  { path: '/base/bank/check-books/:id/edit', element: <CheckBookFormPage /> },

  { path: '/base/expenses', element: <ExpensesListPage /> },
  { path: '/base/expenses/new', element: <ExpenseFormPage /> },
  { path: '/base/expenses/:id/edit', element: <ExpenseFormPage /> },

  { path: '/base/revolving-funds', element: <RevolvingFundsListPage /> },
  { path: '/base/revolving-funds/new', element: <RevolvingFundFormPage /> },
  { path: '/base/revolving-funds/:id/edit', element: <RevolvingFundFormPage /> },

  { path: '/base/attrib-for-account-codes', element: <AttribForAccountCodesListPage /> },
  { path: '/base/attrib-for-account-codes/new', element: <AttribForAccountCodeFormPage /> },
  { path: '/base/attrib-for-account-codes/:id/edit', element: <AttribForAccountCodeFormPage /> },

  // ویژگی — یک صفحهٔ تب‌دار (گروه / اجزا / ثبت‌شده‌ها) مثل کدینگ، نه چند منوی خواهر.
  { path: '/base/features', element: <FeaturesPage /> },
  { path: '/base/features/groups/new', element: <IdentityGroupFormPage /> },
  { path: '/base/features/groups/:id/edit', element: <IdentityGroupFormPage /> },
  { path: '/base/features/groups/:groupId/parts/new', element: <IdentitySubGroupFormPage /> },
  { path: '/base/features/groups/:groupId/parts/:id/edit', element: <IdentitySubGroupFormPage /> },
  { path: '/base/features/records/new', element: <IdentityHeadFormPage /> },
  { path: '/base/features/records/:id/edit', element: <IdentityHeadFormPage /> },

  { path: '/base/work-shops', element: <WorkShopsListPage /> },
  { path: '/base/work-shops/new', element: <WorkShopFormPage /> },
  { path: '/base/work-shops/:id/edit', element: <WorkShopFormPage /> },

  { path: '/operation/voucher-heads', element: <VoucherHeadsListPage /> },
  { path: '/operation/vouchers/new', element: <VoucherEntryPage /> },

  { path: '/operation/pay-recive-heads', element: <PayReciveHeadsListPage /> },
  { path: '/operation/pay-recive-heads/new', element: <PayReciveHeadFormPage /> },
  { path: '/operation/pay-recive-heads/:id/edit', element: <PayReciveHeadFormPage /> },

];
