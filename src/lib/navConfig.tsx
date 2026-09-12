import type { ReactElement } from 'react';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import FactoryOutlinedIcon from '@mui/icons-material/FactoryOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import PostAddOutlinedIcon from '@mui/icons-material/PostAddOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import BookOutlinedIcon from '@mui/icons-material/BookOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import ManageSearchOutlinedIcon from '@mui/icons-material/ManageSearchOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import GridOnOutlinedIcon from '@mui/icons-material/GridOnOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';

/**
 * Single source of truth for the app's navigation tree — used both by the sidebar (`Layout.tsx`)
 * and the home dashboard cards (`HomePage.tsx`), so the two never drift. Routes not built yet
 * have no `to` (rendered as disabled "به‌زودی" entries in the sidebar, and simply excluded from
 * the home dashboard, which only ever shows live links).
 */
export interface NavItem {
  label: string;
  description?: string;
  to?: string;
  icon: ReactElement;
}

export type NavAccentColor = 'primary' | 'secondary' | 'warning';

export interface NavGroup {
  title: string;
  icon: ReactElement;
  color: NavAccentColor;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'اطلاعات پایه',
    icon: <FolderOutlinedIcon fontSize="small" />,
    color: 'primary',
    items: [
      {
        label: 'کدینگ حسابداری',
        description: 'ساختار درختی کدینگ حساب‌ها (گروه/کل/معین/تفصیلی)',
        to: '/base/account-codes',
        icon: <AccountTreeOutlinedIcon fontSize="small" />,
      },
      {
        label: 'گروه تفصیلی',
        description: 'گروه‌بندی حساب‌های تفصیلی',
        to: '/base/tafsil-groups',
        icon: <CategoryOutlinedIcon fontSize="small" />,
      },
      {
        label: 'بانک',
        description: 'حساب‌های بانکی سازمان',
        to: '/base/bank-accounts',
        icon: <AccountBalanceOutlinedIcon fontSize="small" />,
      },
      {
        label: 'هزینه',
        description: 'تعریف انواع هزینه',
        to: '/base/expenses',
        icon: <ReceiptLongOutlinedIcon fontSize="small" />,
      },
      {
        label: 'تنخواه',
        description: 'تعریف تنخواه‌گردان‌ها',
        to: '/base/revolving-funds',
        icon: <SavingsOutlinedIcon fontSize="small" />,
      },
      {
        label: 'ویژگی',
        description: 'ویژگی‌های تعریف‌شده برای حساب‌های معین',
        to: '/base/attrib-for-account-codes',
        icon: <TuneOutlinedIcon fontSize="small" />,
      },
      {
        label: 'کارگاه',
        description: 'کارگاه‌ها و خطوط تولید',
        to: '/base/work-shops',
        icon: <FactoryOutlinedIcon fontSize="small" />,
      },
      { label: 'سال مالی', icon: <EventOutlinedIcon fontSize="small" /> },
    ],
  },
  {
    title: 'عملیات',
    icon: <BoltOutlinedIcon fontSize="small" />,
    color: 'secondary',
    items: [
      {
        label: 'اسناد حسابداری',
        description: 'فهرست سرسند اسناد',
        to: '/operation/voucher-heads',
        icon: <DescriptionOutlinedIcon fontSize="small" />,
      },
      {
        label: 'صدور سند (تفصیلی داینامیک)',
        description: 'ثبت سند جدید با ردیف‌های تفصیلی',
        to: '/operation/vouchers/new',
        icon: <PostAddOutlinedIcon fontSize="small" />,
      },
      { label: 'دریافت و پرداخت', icon: <SwapHorizOutlinedIcon fontSize="small" /> },
      { label: 'کارتابل', icon: <InboxOutlinedIcon fontSize="small" /> },
      { label: 'دسته‌چک', icon: <BookOutlinedIcon fontSize="small" /> },
    ],
  },
  {
    title: 'گزارش‌ها',
    icon: <AssessmentOutlinedIcon fontSize="small" />,
    color: 'warning',
    items: [
      { label: 'تراز آزمایشی', icon: <BarChartOutlinedIcon fontSize="small" /> },
      { label: 'دفتر کل', icon: <MenuBookOutlinedIcon fontSize="small" /> },
      { label: 'دفتر روزنامه', icon: <ArticleOutlinedIcon fontSize="small" /> },
      { label: 'مرور حساب‌ها', icon: <ManageSearchOutlinedIcon fontSize="small" /> },
      { label: 'ترازنامه', icon: <AccountBalanceWalletOutlinedIcon fontSize="small" /> },
      { label: 'گزارش ماتریسی', icon: <GridOnOutlinedIcon fontSize="small" /> },
    ],
  },
];
