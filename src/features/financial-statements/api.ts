import { apiClient } from '../../lib/api/client';
import type {
  FsDrillAccountDto,
  FsDrillUnitDto,
  FsDrillVoucherPageDto,
  FsCheckRuleDto,
  FsRunDiffRowDto,
  FsRunStalenessDto,
  FsRunDetailDto,
  FsRunSummaryDto,
  GenerateFsRunPayload,
} from "../../types/fsRun";
import type {
  FsFrameworkValue,
  FsTemplateCheckResultDto,
  FsTemplateDto,
  FsTemplateRowInput,
  FsAccountMappingDto,
  FsTemplateVersionDetailDto,
} from '../../types/fsTemplate';

/**
 * صورت‌های مالی، بخش ۴۵-الف — `api/fs/...` (قالب/نسخه/ردیف). قالب‌ها سراسری‌اند (هدر واحد اثری
 * ندارد). فقط GET/POST (`{id}/update`، `{id}/delete`).
 */
export const fsTemplatesApi = {
  list(framework?: FsFrameworkValue): Promise<FsTemplateDto[]> {
    return apiClient
      .get<FsTemplateDto[]>('/fs/templates', { params: framework ? { framework } : undefined })
      .then((res) => res.data);
  },
  create(payload: {
    framework: FsFrameworkValue;
    code: string;
    titleFa: string;
    titleEn: string | null;
    statementType: number;
    orderNo: number;
    /** قالب مشترک همهٔ واحدها (فقط ستاد)؛ وگرنه اختصاصی واحد جاری. */
    shared: boolean;
    noteParentTemplateCode?: string | null;
    noteParentRowCode?: string | null;
    noteTotalRowCode?: string | null;
  }): Promise<{ templateId: string; versionId: string }> {
    return apiClient.post('/fs/templates', payload).then((res) => res.data);
  },
  update(
    id: string,
    payload: {
      titleFa: string;
      titleEn: string | null;
      orderNo: number;
      noteParentTemplateCode?: string | null;
      noteParentRowCode?: string | null;
      noteTotalRowCode?: string | null;
    },
  ): Promise<void> {
    return apiClient.post(`/fs/templates/${id}/update`, payload).then(() => undefined);
  },
  remove(id: string): Promise<void> {
    return apiClient.post(`/fs/templates/${id}/delete`).then(() => undefined);
  },
  /** پاسخ = کد قالب‌های ساخته‌شده (خالی اگر همه از قبل بودند). */
  seedDefaults(): Promise<string[]> {
    return apiClient.post<string[]>('/fs/templates/seed-defaults').then((res) => res.data);
  },
  /** بخش ۴۵-و — هر معین کدینگ به کدام ردیف قالب‌های مجموعه رفته (قالب‌های همان اجرای واحد جاری). */
  accountMapping(framework: FsFrameworkValue, year: number, useDrafts: boolean): Promise<FsAccountMappingDto[]> {
    return apiClient
      .get<FsAccountMappingDto[]>("/fs/account-mapping", { params: { framework, year, useDrafts } })
      .then((res) => res.data);
  },
  createVersion(templateId: string, payload: { sourceVersionId: string | null; description: string | null }): Promise<string> {
    return apiClient
      .post<{ id: string }>(`/fs/templates/${templateId}/versions`, payload)
      .then((res) => res.data.id);
  },
};

export const fsTemplateVersionsApi = {
  get(versionId: string): Promise<FsTemplateVersionDetailDto> {
    return apiClient.get<FsTemplateVersionDetailDto>(`/fs/template-versions/${versionId}`).then((res) => res.data);
  },
  update(versionId: string, description: string | null): Promise<void> {
    return apiClient.post(`/fs/template-versions/${versionId}/update`, { description }).then(() => undefined);
  },
  remove(versionId: string): Promise<void> {
    return apiClient.post(`/fs/template-versions/${versionId}/delete`).then(() => undefined);
  },
  validate(versionId: string): Promise<FsTemplateCheckResultDto> {
    return apiClient
      .post<FsTemplateCheckResultDto>(`/fs/template-versions/${versionId}/validate`)
      .then((res) => res.data);
  },
  /** ۴۰۰ با فهرست خطاها (کلید = `RowCode.Field`) اگر قالب معتبر نباشد. */
  activate(versionId: string, effectiveFromYear: number): Promise<void> {
    return apiClient
      .post(`/fs/template-versions/${versionId}/activate`, { effectiveFromYear })
      .then(() => undefined);
  },
  addRow(versionId: string, row: FsTemplateRowInput): Promise<string> {
    return apiClient
      .post<{ id: string }>(`/fs/template-versions/${versionId}/rows`, row)
      .then((res) => res.data.id);
  },
  updateRow(versionId: string, rowId: string, row: FsTemplateRowInput): Promise<void> {
    return apiClient.post(`/fs/template-versions/${versionId}/rows/${rowId}/update`, row).then(() => undefined);
  },
  removeRow(versionId: string, rowId: string): Promise<void> {
    return apiClient.post(`/fs/template-versions/${versionId}/rows/${rowId}/delete`).then(() => undefined);
  },
  reorderRows(versionId: string, rowIds: string[]): Promise<void> {
    return apiClient.post(`/fs/template-versions/${versionId}/rows/reorder`, { rowIds }).then(() => undefined);
  },
};

