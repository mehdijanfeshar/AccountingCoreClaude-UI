import { Component, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

/**
 * خطای رندر در صفحه‌های حسابیار به‌جای صفحهٔ سفید، پیام خطا را نشان می‌دهد (برای گزارش به توسعه‌دهنده).
 */
export class AssistantErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('حسابیار:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        <Typography variant="body1" sx={{ fontWeight: 700, mb: 1 }}>نمایش این صفحه با خطا روبه‌رو شد.</Typography>
        <Typography variant="body2" component="pre" dir="ltr" sx={{ whiteSpace: 'pre-wrap', fontSize: 12, mb: 1 }}>
          {this.state.error.message}
          {'\n'}
          {this.state.error.stack?.split('\n').slice(0, 6).join('\n')}
        </Typography>
        <Button size="small" variant="outlined" onClick={() => this.setState({ error: null })}>تلاش دوباره</Button>
      </Alert>
    );
  }
}
