import type { ReactElement } from 'react';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import LockPersonOutlinedIcon from '@mui/icons-material/LockPersonOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import FactoryOutlinedIcon from '@mui/icons-material/FactoryOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import PostAddOutlinedIcon from '@mui/icons-material/PostAddOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import ManageSearchOutlinedIcon from '@mui/icons-material/ManageSearchOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import PivotTableChartOutlinedIcon from '@mui/icons-material/PivotTableChartOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import WalletOutlinedIcon from '@mui/icons-material/WalletOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import CurrencyExchangeOutlinedIcon from '@mui/icons-material/CurrencyExchangeOutlined';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import SettingsSuggestOutlinedIcon from '@mui/icons-material/SettingsSuggestOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import CompareArrowsOutlinedIcon from '@mui/icons-material/CompareArrowsOutlined';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';

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
        label: 'سطوح تفصیلی',
        description: 'سطح‌هایی که تفصیلی هر معین در قالب آن‌ها خواسته می‌شود',
        to: '/base/level-tafsils',
        icon: <LayersOutlinedIcon fontSize="small" />,
      },
      {
        label: 'بانک',
        description: 'حساب‌های بانکی و دسته‌چک‌های هر حساب',
        to: '/base/bank',
        icon: <AccountBalanceOutlinedIcon fontSize="small" />,
      },
      {
        label: 'ویژگی',
        description: 'گروه ویژگی، اجزای آن، و ویژگی‌های ثبت‌شده',
        to: '/base/features',
        icon: <TuneOutlinedIcon fontSize="small" />,
      },
      {
        label: 'حساب‌های شناسه‌دار',
        description: 'حساب‌های معین دارای شناسه',
        to: '/base/attrib-for-account-codes',
        icon: <BadgeOutlinedIcon fontSize="small" />,
      },
      {
        label: 'دسترسی کدینگ حسابداری',
        description: 'هر معین را کدام نوع واحدها می‌توانند استفاده کنند',
        to: '/base/coding-permissions',
        icon: <LockPersonOutlinedIcon fontSize="small" />,
      },
      {
        label: 'کارگاه',
        description: 'کارگاه‌ها و شعب مربوطه',
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
        label: 'کارتابل اسناد',
        description: 'اسناد بر اساس وضعیت، با امکان انتقال وضعیت',
        to: '/operation/voucher-heads',
        icon: <InboxOutlinedIcon fontSize="small" />,
      },
      {
        label: 'صدور سند (تفصیلی داینامیک)',
        description: 'ثبت سند جدید با ردیف‌های تفصیلی',
        to: '/operation/vouchers/new',
        icon: <PostAddOutlinedIcon fontSize="small" />,
      },
    ],
  },
  {
    title: 'گزارش‌ها',
    icon: <AssessmentOutlinedIcon fontSize="small" />,
    color: 'warning',
    items: [
      {
        label: 'تراز آزمایشی',
        description: 'گردش و مانده حساب‌ها در بازهٔ انتخابی (۴، ۶ و ۸ ستونی)',
        to: '/reports/trial-balance',
        icon: <BarChartOutlinedIcon fontSize="small" />,
      },
      { label: 'دفتر کل', icon: <MenuBookOutlinedIcon fontSize="small" /> },
      {
        label: 'دفتر روزنامه',
        description: 'همهٔ ردیف‌های اسناد، به ترتیب تاریخ و شماره سند',
        to: '/reports/account-journal',
        icon: <ArticleOutlinedIcon fontSize="small" />,
      },
      {
        label: 'مرور اسناد',
        description: 'اسناد با جمع بدهکار و بستانکار هرکدام — برای یافتن سند نامتوازن',
        to: '/reports/voucher-review',
        icon: <FactCheckOutlinedIcon fontSize="small" />,
      },
      {
        label: 'مرور حساب‌ها',
        description: 'گردش و ماندهٔ حساب‌ها در هر سطح، با پیمایش از کل به جزء',
        to: '/reports/account-review',
        icon: <ManageSearchOutlinedIcon fontSize="small" />,
      },
      { label: 'ترازنامه', icon: <AccountBalanceWalletOutlinedIcon fontSize="small" /> },
      {
        label: 'گزارش ماتریسی',
        description: 'تقاطع دو بُعد — یکی روی سطر، یکی روی ستون، با بدهکار/بستانکار در هر خانه',
        to: '/reports/matrix',
        icon: <PivotTableChartOutlinedIcon fontSize="small" />,
      },
    ],
  },
  /**
   * تنخواه و خزانه‌داری — ماژول جدید و جدا (`docs/tankhah-khazaneh-module.md`، تصمیم صاحب پروژه
   * ۲۰۲۶-۰۹-۲۷، بخش ۰-۱). منوهای قدیمی «تنخواه» (`اطلاعات پایه`)، «دریافت و پرداخت» (`عملیات`) و
   * «هزینه» (`اطلاعات پایه`) طبق تصمیم صاحب پروژه در ۲۰۲۶-۰۹-۲۷ از منو حذف شدند (روت‌هاشان
   * دست‌نخورده مانده). صفحهٔ «تعریف تنخواه» از ۲۰۲۶-۰۹-۲۸ جدول مستقل خودش (`TB_PC_FUND`) را دارد و
   * دیگر به `/base/revolving-funds` ارجاعی نمی‌دهد.
   * ترتیب موارد این گروه دقیقاً به ترتیب پاورپوینت (سند مرجع §۶) است. بخش ۱ فقط سه مورد را ساخته
   * (تعریف تنخواه، ثبت صورت‌هزینه، کارتابل تنخواه)؛ بقیه تا اطلاع ثانوی «به‌زودی»‌اند.
   */
  {
    title: 'تنخواه و خزانه‌داری',
    icon: <WalletOutlinedIcon fontSize="small" />,
    color: 'secondary',
    items: [
      {
        label: 'داشبورد تنخواه',
        description: 'موجودی نقد، تأییدشدهٔ منتظر ترمیم، در جریان بررسی و برگشتی — به‌ازای هر تنخواه',
        to: '/treasury/petty-cash/dashboard',
        icon: <DashboardOutlinedIcon fontSize="small" />,
      },
      {
        label: 'کارتابل تنخواه',
        description: 'صورت‌هزینه‌ها بر اساس وضعیت — پیش‌نویس تا تسویه‌شده',
        to: '/treasury/petty-cash/cartable',
        icon: <InboxOutlinedIcon fontSize="small" />,
      },
      {
        label: 'ثبت صورت‌هزینه',
        description: 'ثبت هزینه‌کرد از یک تنخواه، با فاکتور/رسید پشتوانه',
        to: '/treasury/petty-cash/expense-docs/new',
        icon: <ReceiptLongOutlinedIcon fontSize="small" />,
      },
      {
        label: 'شارژ و ترمیم',
        description: 'درخواست ترمیم تنخواه از اسناد تأییدشده، با مسیر تأیید مدیر مالی ← خزانه‌دار',
        to: '/treasury/petty-cash/replenishments',
        icon: <CurrencyExchangeOutlinedIcon fontSize="small" />,
      },
      {
        label: 'تسویه دوره',
        description: 'پیش‌نمایش دورهٔ جاری، ثبت شمارش صندوق و صدور سند حسابداری تسویه',
        to: '/treasury/petty-cash/settlement',
        icon: <EventRepeatOutlinedIcon fontSize="small" />,
      },
      {
        label: 'گزارش گردش تنخواه',
        description: 'تاریخچهٔ حرکت نقد یک تنخواه — ترمیم، هزینه‌کرد، استرداد',
        to: '/treasury/petty-cash/ledger',
        icon: <TrendingUpOutlinedIcon fontSize="small" />,
      },
      {
        label: 'تعریف تنخواه',
        description: 'تنظیمات هر تنخواه — سقف هر سند، آستانهٔ هشدار، تنخواه‌دار و دورهٔ تسویه',
        to: '/treasury/petty-cash/funds',
        icon: <SettingsSuggestOutlinedIcon fontSize="small" />,
      },
      {
        label: 'داشبورد خزانه',
        description: 'موجودی بانک‌ها، تعهدات پیش‌رو، اقلام در انتظار تأیید و گردش امروز',
        to: '/treasury/khazaneh/dashboard',
        icon: <AccountBalanceOutlinedIcon fontSize="small" />,
      },
      {
        label: 'درخواست پرداخت',
        description: 'ثبت، ویرایش و ارسال درخواست پرداخت به زنجیرهٔ تأیید خزانه',
        to: '/treasury/khazaneh/payment-requests',
        icon: <RequestQuoteOutlinedIcon fontSize="small" />,
      },
      {
        label: 'کارتابل تأیید',
        description: 'درخواست‌های پرداخت و ترمیم‌های تنخواه در انتظار تأیید کاربر جاری',
        to: '/treasury/khazaneh/cartable',
        icon: <FactCheckOutlinedIcon fontSize="small" />,
      },
      {
        label: 'تنظیمات خزانه',
        description: 'آستانهٔ تأیید مدیرعامل و سقف تأیید گروهی — فقط مدیر مالی',
        to: '/treasury/khazaneh/settings',
        icon: <TuneOutlinedIcon fontSize="small" />,
      },
      {
        label: 'نقش‌های خزانه',
        description: 'مدیر واحد، مدیر مالی، مدیرعامل، حسابدار ارشد و خزانه‌دار',
        to: '/treasury/khazaneh/roles',
        icon: <BadgeOutlinedIcon fontSize="small" />,
      },
      {
        label: 'اجرای پرداخت',
        description: 'اجرای واقعی پرداخت‌های آمادهٔ خزانه در بانک، یا تعلیق/رفع تعلیق موقت',
        to: '/treasury/khazaneh/execution',
        icon: <PaymentsOutlinedIcon fontSize="small" />,
      },
      {
        label: 'دریافت و انتقال',
        description: 'دریافت وجه از مشتریان و انتقال وجه بین حساب‌های بانکی واحد',
        to: '/treasury/khazaneh/receipts-transfers',
        icon: <CompareArrowsOutlinedIcon fontSize="small" />,
      },
      {
        label: 'مغایرت بانکی',
        description: 'صورت‌حساب‌های بانکی و تطبیق ردیف‌های آن با دفتر',
        to: '/treasury/khazaneh/bank-reconciliation',
        icon: <RuleOutlinedIcon fontSize="small" />,
      },
    ],
  },
  /**
   * صورت‌های مالی — فاز ۴۵ (`docs/fs-module.md` در ریپوی بک‌اند). بخش ۴۵-الف فقط «قالب صورت‌ها»؛
   * تهیه و نمایش صورت در ۴۵-ب.
   */
  {
    title: 'صورت‌های مالی',
    icon: <TableChartOutlinedIcon fontSize="small" />,
    color: 'primary',
    items: [
      {
        label: 'تهیهٔ صورت‌های مالی',
        description: 'اجرای قالب‌ها روی اسناد یک دوره',
        to: '/fs/runs',
        icon: <AssessmentOutlinedIcon fontSize="small" />,
      },
      {
        label: 'قالب صورت‌ها',
        description: 'ردیف‌ها، حساب‌ها و فرمول‌های هر صورت مالی',
        to: '/fs/templates',
        icon: <TableChartOutlinedIcon fontSize="small" />,
      },
      {
        label: "کنترل‌های صورت‌ها",
        description: "قواعد تساوی بین صورت‌ها که با هر تهیه اجرا می‌شوند",
        to: "/fs/check-rules",
        icon: <RuleOutlinedIcon fontSize="small" />,
      },
    ],
  },
];
