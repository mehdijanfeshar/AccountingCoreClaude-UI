import type { ProblemDetails } from '../../types/problemDetails';

/**
 * Typed error thrown by the api client for every non-2xx response.
 * Always built from a ProblemDetails body (RFC 7807) — never from the old
 * Angular project's `{ succeeded, code, messages }` envelope, which this
 * backend does not use.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly title: string;
  readonly detail?: string;
  readonly traceId?: string;
  readonly instance?: string;
  /** Only populated for 400 HttpValidationProblemDetails responses. */
  readonly validationErrors?: Record<string, string[]>;

  constructor(status: number, problem: ProblemDetails | undefined, fallbackMessage: string) {
    const title = problem?.title ?? fallbackMessage;
    super(title);
    this.name = 'ApiError';
    this.status = status;
    this.title = title;
    this.detail = problem?.detail;
    this.traceId = problem?.traceId;
    this.instance = problem?.instance;
    this.validationErrors = problem?.errors;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isValidation(): boolean {
    return this.status === 400 && !!this.validationErrors;
  }
}
