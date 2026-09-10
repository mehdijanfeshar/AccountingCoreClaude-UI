import { ApiError } from '../lib/api/apiError';

interface ErrorBannerProps {
  error: unknown;
}

/**
 * Renders any error thrown by the api client. Always assumes the
 * ProblemDetails shape (title/detail/traceId) — never the old Angular
 * envelope (`{ succeeded, messages }`).
 */
export function ErrorBanner({ error }: ErrorBannerProps) {
  if (error instanceof ApiError) {
    return (
      <div role="alert" className="error-banner">
        <strong>{error.title}</strong>
        {error.detail && <p>{error.detail}</p>}
        {error.isValidation && error.validationErrors && (
          <ul>
            {Object.entries(error.validationErrors).map(([field, messages]) => (
              <li key={field}>
                <strong>{field}:</strong> {messages.join('، ')}
              </li>
            ))}
          </ul>
        )}
        {error.traceId && <small>شناسه پیگیری: {error.traceId}</small>}
      </div>
    );
  }

  const message = error instanceof Error ? error.message : 'خطای ناشناخته رخ داد.';
  return (
    <div role="alert" className="error-banner">
      <strong>{message}</strong>
    </div>
  );
}
