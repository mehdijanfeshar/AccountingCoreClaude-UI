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
```

مقدار پیش‌فرض نسبی (`/api`) است تا Vite proxy کار کند و هیچ آدرس مطلق بک‌اند در کد/باندل فرانت نباشد.

## احراز هویت (توسعه)

این بک‌اند endpoint لاگین ندارد — توکن JWT از IDP سازمان تأمین می‌شود. برای تست محلی، توکن واقعی را از نوار بالای برنامه («تنظیم توکن») وارد کنید؛ در `localStorage` نگه داشته می‌شود و به‌صورت خودکار به هدر `Authorization: Bearer` هر درخواست اضافه می‌شود. **این یک UI لاگین کامل نیست** — صرفاً اسکلت نگه‌داری توکن است.

## ساختار

```
src/
  app/            روت برنامه (App.tsx)، routes.tsx، QueryClient
  components/     کامپوننت‌های مشترک UI (Layout, PageHeader, DataTable, Pagination, Field, ErrorBanner)
  lib/api/        apiClient (axios) + createResourceApi (helper CRUD جنریک) + ApiError
  lib/auth/       نگه‌داری توکن + AuthContext + مدیریت ۴۰۱
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
