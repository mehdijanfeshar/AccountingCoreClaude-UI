import type { RouteObject } from 'react-router-dom';
import { HomePage } from './HomePage';
import { AccountCodesListPage } from '../features/chart-of-accounts/AccountCodesListPage';
import { AccountCodeFormPage } from '../features/chart-of-accounts/AccountCodeFormPage';
import { VoucherHeadsListPage } from '../features/vouchers/VoucherHeadsListPage';
import { VoucherEntryPage } from '../features/vouchers/VoucherEntryPage';

export const routes: RouteObject[] = [
  { path: '/', element: <HomePage /> },
  { path: '/base/account-codes', element: <AccountCodesListPage /> },
  { path: '/base/account-codes/new', element: <AccountCodeFormPage /> },
  { path: '/base/account-codes/:id/edit', element: <AccountCodeFormPage /> },
  { path: '/operation/voucher-heads', element: <VoucherHeadsListPage /> },
  { path: '/operation/vouchers/new', element: <VoucherEntryPage /> },
];
