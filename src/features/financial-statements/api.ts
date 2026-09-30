import { apiClient } from '../../lib/api/client';
import type { FsRunDetailDto, FsRunSummaryDto, GenerateFsRunPayload } from '../../types/fsRun';
import type {
  FsFrameworkValue,
  FsTemplateCheckResultDto,
  FsTemplateDto,
  FsTemplateRowInput,
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
