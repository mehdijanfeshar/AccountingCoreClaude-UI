import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { FsRunStatementDto } from '../../../types/fsRun';
import { replaceVariables } from './narrativeVariables';

interface TiptapNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string }[];
  content?: TiptapNode[];
}

interface Props {
  contentJson: string | null;
  /** بدون اجرا (مثلاً پیش‌نمایش بدون داده) متغیرها همان‌طور که نوشته شده‌اند نمایش داده می‌شوند. */
  statements?: FsRunStatementDto[];
  linkedTemplateCode?: string | null;
  divisor: number;
}

/**
 * ح-۶ — نمایش فقط‌خواندنی سند Tiptap با جایگزینی متغیرها از Snapshot اجرا (همان قالب‌های خروجی Word).
 * فقط گره‌های StarterKit پشتیبانی می‌شوند؛ گره ناشناخته فرزندانش را نشان می‌دهد.
 */
export function NarrativeContent({ contentJson, statements, linkedTemplateCode = null, divisor }: Props) {
  if (!contentJson) return null;

  let doc: TiptapNode;
  try {
    doc = JSON.parse(contentJson) as TiptapNode;
  } catch {
    return (
      <Typography variant="body2" color="error">
        متن یادداشت قابل خواندن نیست.
      </Typography>
    );
  }

  const text = (s: string) => (statements ? replaceVariables(s, statements, linkedTemplateCode, divisor) : s);

  const inline = (nodes: TiptapNode[] | undefined): ReactNode[] =>
    (nodes ?? []).map((n, i) => {
      if (n.type === 'hardBreak') return <br key={i} />;
      if (n.type !== 'text') return null;
      let el: ReactNode = text(n.text ?? '');
      for (const m of n.marks ?? []) {
        if (m.type === 'bold') el = <strong>{el}</strong>;
        else if (m.type === 'italic') el = <em>{el}</em>;
        else if (m.type === 'underline') el = <u>{el}</u>;
        else if (m.type === 'strike') el = <s>{el}</s>;
      }
      return <span key={i}>{el}</span>;
    });

  const block = (n: TiptapNode, key: number): ReactNode => {
    switch (n.type) {
      case 'paragraph':
        return (
          <Typography key={key} variant="body2" component="p" sx={{ mb: 1, lineHeight: 2, textAlign: 'justify' }}>
            {inline(n.content)}
          </Typography>
        );
      case 'heading': {
        const level = Number(n.attrs?.level ?? 3);
        return (
          <Typography key={key} variant={level <= 2 ? 'subtitle1' : 'subtitle2'} sx={{ fontWeight: 700, mt: 1.5, mb: 0.5 }}>
            {inline(n.content)}
          </Typography>
        );
      }
      case 'bulletList':
      case 'orderedList':
        return (
          <Box key={key} component={n.type === 'bulletList' ? 'ul' : 'ol'} sx={{ my: 0.5, pr: 3 }}>
            {(n.content ?? []).map((li, i) => (
              <li key={i}>{(li.content ?? []).map(block)}</li>
            ))}
          </Box>
        );
      case 'blockquote':
        return (
          <Box key={key} sx={{ borderRight: 3, borderColor: 'divider', pr: 2, my: 1, color: 'text.secondary' }}>
            {(n.content ?? []).map(block)}
          </Box>
        );
      case 'horizontalRule':
        return <Box key={key} component="hr" sx={{ border: 0, borderTop: 1, borderColor: 'divider', my: 2 }} />;
      default:
        return <Box key={key}>{(n.content ?? []).map(block)}</Box>;
    }
  };

  return <Box>{(doc.content ?? []).map(block)}</Box>;
}
