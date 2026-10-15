import { apiClient } from '../../lib/api/client';

/**
 * انتقال از سیستم قدیم — `api/legacy-import`. واحد روی هدر `X-Vahed-Code`.
 * «بررسی» (`commit=false`) همه‌چیز را در تراکنش اجرا و برمی‌گرداند؛ «ثبت» (`commit=true`) ذخیره می‌کند.
 */

export interface LegacySourceDto {
  server: string;
  schema: string;
  year: number;
  connected: boolean;
  error: string | null;
  vouchers: number;
}

/** اتصال دستی واحد: یک سرور + اسکیمای هر سال. رمزها هرگز از سرور برنمی‌گردند. */
export interface LegacyConnectionsDto {
  server: { dataSource: string; title: string | null; userName: string | null; hasPassword: boolean } | null;
  years: { year: number; schema: string; userName: string | null; hasPassword: boolean }[];
}

/** رمز خالی = رمز ذخیره‌شده بماند. `credentialToken` = نام کاربر/رمز رمزگشایی‌شده از فایل XML (برای مرورگر بی‌معنا). */
export interface LegacyConnectionsInput {
  server: {
    dataSource: string;
    title: string | null;
    userName: string | null;
    password: string | null;
    credentialToken: string | null;
    /** نام اسکیما بدون سال؛ برای «یافتن خودکار سال‌ها». */
    schemaBase?: string | null;
  };
  years: { year: number; schema: string; userName: string | null; password: string | null }[];
}

export interface LegacyConnectionsResultDto {
  saved: boolean;
  results: LegacySourceDto[];
}

export interface LegacyXmlServerDto {
  decrypted: boolean;
  userName: string | null;
  credentialToken: string | null;
  message: string | null;
}

export interface LegacyImportStatusDto {
  chartImported: boolean;
  chartImportedAt: string | null;
  unitCodingImported: boolean;
  unitCodingImportedAt: string | null;
  /** زمان انتقال اطلاعات بانکی (حساب، دسته‌چک، چک). */
  bankImportedAt?: string | null;
}

export interface LegacyVoucherYearDto {
  year: number;
  vouchers: number;
  lines: number;
  migratedAt: string;
}

export interface LegacyImportReportDto {
  success: boolean;
  committed: boolean;
  errors: string[];
  warnings: string[];
  info: string[];
  /** فقط انتقال بخش‌بندی‌شده (اسناد سال). */
  sections?: LegacySectionDto[] | null;
  issues?: LegacyIssueDto[] | null;
}

/** یک بخش انتقال (جدول/گروه جدول) با تعداد رکورد آماده و مشکلات باز/حل‌شده. */
export interface LegacySectionDto {
  key: string;
  title: string;
  records: number;
  open: number;
  resolved: number;
  notes: string[];
}

export interface LegacyIssueOptionDto {
  code: string;
  label: string;
  /** گزینهٔ «جایگزینی»: انتخاب از فهرست موجود. */
  picker: 'moein' | 'tafsili' | null;
}

/** مشکل قابل‌رفع؛ `status`: open (منتظر تصمیم)، resolved، invalid (تصمیم قابل اعمال نیست — `problem`). */
export interface LegacyIssueDto {
  id: string;
  section: string;
  message: string;
  hint: string | null;
  uses: number;
  samples: string[];
  options: LegacyIssueOptionDto[];
  status: 'open' | 'resolved' | 'invalid';
  option: string | null;
  value: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  problem: string | null;
}

export interface LegacyDecisionInput {
  issueId: string;
  /** null = حذف تصمیم. */
  option: string | null;
  value: string | null;
}

export interface LegacyLookupDto {
  code: string;
  title: string;
}

