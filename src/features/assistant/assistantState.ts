import { newClientId } from '../../lib/ids';
import type { EngineError, OperationResult, TemplateParameterDto, TemplateSummaryDto, VoucherDraft } from './types';

/**
 * حسابیار's whole conversation as one reducer.
 *
 * Why a reducer and not component state: every user interaction here is a small serialisable
 * {@link AssistantAction}. In phase 3 the LLM agent drives the same screen by emitting the very same
 * actions (`selectTemplate`, `answer`, …) — it never builds a voucher itself; the server engine
 * does, from the template, and the user still presses «ثبت». Keeping the flow in one pure function
 * is what makes "the agent fills the form" and "the user fills the form" the same code path.
 */

/** Pseudo parameter key for the voucher date question (asked first, pre-answered with today). */
export const DATE_KEY = '__voucherDate';

export type AssistantPhase = 'pick' | 'ask' | 'edit' | 'done';

export interface Answer {
  /** Wire value: Latin digits for amounts, Guid for تفصیلی, `YYYYMMDD` Jalali for dates, raw text otherwise. */
  value: string;
  /** What the user sees in their chat bubble. */
  label: string;
  /** Read from the user's own sentence rather than typed as an answer — shown so they can check it. */
  fromSentence?: boolean;
  /** برداشت هوش مصنوعی (فاز ۲) — جدا نشان داده می‌شود تا کاربر بداند چه کسی این را فهمیده است. */
  fromAi?: boolean;
  /** از آخرین سندی که کاربر با همین الگو زد («تکرار» / «مثل دفعهٔ قبل»). */
  fromRecent?: boolean;
}

export interface ExecutionOutcome {
  voucherId: string;
  voucherNo: string;
  wasAlreadyExecuted: boolean;
}

export interface AssistantState {
  phase: AssistantPhase;
  template: TemplateSummaryDto | null;
  answers: Record<string, Answer>;
  skipped: Record<string, true>;
  /** A question the user (or a server error) re-opened; it wins over "next unanswered". */
  reopenedKey: string | null;
  /** Server messages per parameter key — shown under the re-asked question. */
  paramErrors: Record<string, string>;
  /** Errors not tied to a parameter (usually a template definition problem). */
  generalErrors: EngineError[];
  draft: VoucherDraft | null;
  /** Seed for the full editor: the template draft, or null for a blank manual voucher. */
  editorSeed: VoucherDraft | null;
  /** شرح سند دستی از جملهٔ کاربر («درب برای بیمارستان») وقتی هیچ الگویی نخورد. */
  manualDescription: string;
  /** پیشنهاد تاریخ سند (امروز یا پایان سال مالی) — مقدار اولیهٔ کادر سؤال تاریخ، نه جواب. */
  defaultDate: Answer | null;
  /** One per conversation — a double click on «ثبت» returns the first voucher, never a second. */
  clientRequestId: string;
  outcome: ExecutionOutcome | null;
}

export type AssistantAction =
  | { type: 'selectTemplate'; template: TemplateSummaryDto; today: Answer }
  | { type: 'startManual'; description?: string }
  | { type: 'answer'; key: string; answer: Answer }
  /** Answers read from the request sentence; never overwrites one the user already gave. */
  | { type: 'prefill'; templateId: string; answers: Record<string, Answer> }
  | { type: 'skip'; key: string }
  | { type: 'reopen'; key: string }
  | { type: 'previewResult'; result: OperationResult }
  | { type: 'openEditor' }
  | { type: 'backToConversation' }
  | { type: 'executed'; result: OperationResult }
  | { type: 'reset' };

export function initialAssistantState(): AssistantState {
  return {
    phase: 'pick',
    template: null,
    answers: {},
    skipped: {},
    reopenedKey: null,
    paramErrors: {},
    generalErrors: [],
    draft: null,
    editorSeed: null,
    manualDescription: '',
    defaultDate: null,
    clientRequestId: newClientId(),
    outcome: null,
  };
}

export function orderedParameters(template: TemplateSummaryDto | null): TemplateParameterDto[] {
  return template ? [...template.parameters].sort((a, b) => a.sortOrder - b.sortOrder) : [];
}

/**
 * کلید جواب «تاریخ سند»: اگر الگو سؤال تاریخ دارد (اولین پارامتر تاریخ، معمولاً `date1`) همان سؤال تاریخ سند
 * است و سؤال جدای «سند به چه تاریخی ثبت شود؟» پرسیده نمی‌شود؛ وگرنه {@link DATE_KEY}. سرور هم همین را
 * اعمال می‌کند (TemplateVoucherDate).
 */
export function voucherDateKey(template: TemplateSummaryDto | null): string {
  return orderedParameters(template).find((p) => p.type === 4)?.key ?? DATE_KEY;
}

