import type { RouteObject } from 'react-router-dom';
import { HomePage } from './HomePage';
import { LoginPage } from '../features/auth/LoginPage';
import { AccountCodingPage } from './AccountCodingPage';
import { AccountCodeFormPage } from '../features/chart-of-accounts/AccountCodeFormPage';
import { TafsilGroupsListPage } from '../features/tafsil-groups/TafsilGroupsListPage';
import { TafsilGroupFormPage } from '../features/tafsil-groups/TafsilGroupFormPage';
import { LevelTafsilsListPage } from '../features/level-tafsils/LevelTafsilsListPage';
import { LevelTafsilFormPage } from '../features/level-tafsils/LevelTafsilFormPage';
import { BankPage } from './BankPage';
import { BankAccountFormPage } from '../features/bank-accounts/BankAccountFormPage';
import { ExpensesListPage } from '../features/expenses/ExpensesListPage';
import { ExpenseFormPage } from '../features/expenses/ExpenseFormPage';
import { RevolvingFundsListPage } from '../features/revolving-funds/RevolvingFundsListPage';
import { RevolvingFundFormPage } from '../features/revolving-funds/RevolvingFundFormPage';
import { AttribForAccountCodesListPage } from '../features/attrib-for-account-codes/AttribForAccountCodesListPage';
import { AttribForAccountCodeFormPage } from '../features/attrib-for-account-codes/AttribForAccountCodeFormPage';
import { CodingPermissionsListPage } from '../features/coding-permissions/CodingPermissionsListPage';
import { FeaturesPage } from './FeaturesPage';
import { IdentityGroupFormPage } from '../features/identity/IdentityGroupFormPage';
import { IdentitySubGroupFormPage } from '../features/identity/IdentitySubGroupFormPage';
import { IdentityHeadFormPage } from '../features/identity/IdentityHeadFormPage';
import { WorkShopsListPage } from '../features/work-shops/WorkShopsListPage';
import { WorkShopFormPage } from '../features/work-shops/WorkShopFormPage';
import { VoucherHeadsListPage } from '../features/vouchers/VoucherHeadsListPage';
import { VoucherEntryPage } from '../features/vouchers/VoucherEntryPage';
import { VoucherViewPage } from '../features/vouchers/VoucherViewPage';
import { PayReciveHeadsListPage } from '../features/pay-recive-heads/PayReciveHeadsListPage';
import { PayReciveHeadFormPage } from '../features/pay-recive-heads/PayReciveHeadFormPage';
import { CheckBookFormPage } from '../features/check-books/CheckBookFormPage';
import { TrialBalancePage } from '../features/reports/trial-balance/TrialBalancePage';
import { AccountReviewPage } from '../features/reports/account-review/AccountReviewPage';
import { MatrixReportPage } from '../features/reports/matrix/MatrixReportPage';
import { VoucherReviewPage } from '../features/reports/voucher-review/VoucherReviewPage';
import { AccountJournalPage } from '../features/reports/account-journal/AccountJournalPage';
import { PettyCashFundsListPage } from '../features/petty-cash/PettyCashFundsListPage';
import { PettyCashCartablePage } from '../features/petty-cash/PettyCashCartablePage';
import { ExpenseDocFormPage } from '../features/petty-cash/ExpenseDocFormPage';
import { PettyCashDashboardPage } from '../features/petty-cash/PettyCashDashboardPage';
import { ReplenishmentsListPage } from '../features/petty-cash/ReplenishmentsListPage';
import { ReplenishmentFormPage } from '../features/petty-cash/ReplenishmentFormPage';
import { PettyCashLedgerPage } from '../features/petty-cash/PettyCashLedgerPage';
import { PettyCashSettlementPage } from '../features/petty-cash/PettyCashSettlementPage';
import { PaymentRequestListPage } from '../features/treasury/PaymentRequestListPage';
import { PaymentRequestFormPage } from '../features/treasury/PaymentRequestFormPage';
import { ApprovalCartablePage } from '../features/treasury/ApprovalCartablePage';
import { TreasurySettingsPage } from '../features/treasury/TreasurySettingsPage';
import { TreasuryRolesPage } from '../features/treasury/TreasuryRolesPage';
import { PaymentExecutionListPage } from '../features/treasury/PaymentExecutionListPage';
import { ReceiptsTransfersPage } from '../features/treasury/ReceiptsTransfersPage';
import { ReceiptFormPage } from '../features/treasury/ReceiptFormPage';
import { TransferFormPage } from '../features/treasury/TransferFormPage';
import { BankStatementListPage } from '../features/treasury/BankStatementListPage';
import { BankStatementDetailPage } from '../features/treasury/BankStatementDetailPage';
import { TreasuryDashboardPage } from '../features/treasury/TreasuryDashboardPage';

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

  // سطوح تفصیلی — the lookup that «ارتباط معین با گروه تفصیلی» and the voucher form both read.
  { path: '/base/level-tafsils', element: <LevelTafsilsListPage /> },
  { path: '/base/level-tafsils/new', element: <LevelTafsilFormPage /> },
  { path: '/base/level-tafsils/:id/edit', element: <LevelTafsilFormPage /> },

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

  // دسترسی کدینگ — یک صفحه است، نه صفحهٔ فرم جدا: ساخت و فعال‌سازی مجدد هر دو دیالوگ‌اند، چون
  // ساخت یک عملیات دسته‌ای روی ضرب دکارتی است و به یک ردیف مشخص گره نمی‌خورد.
  { path: '/base/coding-permissions', element: <CodingPermissionsListPage /> },

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
  { path: '/operation/vouchers/:id/edit', element: <VoucherEntryPage /> },
  // Read-only. The only way into a reviewed/accepted voucher, which the edit route refuses.
  { path: '/operation/vouchers/:id/view', element: <VoucherViewPage /> },

  { path: '/operation/pay-recive-heads', element: <PayReciveHeadsListPage /> },
  { path: '/operation/pay-recive-heads/new', element: <PayReciveHeadFormPage /> },
  { path: '/operation/pay-recive-heads/:id/edit', element: <PayReciveHeadFormPage /> },

  { path: '/reports/trial-balance', element: <TrialBalancePage /> },
  { path: '/reports/account-review', element: <AccountReviewPage /> },
  { path: '/reports/matrix', element: <MatrixReportPage /> },
  { path: '/reports/voucher-review', element: <VoucherReviewPage /> },
  { path: '/reports/account-journal', element: <AccountJournalPage /> },

  // تنخواه و خزانه‌داری — بخش ۱ («تعریف تنخواه»، «ثبت صورت‌هزینه»، «کارتابل تنخواه») + بخش ۳-الف
  // (داشبورد، شارژ و ترمیم، گزارش گردش). «تسویه دوره» در `navConfig.tsx` عمداً بدون `to` مانده تا
  // «به‌زودی» نمایش داده شود.
  { path: '/treasury/petty-cash/funds', element: <PettyCashFundsListPage /> },
  { path: '/treasury/petty-cash/cartable', element: <PettyCashCartablePage /> },
  { path: '/treasury/petty-cash/expense-docs/new', element: <ExpenseDocFormPage /> },
  { path: '/treasury/petty-cash/expense-docs/:id/edit', element: <ExpenseDocFormPage /> },
  { path: '/treasury/petty-cash/dashboard', element: <PettyCashDashboardPage /> },
  { path: '/treasury/petty-cash/replenishments', element: <ReplenishmentsListPage /> },
  { path: '/treasury/petty-cash/replenishments/new', element: <ReplenishmentFormPage /> },
  { path: '/treasury/petty-cash/replenishments/:id', element: <ReplenishmentFormPage /> },
  { path: '/treasury/petty-cash/ledger', element: <PettyCashLedgerPage /> },
  { path: '/treasury/petty-cash/settlement', element: <PettyCashSettlementPage /> },

  // خزانه‌داری، بخش ۴-الف — درخواست پرداخت + کارتابل تأیید + تنظیمات/نقش‌های خزانه
  // (`docs/tankhah-khazaneh-module.md` §۱۰). بقیهٔ موارد «خزانه» در `navConfig.tsx` همچنان
  // «به‌زودی»‌اند.
  { path: '/treasury/khazaneh/payment-requests', element: <PaymentRequestListPage /> },
  { path: '/treasury/khazaneh/payment-requests/new', element: <PaymentRequestFormPage /> },
  { path: '/treasury/khazaneh/payment-requests/:id/edit', element: <PaymentRequestFormPage /> },
  { path: '/treasury/khazaneh/cartable', element: <ApprovalCartablePage /> },
  { path: '/treasury/khazaneh/settings', element: <TreasurySettingsPage /> },
  { path: '/treasury/khazaneh/roles', element: <TreasuryRolesPage /> },
  // بخش ۴-ب — اجرای پرداخت.
  { path: '/treasury/khazaneh/execution', element: <PaymentExecutionListPage /> },
  // بخش ۴-ج — دریافت وجه + انتقال وجه.
  { path: '/treasury/khazaneh/receipts-transfers', element: <ReceiptsTransfersPage /> },
  { path: '/treasury/khazaneh/receipts/new', element: <ReceiptFormPage /> },
  { path: '/treasury/khazaneh/receipts/:id/edit', element: <ReceiptFormPage /> },
  { path: '/treasury/khazaneh/transfers/new', element: <TransferFormPage /> },
  { path: '/treasury/khazaneh/transfers/:id/edit', element: <TransferFormPage /> },
  // بخش ۴-د — مغایرت‌گیری بانکی + داشبورد خزانه.
  { path: '/treasury/khazaneh/bank-reconciliation', element: <BankStatementListPage /> },
  { path: '/treasury/khazaneh/bank-reconciliation/:id', element: <BankStatementDetailPage /> },
  { path: '/treasury/khazaneh/dashboard', element: <TreasuryDashboardPage /> },
];
