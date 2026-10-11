import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import GlobalStyles from '@mui/material/GlobalStyles';

/**
 * محتوای چاپی، بیرون از قالب برنامه (مستقیم در `body`) — هنگام چاپ کل `#root` پنهان می‌شود و فقط
 * همین می‌ماند؛ روی صفحه دیده نمی‌شود.
 *
 * چرا بیرون از قالب: چاپ از داخل `main` (کنار منوی کناری پنهان‌شده، در چیدمان RTL و flex) روی کاغذ
 * جابه‌جا و از یک طرف بریده می‌شد. خارج از `#root` هیچ چیدمان والدی روی برگه اثر ندارد.
 */
export function PrintPortal({ children }: { children: ReactNode }) {
  return createPortal(
    <>
      <GlobalStyles
        styles={{
          '@page': { size: 'A4 portrait', margin: '12mm 10mm' },
          '.print-portal': { display: 'none' },
          '@media print': {
            'html, body': { margin: 0, padding: 0, background: '#fff', width: 'auto', overflow: 'visible' },
            '#root': { display: 'none !important' },
            '.print-portal': { display: 'block', direction: 'rtl', width: '100%' },
          },
        }}
      />
      <div className="print-portal">{children}</div>
    </>,
    document.body,
  );
}
