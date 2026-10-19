import { apiClient } from '../../lib/api/client';
import { ApiError } from '../../lib/api/apiError';
import type {
  TemplateDefinitionDto,
  TemplateDefinitionSummaryDto,
  TemplateWritePayload,
  TemplateWriteResult,
  ComposedVoucherInput,
  DraftLineExtrasInput,
  InterpretResult,
  EngineError,
  OperationInput,
  OperationResult,
  TemplateSummaryDto,
  RecentOperation,
  ExecutionPage,
  TemplateUsage,
  QuickVoucher,
  MyVouchersResult,
  MyVoucherStatus,
  ReviewPage,
  ReviewDetail,
  ReturnPayload,
  OperationRequestItem,
  DetailSuggestion,
  HistoryPatternFilters,
  HistoryPatternPage,
  HistoryRebuildResult,
  HistorySuggestion,
  HistoryTemplateDraft,
} from './types';

/** ردپای حسابیار: اخیرها، تاریخچه، آمار، آزمایش الگو. */
export const assistantHistoryApi = {
  recent: async () => (await apiClient.get<RecentOperation[]>('/operations/recent')).data,
  executions: async (params: {
    fromDate?: string; toDate?: string; templateId?: string; channel?: string; mineOnly?: boolean; page: number; pageSize: number;
  }) => (await apiClient.get<ExecutionPage>('/operations/executions', { params })).data,
  usage: async () => (await apiClient.get<TemplateUsage[]>('/operations/templates/usage')).data,
  testTemplate: async (payload: TemplateWritePayload & { voucherDate: string | null; values: Record<string, string | null> }) =>
    (await apiClient.post<OperationResult>('/operations/templates/test', payload)).data,
};

/**
 * A 422 from `api/operations` is not a failure of the request — it is the engine saying what is
 * still missing. It is turned back into an `OperationResult` so callers handle "ask the user" and
 * "show the draft" through one shape; any other error still throws.
 */
async function asResult(request: Promise<{ data: OperationResult }>): Promise<OperationResult> {
  try {
    return (await request).data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 422 || error.status === 404)) {
      const errors = Array.isArray(error.problem?.errors)
        ? (error.problem?.errors as unknown as EngineError[])
        : [{ code: 'TemplateNotFound', message: error.title, parameterKey: null, askPrompt: null }];
      return { success: false, draft: null, errors, voucherId: null, voucherNo: null, wasAlreadyExecuted: false };
    }
    throw error;
  }
}

export const operationsApi = {
  listTemplates: async () => (await apiClient.get<TemplateSummaryDto[]>('/operations/templates')).data,

  preview: (templateId: string, input: OperationInput, year: string) =>
    asResult(apiClient.post<OperationResult>(`/operations/${templateId}/preview`, input, { params: { year } })),

  execute: (templateId: string, input: OperationInput & { clientRequestId: string; lineExtras?: DraftLineExtrasInput[]; aiTraceId?: string | null; userSentence?: string | null }, year: string) =>
    asResult(apiClient.post<OperationResult>(`/operations/${templateId}/execute`, input, { params: { year } })),

  /** فهم جمله با هوش مصنوعی (فاز ۲). خطای شبکه ⇒ «خاموش» تا روش قاعده‌ای ادامه دهد. */
  interpret: async (sentence: string, year: string): Promise<InterpretResult> => {
    try {
      return (await apiClient.post<InterpretResult>('/operations/interpret', { sentence }, { params: { year } })).data;
    } catch {
      return { enabled: false, provider: null, succeeded: false, message: null, templateId: null, confidence: null, voucherDate: null, answers: [], clarification: null };
    }
  },

  /** جزئیات قبلی این الگو (تفصیلی‌هایی که این واحد بیشتر استفاده کرده) برای چیپ‌های پیشنهاد. */
  suggestions: async (templateId: string, paramKey: string) =>
    (await apiClient.get<DetailSuggestion[]>(`/operations/templates/${templateId}/suggestions`, { params: { paramKey } })).data,

  composePreview: (input: ComposedVoucherInput & { sourceTemplateId?: string | null; hasAttachment?: boolean }, year: string) =>
    asResult(apiClient.post<OperationResult>('/operations/compose/preview', input, { params: { year } })),

  composeExecute: (
    input: ComposedVoucherInput & {
      sourceTemplateId: string | null;
      clientRequestId: string;
      userSentence?: string | null;
      answerSources?: OperationInput['answerSources'];
      aiConfirmed?: boolean;
      hasAttachment?: boolean;
    },
    year: string,
  ) =>
    asResult(apiClient.post<OperationResult>('/operations/compose/execute', input, { params: { year } })),
};

