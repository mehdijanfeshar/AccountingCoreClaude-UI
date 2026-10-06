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

  execute: (templateId: string, input: OperationInput & { clientRequestId: string; lineExtras?: DraftLineExtrasInput[] }, year: string) =>
    asResult(apiClient.post<OperationResult>(`/operations/${templateId}/execute`, input, { params: { year } })),

  /** فهم جمله با هوش مصنوعی (فاز ۲). خطای شبکه ⇒ «خاموش» تا روش قاعده‌ای ادامه دهد. */
  interpret: async (sentence: string, year: string): Promise<InterpretResult> => {
    try {
      return (await apiClient.post<InterpretResult>('/operations/interpret', { sentence }, { params: { year } })).data;
    } catch {
      return { enabled: false, provider: null, succeeded: false, message: null, templateId: null, confidence: null, voucherDate: null, answers: [], clarification: null };
    }
  },

  composePreview: (input: ComposedVoucherInput, year: string) =>
    asResult(apiClient.post<OperationResult>('/operations/compose/preview', input, { params: { year } })),

  composeExecute: (input: ComposedVoucherInput & { sourceTemplateId: string | null; clientRequestId: string }, year: string) =>
    asResult(apiClient.post<OperationResult>('/operations/compose/execute', input, { params: { year } })),
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