/**
 * بخش ۴۵-ب — اجرای تهیهٔ صورت‌ها. Vahed-scoped: واحد از هدر `X-Vahed-Code` (interceptor)، هرگز در
 * بدنه. تهیه هم‌زمان است و پاسخ شناسهٔ اجراست؛ ۴۰۹ اگر قالب قابل‌استفاده نباشد.
 */
export const fsRunsApi = {
  list(year?: string): Promise<FsRunSummaryDto[]> {
    return apiClient
      .get<FsRunSummaryDto[]>('/fs/runs', { params: year ? { year } : undefined })
      .then((res) => res.data);
  },
  get(id: string): Promise<FsRunDetailDto> {
    return apiClient.get<FsRunDetailDto>(`/fs/runs/${id}`).then((res) => res.data);
  },
  generate(payload: GenerateFsRunPayload): Promise<string> {
    return apiClient.post<{ id: string }>('/fs/runs', payload).then((res) => res.data.id);
  },
  remove(id: string): Promise<void> {
    return apiClient.post(`/fs/runs/${id}/delete`).then(() => undefined);
  },
};

/** بخش ۴۵-د — Drill-down چهارسطحی و خروجی Excel یک اجرا. */
export const fsDrillApi = {
  accounts(runId: string, rowId: string): Promise<FsDrillAccountDto[]> {
    return apiClient.get<FsDrillAccountDto[]>(`/fs/runs/${runId}/rows/${rowId}/accounts`).then((res) => res.data);
  },
  units(runId: string, rowId: string, acc?: string): Promise<FsDrillUnitDto[]> {
    return apiClient
      .get<FsDrillUnitDto[]>(`/fs/runs/${runId}/rows/${rowId}/units`, { params: acc ? { acc } : undefined })
      .then((res) => res.data);
  },
  /** زنده از اسناد (نه Snapshot) — معین/واحدی که در ترکیب ردیف نیست ۴۰۴ می‌دهد. */
  vouchers(
    runId: string,
    rowId: string,
    params: { acc: string; unit?: string; column: 'CUR' | 'PRV'; page: number; pageSize: number },
  ): Promise<FsDrillVoucherPageDto> {
    return apiClient
      .get<FsDrillVoucherPageDto>(`/fs/runs/${runId}/rows/${rowId}/vouchers`, { params })
      .then((res) => res.data);
  },
  /** فایل با blob گرفته می‌شود (لینک مستقیم هدر احراز هویت و واحد را از دست می‌دهد). */
  async downloadExcel(runId: string, fallbackName: string): Promise<void> {
    const response = await apiClient.get<Blob>(`/fs/runs/${runId}/excel`, { responseType: 'blob' });
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
  },
};

/** بخش ۴۵-ه — گردش تأیید، کهنگی و مقایسهٔ اجراها. */
export const fsRunWorkflowApi = {
  /** action: 1 ارسال، 2 تأیید، 3 برگشت (با دلیل)، 4 انتشار. پاسخ = وضعیت تازه. */
  transition(runId: string, action: number, comments: string | null): Promise<number> {
    return apiClient
      .post<{ id: string; state: number }>(`/fs/runs/${runId}/transitions`, { action, comments })
      .then((res) => res.data.state);
  },
  staleness(runId: string): Promise<FsRunStalenessDto> {
    return apiClient.get<FsRunStalenessDto>(`/fs/runs/${runId}/staleness`).then((res) => res.data);
  },
  diff(runId: string, otherId: string): Promise<FsRunDiffRowDto[]> {
    return apiClient.get<FsRunDiffRowDto[]>(`/fs/runs/${runId}/diff/${otherId}`).then((res) => res.data);
  },
};

/** بخش ۴۵-ه — قواعد کنترل تساوی بین صورت‌ها (مشترک فقط ستاد). */
export const fsCheckRulesApi = {
  list(framework?: number): Promise<FsCheckRuleDto[]> {
    return apiClient
      .get<FsCheckRuleDto[]>('/fs/check-rules', { params: framework ? { framework } : undefined })
      .then((res) => res.data);
  },
  create(payload: {
    framework: number;
    code: string;
    titleFa: string;
    leftExpr: string;
    rightExpr: string;
    tolerance: number;
    severity: number;
    isActive: boolean;
    shared: boolean;
  }): Promise<string> {
    return apiClient.post<{ id: string }>('/fs/check-rules', payload).then((res) => res.data.id);
  },
  update(
    id: string,
    payload: { titleFa: string; leftExpr: string; rightExpr: string; tolerance: number; severity: number; isActive: boolean },
  ): Promise<void> {
    return apiClient.post(`/fs/check-rules/${id}/update`, payload).then(() => undefined);
  },
  remove(id: string): Promise<void> {
    return apiClient.post(`/fs/check-rules/${id}/delete`).then(() => undefined);
  },
};