/** بدنهٔ preview/execute سوابق — همان بدنهٔ الگو با نام‌های `answers` و `description`. */
function historyBody(input: OperationInput & { clientRequestId?: string; lineExtras?: DraftLineExtrasInput[]; aiTraceId?: string | null; userSentence?: string | null }) {
  const { values, ...rest } = input;
  return { ...rest, answers: values, description: input.userSentence ?? null };
}

/** یادگیری از اسناد گذشته: پیشنهاد برای کاربر، ساخت سند، و کشف الگو برای ستاد. */
export const historyApi = {
  /** ۵۰۳ (قابلیت خاموش) یا هر خطای دیگر ⇒ فهرست خالی؛ به کاربر عادی خطا نشان داده نمی‌شود. */
  match: async (sentence: string): Promise<HistorySuggestion[]> => {
    try {
      const data = (await apiClient.post<HistorySuggestion[]>('/operations/history/match', { sentence })).data;
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },
  preview: (patternId: string, input: OperationInput & { userSentence?: string | null; aiTraceId?: string | null }, year: string) =>
    asResult(apiClient.post<OperationResult>(`/operations/history/${patternId}/preview`, historyBody(input), { params: { year } })),
  execute: (
    patternId: string,
    input: OperationInput & { clientRequestId: string; lineExtras?: DraftLineExtrasInput[]; aiTraceId?: string | null; userSentence?: string | null },
    year: string,
  ) => asResult(apiClient.post<OperationResult>(`/operations/history/${patternId}/execute`, historyBody(input), { params: { year } })),

  patterns: async (params: HistoryPatternFilters) =>
    (await apiClient.get<HistoryPatternPage>('/operations/history/patterns', { params })).data,
  rebuild: async (payload: { fromYear: number; toYear: number }) =>
    (await apiClient.post<HistoryRebuildResult>('/operations/history/patterns/rebuild', payload)).data,
  /** 409 = الگو دارد، 503 = اسکریپت پایگاه داده اجرا نشده؛ خطا با ProblemDetails پرتاب می‌شود. */
  remove: async (id: string) =>
    (await apiClient.post<{ count: number }>(`/operations/history/patterns/${id}/delete`)).data,
  /** حذف گروهی پیشنهادهای بدون الگو با فیلتر فعلی؛ ۴۰۹/۵۰۳ با ProblemDetails. */
  removeUncovered: async (filters: Pick<HistoryPatternFilters, 'fromYear' | 'toYear' | 'vahedType' | 'minCount' | 'search'>) =>
    (await apiClient.post<{ count: number; skippedCovered: number }>('/operations/history/patterns/delete-uncovered', filters)).data,
  toTemplate: async (id: string) =>
    (await apiClient.post<HistoryTemplateDraft>(`/operations/history/patterns/${id}/to-template`)).data,
};

/** 422 from create/update carries `errors: string[]` — returned as a result, not thrown. */
async function asWriteResult(request: Promise<{ data: TemplateWriteResult }>): Promise<TemplateWriteResult> {
  try {
    return (await request).data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 422 && Array.isArray(error.problem?.errors)) {
      return { success: false, id: null, errors: error.problem?.errors as unknown as string[] };
    }
    throw error;
  }
}

