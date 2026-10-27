import { apiClient } from '../../../lib/api/client';
import type { OperationResult } from '../types';

// ─────────── گفتگو با حسابیار (فاز ۶۵، DDL 087) ───────────

export interface AgentStatus {
  enabled: boolean;
  provider: string | null;
  model: string | null;
  /** جستجوی طرف حساب و مانده برای دستیار فعال است. */
  dataTools: boolean;
}

/** ParameterType سرور: 1 مبلغ، 2 تفصیلی، 3 متن، 4 تاریخ، 5 گزینه. */
export interface AgentProposalAnswer {
  key: string;
  title: string;
  type: number;
  /** مبلغ ریال، تاریخ شمسی YYYYMMDD، شناسهٔ تفصیلی، مقدار گزینه، متن. */
  value: string;
  display: string;
}

export interface AgentProposal {
  templateId: string;
  templateCode: string;
  templateTitle: string;
  /** شمسی YYYYMMDD */
  voucherDate: string | null;
  answers: AgentProposalAnswer[];
  preview: OperationResult;
  aiTraceId: string | null;
}

export interface AgentStep {
  tool: string;
  label: string;
  succeeded: boolean;
}

export interface AgentChatResult {
  enabled: boolean;
  provider: string | null;
  conversationId: string | null;
  succeeded: boolean;
  reply: string;
  proposal: AgentProposal | null;
  steps: AgentStep[];
  /** پیش‌نویسی ساخته نشد (یا سرویس پاسخ نداد) ⇒ دکمهٔ «ادامه در ثبت سند با حسابیار». */
  suggestManual?: boolean;
}

export interface AgentConversationSummary {
  id: string;
  title: string;
  updatedAtUtc: string;
}

export interface AgentMessage {
  role: 'user' | 'assistant';
  text: string;
  proposal: AgentProposal | null;
  createdAtUtc: string;
}

export interface AgentConversation {
  id: string;
  title: string;
  messages: AgentMessage[];
}

export const agentApi = {
  status: () => apiClient.get<AgentStatus>('/operations/agent/status').then((r) => r.data),
  send: (conversationId: string | null, message: string, year: string) =>
    apiClient.post<AgentChatResult>('/operations/agent/messages', { conversationId, message }, { params: { year } }).then((r) => r.data),
  conversations: () => apiClient.get<AgentConversationSummary[]>('/operations/agent/conversations').then((r) => r.data),
  conversation: (id: string) => apiClient.get<AgentConversation>(`/operations/agent/conversations/${id}`).then((r) => r.data),
  remove: (id: string) => apiClient.post(`/operations/agent/conversations/${id}/delete`).then(() => undefined),
};

// ─────────── سنجش هوش مصنوعی (DDL 088، قابلیت ai.evaluate) ───────────

export interface AiGoldenCase {
  id: string;
  sentence: string;
  /** null = هیچ الگویی نباید انتخاب شود. */
  expectedTemplateCode: string | null;
  expectedAnswers: Record<string, string>;
  note: string | null;
  isActive: boolean;
  sourceExecutionId: string | null;
  createdAtUtc: string;
}

export interface AiGoldenCaseInput {
  sentence: string;
  expectedTemplateCode: string | null;
  expectedAnswers: Record<string, string>;
  note: string | null;
  isActive: boolean;
}

export type AiEvalKind = 'golden' | 'shadow';

export interface AiEvalRun {
  id: string;
  kind: AiEvalKind;
  provider: string;
  model: string | null;
  promptVersion: string;
  total: number;
  templateHits: number;
  answerTotal: number;
  answerHits: number;
  failures: number;
  avgLatencyMs: number;
  createdAtUtc: string;
  createdBy: string;
}

export interface AiEvalDiff {
  key: string;
  expected: string | null;
  actual: string | null;
}

export interface AiEvalItem {
  id: string;
  goldenCaseId: string | null;
  executionId: string | null;
  maskedSentence: string;
  expectedTemplateCode: string | null;
  actualTemplateCode: string | null;
  templateOk: boolean;
  answersExpected: number;
  answersOk: number;
  diffs: AiEvalDiff[];
  latencyMs: number;
  error: string | null;
}

export interface AiEvalRunDetail {
  run: AiEvalRun;
  items: AiEvalItem[];
}

export const aiEvalApi = {
  golden: () => apiClient.get<AiGoldenCase[]>('/operations/ai-eval/golden').then((r) => r.data),
  createGolden: (input: AiGoldenCaseInput) => apiClient.post<AiGoldenCase>('/operations/ai-eval/golden', input).then((r) => r.data),
  updateGolden: (id: string, input: AiGoldenCaseInput) =>
    apiClient.post<AiGoldenCase>(`/operations/ai-eval/golden/${id}/update`, input).then((r) => r.data),
  removeGolden: (id: string) => apiClient.post(`/operations/ai-eval/golden/${id}/delete`).then(() => undefined),
  importGolden: (take: number, allUnits: boolean) =>
    apiClient.post<number>('/operations/ai-eval/golden/import', { take, allUnits }).then((r) => r.data),
  run: (kind: AiEvalKind, take: number, allUnits: boolean, year: string) =>
    apiClient.post<AiEvalRunDetail>('/operations/ai-eval/runs', { kind, take, allUnits }, { params: { year }, timeout: 120_000 }).then((r) => r.data),
  runs: () => apiClient.get<AiEvalRun[]>('/operations/ai-eval/runs').then((r) => r.data),
  runDetail: (id: string) => apiClient.get<AiEvalRunDetail>(`/operations/ai-eval/runs/${id}`).then((r) => r.data),
};