/** فایل با blob گرفته و با لینک موقت ذخیره می‌شود — لینک مستقیم هدر احراز هویت و واحد را از دست می‌دهد. */
async function download(endpoint: string, params: Record<string, string> | undefined, fallbackName: string): Promise<void> {
  const response = await apiClient.get<Blob>(endpoint, { responseType: 'blob', params });
  const header = String(response.headers['content-disposition'] ?? '');
  const match = /filename\*=UTF-8''([^;]+)/i.exec(header) ?? /filename="?([^";]+)"?/i.exec(header);
  const name = match ? decodeURIComponent(match[1]) : fallbackName;
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function upload(endpoint: string, file: File, commit: boolean): Promise<LegacyImportReportDto> {
  const formData = new FormData();
  formData.append('file', file);
  return apiClient
    .post<LegacyImportReportDto>(endpoint, formData, { params: { commit } })
    .then((r) => r.data);
}

export const legacyImportApi = {
  connections: () => apiClient.get<LegacyConnectionsDto>('/legacy-import/connections').then((r) => r.data),
  /** همهٔ سال‌ها آزموده می‌شوند؛ `check` = فقط آزمودن، وگرنه فقط اگر همه وصل شوند ذخیره. Intentionally POST (no PUT). */
  saveConnections: (input: LegacyConnectionsInput, check: boolean) =>
    apiClient.post<LegacyConnectionsResultDto>('/legacy-import/connections', input, { params: { check } }).then((r) => r.data),
  /** رمزگشایی نام کاربر/رمز سرور انتخاب‌شده از فایل XML روی سرور. */
  readXmlServer: (s: { title: string; dataSource: string; encryptedUserName: string | null; encryptedPassword: string | null }) =>
    apiClient.post<LegacyXmlServerDto>('/legacy-import/xml-server', s).then((r) => r.data),
  sources: () => apiClient.get<LegacySourceDto[]>('/legacy-import/sources').then((r) => r.data),
  status: () => apiClient.get<LegacyImportStatusDto>('/legacy-import/status').then((r) => r.data),
  /** `year` = فقط همان سال (برای مشاهده)؛ بدون آن همهٔ سال‌ها. */
  downloadUnitWorkbook: (year?: number) =>
    download('/legacy-import/unit-workbook', year ? { year: String(year) } : undefined, 'legacy-unit.xlsx'),
  uploadUnitWorkbook: (file: File, commit: boolean) => upload('/legacy-import/unit-workbook', file, commit),
  /** کدینگ مشترک (فقط مدیر ستاد). */
  downloadChartWorkbook: (units: string[]) =>
    download('/legacy-import/chart-workbook', { units: units.join(',') }, 'legacy-chart.xlsx'),
  uploadChartWorkbook: (file: File, commit: boolean) => upload('/legacy-import/chart-workbook', file, commit),
  /** حساب‌های بانکی، نوع چک، دسته‌چک و برگ چک (تکرارپذیر)؛ `commit=false` فقط بررسی. */
  importBank: (commit: boolean) =>
    apiClient.post<LegacyImportReportDto>('/legacy-import/bank', null, { params: { commit } }).then((r) => r.data),
  /** انتقال اسناد یک سال؛ `commit=false` فقط بررسی. */
  importVouchers: (year: number, commit: boolean) =>
    apiClient.post<LegacyImportReportDto>('/legacy-import/vouchers', null, { params: { year, commit } }).then((r) => r.data),
  voucherStatus: () => apiClient.get<LegacyVoucherYearDto[]>('/legacy-import/vouchers').then((r) => r.data),
  /** تصمیم‌های کاربر روی مشکلات انتقال یک سال؛ در بررسی بعدی اعمال می‌شوند. */
  saveVoucherDecisions: (year: number, decisions: LegacyDecisionInput[]) =>
    apiClient.post<void>(`/legacy-import/vouchers/${year}/decisions`, decisions).then(() => undefined),
  /** معین/تفصیلی موجود سیستم جدید برای «جایگزینی». */
  lookup: (kind: 'moein' | 'tafsili', q: string) =>
    apiClient.get<LegacyLookupDto[]>('/legacy-import/lookup', { params: { kind, q } }).then((r) => r.data),
  /** فهرست شمارهٔ سند جدید ← قدیم. */
  downloadVoucherMap: (year: number) => download(`/legacy-import/vouchers/${year}/map`, undefined, `legacy-vouchers-${year}.xlsx`),
};