export const templateDesignApi = {
  list: async () => (await apiClient.get<TemplateDefinitionSummaryDto[]>('/operations/templates/definitions')).data,
  get: async (id: string) => (await apiClient.get<TemplateDefinitionDto>(`/operations/templates/${id}`)).data,
  validate: async (id: string | null, payload: TemplateWritePayload) =>
    (await apiClient.post<TemplateWriteResult>('/operations/templates/validate', { id, ...payload })).data,
  create: (payload: TemplateWritePayload) => asWriteResult(apiClient.post<TemplateWriteResult>('/operations/templates', payload)),
  update: (id: string, payload: TemplateWritePayload) =>
    asWriteResult(apiClient.post<TemplateWriteResult>(`/operations/templates/${id}/update`, payload)),
  setActive: async (id: string, isActive: boolean) => {
    await apiClient.post(`/operations/templates/${id}/set-active`, { isActive });
  },
};

/** سندهای پرتکرار واحد جاری. ثبت از همان preview/execute الگو انجام می‌شود. */
export const quickVoucherApi = {
  list: async () => (await apiClient.get<QuickVoucher[]>('/operations/quick')).data,
  /** 422 ⇒ `errors: string[]` به‌صورت نتیجه، نه استثنا. */
  create: async (payload: { templateId: string; title: string; values: Record<string, string | null> }) => {
    try {
      return (await apiClient.post<TemplateWriteResult>('/operations/quick', payload)).data;
    } catch (error) {
      if (error instanceof ApiError && error.status === 422 && Array.isArray(error.problem?.errors)) {
        return { success: false, id: null, errors: error.problem?.errors as unknown as string[] } satisfies TemplateWriteResult;
      }
      throw error;
    }
  },
  remove: async (id: string) => {
    await apiClient.post(`/operations/quick/${id}/delete`);
  },
};

/** سندهای من (نوار خانهٔ حسابیار) — `status` خالی = فقط شمارنده و آخرین برگشتی + همهٔ اقلام. */
export const myVouchersApi = {
  mine: async (year: string, status?: MyVoucherStatus) =>
    (await apiClient.get<MyVouchersResult>('/operations/mine', { params: { year, status } })).data,
  /** پاسخ ثبت‌کننده به حسابدار (حداکثر ۵۰۰ نویسه). */
  reply: async (executionId: string, message: string) =>
    (await apiClient.post<{ count: number }>(`/operations/mine/${executionId}/reply`, { message })).data,
};

/** «موضوع را برای حسابدار بفرستید» — درخواست عملیاتی که الگو ندارد. */
export const operationRequestsApi = {
  create: async (sentence: string) => (await apiClient.post<{ id: string }>('/operations/requests', { sentence })).data,
  list: async (status: 'open' | 'done') =>
    (await apiClient.get<OperationRequestItem[]>('/operations/requests', { params: { status } })).data,
  done: async (id: string, note: string | null) =>
    (await apiClient.post(`/operations/requests/${id}/done`, { note })).data,
};

/** صف بررسی حسابدار. ۴۰۳ برای غیربررسی‌کننده؛ خطای «سند خودتان» با detail فارسی از ProblemDetails. */
export const reviewApi = {
  list: async (params: { risk?: string; page: number; pageSize: number; year: string }) =>
    (await apiClient.get<ReviewPage>('/operations/reviews', { params })).data,
  detail: async (executionId: string) =>
    (await apiClient.get<ReviewDetail>(`/operations/reviews/${executionId}`)).data,
  approve: async (executionId: string) =>
    (await apiClient.post<{ count: number }>(`/operations/reviews/${executionId}/approve`)).data,
  approveBatch: async (executionIds: string[]) =>
    (await apiClient.post<{ count: number }>('/operations/reviews/approve-batch', { executionIds })).data,
  returnToSubmitter: async (executionId: string, payload: ReturnPayload) =>
    (await apiClient.post<{ count: number }>(`/operations/reviews/${executionId}/return`, payload)).data,
};
