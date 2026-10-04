import { apiClient } from '../../lib/api/client';
import type { FsNarrativeDto, FsNarrativeVersionDto, FsRunNarrativeDto } from '../../types/fsNarrative';
import type { FsDashboardDto, FsRatioDto, FsRatioTrendYearDto, FsRatioValueDto } from '../../types/fsRatio';
import type {
  FsDrillAccountDto,
  FsDrillUnitDto,
  FsDrillVoucherPageDto,
  FsCheckRuleDto,
  FsRunDiffRowDto,
  FsRunCommentDto,
  FsApprovalStepDto,
  FsPeriodBoardDto,
  FsPeriodLogDto,
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
  FsMappingApplyResultDto,
  FsMappingAssignment,
  FsTemplatePreviewDto,
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
  /** ۴۵-و — اعمال نگاشت روی پیش‌نویس قالب‌های واحد جاری؛ `dryRun` = فقط نتیجه. */
  applyAccountMapping(payload: {
    framework: FsFrameworkValue;
    year: number;
    items: FsMappingAssignment[];
    dryRun: boolean;
  }): Promise<FsMappingApplyResultDto> {
    return apiClient.post<FsMappingApplyResultDto>('/fs/account-mapping/apply', payload).then((res) => res.data);
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
  /** بخش ۴۵-و — همین نسخه روی اسناد واقعی واحد جاری، بدون ذخیرهٔ اجرا. */
  preview(
    versionId: string,
    params: { year: string; toMonth: number; minDocLife: number; includeSubUnits: boolean },
  ): Promise<FsTemplatePreviewDto> {
    return apiClient
      .get<FsTemplatePreviewDto>(`/fs/template-versions/${versionId}/preview`, { params })
      .then((res) => res.data);
  },
  /** ترتیب کامل ردیف‌ها؛ `parentChanges` (طراح درختی ۴۵-و) والد ردیف جابه‌جاشده را در همان تراکنش عوض می‌کند. */
  reorderRows(
    versionId: string,
    rowIds: string[],
    parentChanges?: { rowId: string; parentCode: string | null }[],
  ): Promise<void> {
    return apiClient
      .post(`/fs/template-versions/${versionId}/rows/reorder`, { rowIds, parentChanges })
      .then(() => undefined);
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
  downloadExcel(runId: string, fallbackName: string): Promise<void> {
    return downloadFile(`/fs/runs/${runId}/excel`, undefined, fallbackName);
  },
  /** Excel یک ردیف Drill-down: معین‌ها، واحدها، و اگر معین داده شود همهٔ اسناد آن. */
  downloadDrillExcel(
    runId: string,
    rowId: string,
    params: { acc?: string; unit?: string; column: "CUR" | "PRV" },
    fallbackName: string,
  ): Promise<void> {
    return downloadFile(`/fs/runs/${runId}/rows/${rowId}/drill-excel`, params, fallbackName);
  },
};

/** فایل با blob گرفته و با لینک موقت ذخیره می‌شود — لینک مستقیم هدر احراز هویت و واحد را از دست می‌دهد. */
async function downloadFile(
  endpoint: string,
  params: Record<string, string | undefined> | undefined,
  fallbackName: string,
): Promise<void> {
  const response = await apiClient.get<Blob>(endpoint, { responseType: 'blob', params });
  const header = String(response.headers['content-disposition'] ?? '');
  const match = /filename\*=UTF-8''([^;]+)/i.exec(header) ?? /filename="?([^";]+)"?/i.exec(header);
  const name = match ? decodeURIComponent(match[1]) : fallbackName;
  const objectUrl = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

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
  /** ح-۳ — نظرها و ارجاع کنترل‌ها. */
  comments(runId: string): Promise<FsRunCommentDto[]> {
    return apiClient.get<FsRunCommentDto[]>(`/fs/runs/${runId}/comments`).then((res) => res.data);
  },
  addComment(runId: string, payload: { rowId: string | null; checkId: string | null; body: string }): Promise<string> {
    return apiClient.post<{ id: string }>(`/fs/runs/${runId}/comments`, payload).then((res) => res.data.id);
  },
  deleteComment(runId: string, commentId: string): Promise<void> {
    return apiClient.post(`/fs/runs/${runId}/comments/${commentId}/delete`).then(() => undefined);
  },
  assignCheck(
    runId: string,
    checkId: string,
    payload: { assigneeUserId: string; assigneeName: string | null; dueDate: string | null; note: string | null },
  ): Promise<void> {
    return apiClient.post(`/fs/runs/${runId}/checks/${checkId}/assign`, payload).then(() => undefined);
  },
  resolveCheck(runId: string, checkId: string, note: string | null): Promise<void> {
    return apiClient.post(`/fs/runs/${runId}/checks/${checkId}/resolve`, { note }).then(() => undefined);
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

/** ح-۴ — مراحل گردش تأیید (مشترک فقط ستاد). */
export const fsApprovalStepsApi = {
  list(framework?: number): Promise<FsApprovalStepDto[]> {
    return apiClient
      .get<FsApprovalStepDto[]>("/fs/approval-steps", { params: framework ? { framework } : undefined })
      .then((res) => res.data);
  },
  create(payload: { framework: number; shared: boolean; stepNo: number; titleFa: string; approverUserIds: string | null; isActive: boolean }): Promise<string> {
    return apiClient.post<{ id: string }>("/fs/approval-steps", payload).then((res) => res.data.id);
  },
  update(id: string, payload: { stepNo: number; titleFa: string; approverUserIds: string | null; isActive: boolean }): Promise<void> {
    return apiClient.post(`/fs/approval-steps/${id}/update`, payload).then(() => undefined);
  },
  remove(id: string): Promise<void> {
    return apiClient.post(`/fs/approval-steps/${id}/delete`).then(() => undefined);
  },
};

/** ح-۵ — بستن دورهٔ صورت‌ها (فقط برای صورت‌ها؛ V-11 هنگام انتشار). */
export const fsPeriodsApi = {
  board(year: string): Promise<FsPeriodBoardDto> {
    return apiClient.get<FsPeriodBoardDto>('/fs/periods', { params: { year } }).then((res) => res.data);
  },
  log(unitCode: string, year: string): Promise<FsPeriodLogDto[]> {
    return apiClient.get<FsPeriodLogDto[]>(`/fs/periods/${unitCode}/log`, { params: { year } }).then((res) => res.data);
  },
  transition(unitCode: string, year: string, action: number, reason: string | null): Promise<number> {
    return apiClient
      .post<{ state: number }>(`/fs/periods/${unitCode}/transitions`, { year, action, reason })
      .then((res) => res.data.state);
  },
};

/** ح-۶ — یادداشت‌های توضیحی متنی (واحد هدر). */
export const fsNarrativesApi = {
  list(framework: number, year: string): Promise<FsNarrativeDto[]> {
    return apiClient.get<FsNarrativeDto[]>('/fs/narratives', { params: { framework, year } }).then((res) => res.data);
  },
  create(payload: { framework: number; year: string; titleFa: string; linkedTemplateCode: string | null; responsibleUserId: string | null }): Promise<string> {
    return apiClient.post<{ id: string }>('/fs/narratives', payload).then((res) => res.data.id);
  },
  save(id: string, payload: { titleFa: string; linkedTemplateCode: string | null; responsibleUserId: string | null; contentJson: string | null }): Promise<number> {
    return apiClient.post<{ versionNo: number }>(`/fs/narratives/${id}/update`, payload).then((res) => res.data.versionNo);
  },
  remove(id: string): Promise<void> {
    return apiClient.post(`/fs/narratives/${id}/delete`).then(() => undefined);
  },
  reorder(framework: number, year: string, ids: string[]): Promise<void> {
    return apiClient.post('/fs/narratives/reorder', { framework, year, ids }).then(() => undefined);
  },
  transition(id: string, action: number, comment: string | null): Promise<number> {
    return apiClient.post<{ state: number }>(`/fs/narratives/${id}/transitions`, { action, comment }).then((res) => res.data.state);
  },
  rollForward(framework: number, year: string): Promise<number> {
    return apiClient.post<{ count: number }>('/fs/narratives/roll-forward', { framework, year }).then((res) => res.data.count);
  },
  versions(id: string): Promise<FsNarrativeVersionDto[]> {
    return apiClient.get<FsNarrativeVersionDto[]>(`/fs/narratives/${id}/versions`).then((res) => res.data);
  },
  forRun(runId: string): Promise<FsRunNarrativeDto[]> {
    return apiClient.get<FsRunNarrativeDto[]>(`/fs/runs/${runId}/narratives`).then((res) => res.data);
  },
  async downloadDocx(runId: string, divisor: number, fileName: string): Promise<void> {
    const res = await apiClient.get<Blob>(`/fs/runs/${runId}/narratives.docx`, { params: { divisor }, responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};

/** ح-۸ — نسبت‌های مالی (مشترک فقط ستاد) و ارزیابی روی اجرا/روند. */
export const fsRatiosApi = {
  list(framework?: number): Promise<FsRatioDto[]> {
    return apiClient.get<FsRatioDto[]>('/fs/ratios', { params: framework ? { framework } : undefined }).then((res) => res.data);
  },
  forRun(runId: string): Promise<FsRatioValueDto[]> {
    return apiClient.get<FsRatioValueDto[]>(`/fs/runs/${runId}/ratios`).then((res) => res.data);
  },
  trend(framework: number, toYear: string, years = 5): Promise<FsRatioTrendYearDto[]> {
    return apiClient.get<FsRatioTrendYearDto[]>('/fs/ratios/trend', { params: { framework, toYear, years } }).then((res) => res.data);
  },
  create(payload: {
    framework: number;
    shared: boolean;
    code: string;
    titleFa: string;
    numeratorExpr: string;
    denominatorExpr: string | null;
    format: number;
    orderNo: number;
    isActive: boolean;
  }): Promise<string> {
    return apiClient.post<{ id: string }>('/fs/ratios', payload).then((res) => res.data.id);
  },
  update(id: string, payload: { titleFa: string; numeratorExpr: string; denominatorExpr: string | null; format: number; orderNo: number; isActive: boolean }): Promise<void> {
    return apiClient.post(`/fs/ratios/${id}/update`, payload).then(() => undefined);
  },
  remove(id: string): Promise<void> {
    return apiClient.post(`/fs/ratios/${id}/delete`).then(() => undefined);
  },
  seedDefaults(): Promise<string[]> {
    return apiClient.post<string[]>('/fs/ratios/seed-defaults').then((res) => res.data);
  },
  /** ح-۹ — شاخص‌ها و «کارهای من». */
  dashboard(framework: number, year: string): Promise<FsDashboardDto> {
    return apiClient.get<FsDashboardDto>('/fs/dashboard', { params: { framework, year } }).then((res) => res.data);
  },
};