/** The question currently on screen, or null when everything needed has been answered. */
export function currentQuestionKey(state: AssistantState): string | null {
  if (state.phase !== 'ask') return null;
  if (state.reopenedKey) return state.reopenedKey;
  if (voucherDateKey(state.template) === DATE_KEY && !state.answers[DATE_KEY]) return DATE_KEY;
  const next = orderedParameters(state.template).find((p) => !state.answers[p.key] && !state.skipped[p.key]);
  return next?.key ?? null;
}

export function isReadyForPreview(state: AssistantState): boolean {
  return state.phase === 'ask' && currentQuestionKey(state) === null;
}

export function assistantReducer(state: AssistantState, action: AssistantAction): AssistantState {
  switch (action.type) {
    case 'selectTemplate':
      return {
        ...initialAssistantState(),
        clientRequestId: state.clientRequestId,
        phase: 'ask',
        template: action.template,
        // تاریخ سند همیشه پرسیده می‌شود (مگر از جمله برداشت شود)؛ پیش‌فرض فقط در کادر جواب پیشنهاد می‌شود.
        answers: {},
        defaultDate: action.today,
      };

    case 'startManual':
      return {
        ...initialAssistantState(),
        clientRequestId: state.clientRequestId,
        phase: 'edit',
        editorSeed: null,
        manualDescription: action.description ?? '',
      };

    case 'answer': {
      const paramErrors = { ...state.paramErrors };
      delete paramErrors[action.key];
      const skipped = { ...state.skipped };
      delete skipped[action.key];
      return {
        ...state,
        answers: { ...state.answers, [action.key]: action.answer },
        skipped,
        paramErrors,
        reopenedKey: null,
        draft: null,
      };
    }

    case 'prefill': {
      // The lookup is async: ignore it if the user has meanwhile switched to another operation.
      if (state.phase !== 'ask' || state.template?.id !== action.templateId) return state;
      const answers = { ...state.answers };
      const dateKey = voucherDateKey(state.template);
      const incoming = { ...action.answers };
      // تاریخ سندِ برداشت‌شده از جمله، وقتی الگو سؤال تاریخ دارد، جواب همان سؤال است.
      if (dateKey !== DATE_KEY && incoming[DATE_KEY]) {
        incoming[dateKey] ??= incoming[DATE_KEY];
        delete incoming[DATE_KEY];
      }
      for (const [key, answer] of Object.entries(incoming)) {
        // The date question starts pre-answered with the default date — a date from the sentence wins over it.
        // جوابی که خود کاربر داده (نه برداشت از جمله) هرگز بازنویسی نمی‌شود؛ برداشت هوش مصنوعی بر برداشت قاعده‌ای مقدم است.
        const current = answers[key];
        if (!current || (current.fromSentence && !current.fromAi && answer.fromAi)) {
          answers[key] = answer;
        }
      }
      return { ...state, answers, draft: null };
    }

    case 'skip': {
      const answers = { ...state.answers };
      delete answers[action.key];
      return { ...state, answers, skipped: { ...state.skipped, [action.key]: true }, reopenedKey: null, draft: null };
    }

    case 'reopen':
      return { ...state, reopenedKey: action.key, draft: null };

    case 'previewResult': {
      const { result } = action;
      if (result.success) {
        return { ...state, draft: result.draft, paramErrors: {}, generalErrors: [] };
      }
      // An error naming one of this template's parameters becomes that question asked again —
      // exactly what the agent will do with the same error in phase 3.
      const keys = new Set([DATE_KEY, ...orderedParameters(state.template).map((p) => p.key)]);
      const paramErrors: Record<string, string> = {};
      const generalErrors: EngineError[] = [];
      for (const error of result.errors) {
        const key = error.parameterKey === 'voucherDate' ? voucherDateKey(state.template) : error.parameterKey;
        if (key && keys.has(key)) paramErrors[key] ??= error.message;
        else generalErrors.push(error);
      }
      const firstKey = orderedParameters(state.template).find((p) => paramErrors[p.key])?.key
        ?? (paramErrors[DATE_KEY] ? DATE_KEY : null);
      return { ...state, draft: null, paramErrors, generalErrors, reopenedKey: firstKey };
    }

    case 'openEditor':
      return { ...state, phase: 'edit', editorSeed: state.draft };

    case 'backToConversation':
      return { ...state, phase: state.template ? 'ask' : 'pick' };

    case 'executed':
      if (!action.result.success || !action.result.voucherId) return state;
      return {
        ...state,
        phase: 'done',
        outcome: {
          voucherId: action.result.voucherId,
          voucherNo: action.result.voucherNo ?? '',
          wasAlreadyExecuted: action.result.wasAlreadyExecuted,
        },
      };

    case 'reset':
      return initialAssistantState();
  }
}
