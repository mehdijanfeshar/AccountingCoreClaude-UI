import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth/AuthContext';
import { useSession } from '../lib/session/SessionContext';

/**
 * Three top-level groups, carried over from the old Angular app's page
 * structure (pages/base, pages/operation, pages/report). Routes not built
 * yet are rendered as disabled "به‌زودی" (coming soon) entries rather than
 * dead links.
 */
interface NavItem {
  label: string;
  to?: string;
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'اطلاعات پایه',
    items: [
      { label: 'کدینگ حسابداری', to: '/base/account-codes' },
      { label: 'گروه تفصیلی' },
      { label: 'بانک' },
      { label: 'هزینه' },
      { label: 'تنخواه' },
      { label: 'ویژگی' },
      { label: 'کارگاه' },
      { label: 'سال مالی' },
    ],
  },
  {
    title: 'عملیات',
    items: [
      { label: 'اسناد حسابداری', to: '/operation/voucher-heads' },
      { label: 'صدور سند (تفصیلی داینامیک)' },
      { label: 'دریافت و پرداخت' },
      { label: 'کارتابل' },
      { label: 'دسته‌چک' },
    ],
  },
  {
    title: 'گزارش‌ها',
    items: [
      { label: 'تراز آزمایشی' },
      { label: 'دفتر کل' },
      { label: 'دفتر روزنامه' },
      { label: 'مرور حساب‌ها' },
      { label: 'ترازنامه' },
      { label: 'گزارش ماتریسی' },
    ],
  },
];

function DevTokenBar() {
  const { isAuthenticated, setToken, signOut } = useAuth();
  const [draft, setDraft] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (draft.trim()) {
      setToken(draft.trim());
      setDraft('');
    }
  }

  return (
    <form className="dev-token-bar" onSubmit={handleSubmit}>
      <span>{isAuthenticated ? 'توکن تنظیم شده' : 'بدون توکن — درخواست‌ها ۴۰۱ می‌گیرند'}</span>
      <input
        type="password"
        autoComplete="off"
        placeholder="Bearer token (فقط برای توسعه)"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-label="توکن Bearer برای توسعه"
      />
      <button type="submit">تنظیم توکن</button>
      {isAuthenticated && (
        <button type="button" onClick={signOut}>
          پاک کردن
        </button>
      )}
    </form>
  );
}

function YearSelector() {
  const { financialYear, setFinancialYear } = useSession();

  return (
    <label className="year-selector">
      سال مالی:
      <input
        type="text"
        inputMode="numeric"
        placeholder="مثلاً ۱۴۰۳"
        value={financialYear}
        onChange={(e) => setFinancialYear(e.target.value)}
      />
    </label>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { hasUnauthorizedError, dismissUnauthorizedError } = useAuth();

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        رفتن به محتوای اصلی
      </a>
      <header className="app-shell__topbar">
        <Link to="/" className="app-shell__brand">
          سیستم حسابداری
        </Link>
        <YearSelector />
        <DevTokenBar />
      </header>

      {hasUnauthorizedError && (
        <div role="alert" className="unauthorized-banner">
          نشست شما معتبر نیست یا منقضی شده (۴۰۱). لطفاً توکن را دوباره تنظیم کنید.
          <button type="button" onClick={dismissUnauthorizedError}>
            بستن
          </button>
        </div>
      )}

      <div className="app-shell__body">
        <nav className="app-shell__nav" aria-label="منوی اصلی">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="nav-group">
              <h2>{group.title}</h2>
              <ul>
                {group.items.map((item) => (
                  <li key={item.label}>
                    {item.to ? (
                      <NavLink to={item.to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
                        {item.label}
                      </NavLink>
                    ) : (
                      <span className="nav-item--disabled" aria-disabled="true">
                        {item.label} <small>(به‌زودی)</small>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <main id="main-content" className="app-shell__content">
          {children}
        </main>
      </div>
    </div>
  );
}
