/**
 * RFC 7807 error shape used by every failing response from Accounting.Api
 * (`application/problem+json`). There is no `{ succeeded, code, messages }`
 * envelope in this backend — errors are ProblemDetails, period.
 */
export interface ProblemDetails {
  status?: number;
  title?: string;
  detail?: string;
  instance?: string;
  traceId?: string;
  /**
   * Only present on 400 validation failures
   * (HttpValidationProblemDetails from ASP.NET Core model binding / FluentValidation).
   */
  errors?: Record<string, string[]>;
  /** ProblemDetails allows arbitrary extension members. */
  [extension: string]: unknown;
}
