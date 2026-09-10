import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { ApiError } from '../lib/api/apiError';

interface ErrorBannerProps {
  error: unknown;
}

/**
 * Renders any error thrown by the api client as an MUI `Alert`. Always
 * assumes the ProblemDetails shape (title/detail/traceId) — never the old
 * Angular envelope (`{ succeeded, messages }`).
 */
export function ErrorBanner({ error }: ErrorBannerProps) {
  if (error instanceof ApiError) {
    return (
      <Alert severity="error" role="alert" sx={{ mb: 2 }}>
        <AlertTitle>{error.title}</AlertTitle>
        {error.detail && <Typography variant="body2">{error.detail}</Typography>}
        {error.isValidation && error.validationErrors && (
          <Box component="ul" sx={{ m: '8px 0 0', pr: 2.5 }}>
            {Object.entries(error.validationErrors).map(([field, messages]) => (
              <li key={field}>
                <strong>{field}:</strong> {messages.join('، ')}
              </li>
            ))}
          </Box>
        )}
        {error.traceId && (
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
            شناسه پیگیری: {error.traceId}
          </Typography>
        )}
      </Alert>
    );
  }

  const message = error instanceof Error ? error.message : 'خطای ناشناخته رخ داد.';
  return (
    <Alert severity="error" role="alert" sx={{ mb: 2 }}>
      {message}
    </Alert>
  );
}
