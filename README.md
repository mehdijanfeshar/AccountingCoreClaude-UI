# سیستم حسابداری — Frontend

اسکافولد اولیهٔ فرانت‌اند (Vite 6 + React 19 + TypeScript) با اتصال End-to-End به بک‌اند `Accounting.Api`.

این ریپازیتوری **جدا** از بک‌اند (`d:\AiProj\AccountCoreAiProj\AccountingCoreClaude`) است.

## اجرا

```bash
npm install
npm run dev
```

بک‌اند باید روی `https://localhost:7155` در حال اجرا باشد (اسکیم پیش‌فرض توسعهٔ Accounting.Api). Vite dev server درخواست‌های `/api/*` را به آن proxy می‌کند (`vite.config.ts`) — چون بک‌اند هیچ CORS ای تنظیم نکرده، بدون این proxy درخواست‌های مرورگر شکست می‌خورند.

## متغیرهای محیطی

`.env.example` را به `.env.development.local` (یا مشابه) کپی کنید در صورت نیاز به override:

```
VITE_API_BASE_URL=/api
VITE_AUTH_SERVER=https://account-pilot.tamin.ir/
VITE_AUTH_CLIENT_ID=136f697b158116450170417a5105224e
VITE_AUTH_REDIRECT_URI=
```

مقدار پیش‌فرض `VITE_API_BASE_URL` نسبی (`/api`) است تا Vite proxy کار کند و هیچ آدرس مطلق بک‌اند در کد/باندل فرانت نباشد. بقیهٔ مقادیر برای SSO سازمانی‌اند — رجوع به بخش بعد.

## احراز هویت

این بک‌اند endpoint لاگین ندارد — توکن JWT همیشه از IDP سازمان (`account-pilot.tamin.ir`) تأمین می‌شود. فرم نام‌کاربری/رمز داخل برنامه وجود ندارد و نباید ساخته شود؛ ورود واقعی روی صفحهٔ خودِ سازمان انجام می‌شود:

1. کاربر در `/login` روی «ورود با حساب سازمانی» کلیک می‌کند (`src/features/auth/LoginPage.tsx`) → به IDP ریدایرکت می‌شود.
2. IDP بعد از ورود موفق، کاربر را به `redirect_uri` ثبت‌شده (در dev دقیقاً `http://localhost:4200` — پورت Vite **عمداً ثابت** روی ۴۲۰۰ است، رجوع به `vite.config.ts`) با توکن در `location.hash` برمی‌گرداند. **مسیر اختصاصی `/auth/callback` وجود ندارد** — چون `redirect_uri` ثبت‌شده هیچ path ای ندارد؛ پردازش callback در `src/lib/auth/authBootstrap.ts` قبل از رندر برنامه (در `main.tsx`) انجام می‌شود.
3. `src/lib/auth/RequireAuth.tsx` هر مسیر محافظت‌شده را چک می‌کند و در صورت نبود/انقضای توکن به `/login` هدایت می‌کند.
4. خروج از `UserMenu` در `Layout.tsx` هم توکن محلی را پاک می‌کند و هم به `auth/signout` سازمان ریدایرکت می‌کند.

`response_type` در حالت dev برابر `token` (implicit) و برای production (طبق پیکربندی مرجع) `code` + PKCE است — رجوع به `src/lib/auth/authConfig.ts` و `src/lib/auth/oauth.ts`.

## ساختار

```
src/
  app/            روت برنامه (App.tsx)، routes.tsx، QueryClient
  components/     کامپوننت‌های مشترک UI (Layout, PageHeader, DataTable, Pagination, Field, ErrorBanner)
  lib/api/        apiClient (axios) + createResourceApi (helper CRUD جنریک) + ApiError
  lib/auth/       جریان SSO (authConfig, oauth, authBootstrap, RequireAuth) + AuthContext + مدیریت ۴۰۱
  lib/session/    context سال مالی + واحد سازمانی (نمایشی) — الگوی «تنظیمات اولیه»
  features/chart-of-accounts/   فهرست کدینگ حسابداری (GET /api/account-codes)
  features/vouchers/            فهرست اسناد (GET /api/voucher-heads) + placeholder تفصیلی داینامیک
  types/          DTOها و شکل‌های مشترک (PagedResult, ProblemDetails, ...)
```

## قواعد الزامی رعایت‌شده در این کد

- بک‌اند **envelope ندارد**؛ لیست‌ها `PagedResult<T>` و خطاها RFC 7807 `ProblemDetails` هستند.
- `PUT`/`DELETE` هرگز استفاده نمی‌شود — همهٔ نوشتن‌ها `POST` هستند (`createResourceApi` این را در یک نقطهٔ واحد اجرا می‌کند).
- `vahedCode` هرگز از کلاینت به API فرستاده نمی‌شود (سمت سرور از توکن استخراج می‌شود).
- بدون کتابخانهٔ UI/تاریخ شمسی نصب‌شده — انتخاب نهایی این‌ها تصمیم باز است (به گزارش تکمیل وظیفه مراجعه شود).

## دستورهای مفید

```bash
npm run build      # tsc -b && vite build
npm run typecheck  # tsc --noEmit
npm run preview
```
