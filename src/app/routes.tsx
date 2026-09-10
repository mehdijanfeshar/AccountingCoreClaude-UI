import type { RouteObject } from 'react-router-dom';
import { HomePage } from './HomePage';
import { AccountCodesListPage } from '../features/chart-of-accounts/AccountCodesListPage';
import { VoucherHeadsListPage } from '../features/vouchers/VoucherHeadsListPage';

export const routes: RouteObject[] = [
  { path: '/', element: <HomePage /> },
  { path: '/base/account-codes', element: <AccountCodesListPage /> },
  { path: '/operation/voucher-heads', element: <VoucherHeadsListPage /> },
];
