import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import RedoIcon from '@mui/icons-material/Redo';
import TitleIcon from '@mui/icons-material/Title';
import UndoIcon from '@mui/icons-material/Undo';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { toLatinDigits, toPersianDigits } from '../../../lib/format/numbers';
import { FS_ROW_TYPE, FS_STATEMENT_TYPE_NOTE, type FsFrameworkValue } from '../../../types/fsTemplate';
import type { FsNarrativeDto } from '../../../types/fsNarrative';
import { FS_RUN_STATE_META } from '../../../types/fsRun';
import { fsNarrativesApi, fsRunsApi, fsTemplatesApi } from '../api';
import { AMOUNT_UNITS } from '../FsStatementSheet';
import { NarrativeContent } from './NarrativeContent';

interface Props {
  framework: FsFrameworkValue;
  year: string;
  /** null = یادداشت تازه. */
  narrative: FsNarrativeDto | null;
  /** محتوای جایگزین (بازگردانی نسخهٔ قبلی). */
  initialContent?: string | null;
  readOnly: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * ح-۶ — ویرایشگر یادداشت توضیحی (Tiptap، سند منبع §۹ و §۱۲-۳): متن غنی، درج متغیر از ردیف‌های یک اجرای همان
 * سال، و پیش‌نمایش زنده با اعداد آن اجرا. هر ذخیره یک نسخهٔ تازه می‌سازد.
 */
export function FsNarrativeEditorDialog({ framework, year, narrative, initialContent, readOnly, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(narrative?.titleFa ?? '');
  const [linked, setLinked] = useState(narrative?.linkedTemplateCode ?? '');
  const [responsible, setResponsible] = useState(narrative?.responsibleUserId ?? '');
  const [runId, setRunId] = useState('');
  const [divisor, setDivisor] = useState(1_000_000);
  const [variable, setVariable] = useState('');
  const [previewJson, setPreviewJson] = useState<string | null>(initialContent ?? narrative?.contentJson ?? null);

  const content = useMemo(() => {
    const raw = initialContent ?? narrative?.contentJson;
    if (!raw) return '';
    try {
      return JSON.parse(raw) as object;
    } catch {
      return '';
    }
  }, [initialContent, narrative]);

  const editor = useEditor({
    extensions: [StarterKit],
    content,
    editable: !readOnly,
    onUpdate: ({ editor: e }) => setPreviewJson(JSON.stringify(e.getJSON())),
  });

  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive('bold') ?? false,
      italic: e?.isActive('italic') ?? false,
      underline: e?.isActive('underline') ?? false,
      heading: e?.isActive('heading', { level: 3 }) ?? false,
      bullet: e?.isActive('bulletList') ?? false,
      ordered: e?.isActive('orderedList') ?? false,
      quote: e?.isActive('blockquote') ?? false,
    }),
  });

  const templatesQuery = useQuery({ queryKey: ['fs-templates', 'narrative', framework], queryFn: () => fsTemplatesApi.list(framework) });
  const noteTemplates = (templatesQuery.data ?? []).filter((t) => t.statementType === FS_STATEMENT_TYPE_NOTE);

  const runsQuery = useQuery({ queryKey: ['fs-runs', 'narrative', year], queryFn: () => fsRunsApi.list(year) });
  const runs = (runsQuery.data ?? []).filter((r) => r.framework === framework);
  const effectiveRunId = runId || runs[0]?.id || '';
  const runQuery = useQuery({ queryKey: ['fs-run', effectiveRunId], queryFn: () => fsRunsApi.get(effectiveRunId), enabled: !!effectiveRunId });
  const statements = runQuery.data?.statements;

  const variableOptions = useMemo(
    () =>
      (statements ?? []).flatMap((s) =>
        s.rows
          .filter((r) => r.rowType === FS_ROW_TYPE.Account || r.rowType === FS_ROW_TYPE.Formula || r.rowType === FS_ROW_TYPE.External)
          .map((r) => ({ value: `{{${s.templateCode}/${r.code}}}`, label: `${s.titleFa} — ${r.titleFa ?? r.code}` })),
      ),
    [statements],
  );

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        titleFa: title.trim(),
        linkedTemplateCode: linked || null,
        responsibleUserId: toLatinDigits(responsible).trim() || null,
        contentJson: editor && !editor.isEmpty ? JSON.stringify(editor.getJSON()) : null,
      };
      const id = narrative?.id ?? (await fsNarrativesApi.create({ framework, year, ...payload }));
      await fsNarrativesApi.save(id, payload);
    },
    onSuccess: onSaved,
  });

  const tool = (label: string, icon: React.ReactNode, on: boolean, run: () => void) => (
    <Tooltip title={label}>
      <span>
        <IconButton size="small" color={on ? 'primary' : 'default'} disabled={readOnly || !editor} onClick={run}>
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );

  return (
    <Dialog open onClose={save.isPending ? undefined : onClose} fullWidth maxWidth="lg">
      <DialogTitle>{narrative ? `یادداشت «${narrative.titleFa}»` : 'یادداشت توضیحی تازه'}</DialogTitle>
      <DialogContent>
        {save.isError && <ErrorBanner error={save.error} />}
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, md: 5 }}>
            <TextField label="عنوان" fullWidth required value={title} disabled={readOnly} onChange={(e) => setTitle(e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              select
              fullWidth
              label="همراه یادداشت عددی"
              value={linked}
              disabled={readOnly}
              onChange={(e) => setLinked(e.target.value)}
              helperText="خالی = یادداشت متنی مستقل (تاریخچه، مبنا، رویه‌ها)"
            >
              <MenuItem value="">— مستقل —</MenuItem>
              {noteTemplates.map((t) => (
                <MenuItem key={t.id} value={t.code}>
                  {t.titleFa} ({t.code})
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField label="کد کاربری مسئول" fullWidth value={responsible} disabled={readOnly} onChange={(e) => setResponsible(e.target.value.slice(0, 10))} />
          </Grid>

          <Grid size={{ xs: 12, md: 7 }}>
            <Paper variant="outlined" sx={{ borderRadius: 2 }}>
              <Stack direction="row" spacing={0.25} sx={{ p: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                {tool('پررنگ', <FormatBoldIcon fontSize="small" />, active?.bold ?? false, () => editor?.chain().focus().toggleBold().run())}
                {tool('کج', <FormatItalicIcon fontSize="small" />, active?.italic ?? false, () => editor?.chain().focus().toggleItalic().run())}
                {tool('زیرخط', <FormatUnderlinedIcon fontSize="small" />, active?.underline ?? false, () => editor?.chain().focus().toggleUnderline().run())}
                {tool('عنوان', <TitleIcon fontSize="small" />, active?.heading ?? false, () => editor?.chain().focus().toggleHeading({ level: 3 }).run())}
                {tool('فهرست', <FormatListBulletedIcon fontSize="small" />, active?.bullet ?? false, () => editor?.chain().focus().toggleBulletList().run())}
                {tool('فهرست شماره‌دار', <FormatListNumberedIcon fontSize="small" />, active?.ordered ?? false, () => editor?.chain().focus().toggleOrderedList().run())}
                {tool('نقل‌قول', <FormatQuoteIcon fontSize="small" />, active?.quote ?? false, () => editor?.chain().focus().toggleBlockquote().run())}
                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                {tool('بازگردانی', <UndoIcon fontSize="small" />, false, () => editor?.chain().focus().undo().run())}
                {tool('انجام دوباره', <RedoIcon fontSize="small" />, false, () => editor?.chain().focus().redo().run())}
                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                <TextField
                  select
                  size="small"
                  label="درج متغیر"
                  value={variable}
                  disabled={readOnly || variableOptions.length === 0}
                  onChange={(e) => {
                    editor?.chain().focus().insertContent(e.target.value).run();
                    setVariable('');
                  }}
                  sx={{ minWidth: 200, maxWidth: 280 }}
                >
                  {variableOptions.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              <Divider />
              <Box
                dir="rtl"
                sx={{
                  p: 2,
                  minHeight: 320,
                  '& .tiptap': { outline: 'none', minHeight: 300, lineHeight: 2 },
                  '& .tiptap p': { my: 0.5 },
                  '& .tiptap ul, & .tiptap ol': { pr: 3 },
                  '& .tiptap blockquote': { borderRight: 3, borderColor: 'divider', pr: 2, mr: 0, color: 'text.secondary' },
                }}
              >
                <EditorContent editor={editor} />
              </Box>
            </Paper>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              متغیر: <span dir="ltr">{'{{A01}}'}</span> مبلغ جاری، <span dir="ltr">{'{{A01.prior}}'}</span> سال قبل،{' '}
              <span dir="ltr">{'{{A01.change}}'}</span> تغییر، <span dir="ltr">{'{{A01.change%}}'}</span> درصد تغییر؛ با کد قالب:{' '}
              <span dir="ltr">{'{{BS/A01}}'}</span>. مقدار هنگام نمایش از اعداد همان اجرا گرفته می‌شود.
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, md: 5 }}>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <TextField select size="small" label="پیش‌نمایش با اجرا" value={effectiveRunId} onChange={(e) => setRunId(e.target.value)} sx={{ flex: 1 }}>
                {runs.map((r) => (
                  <MenuItem key={r.id} value={r.id}>
                    اجرای {toPersianDigits(r.runNo)} · {FS_RUN_STATE_META[r.state]?.label ?? ''}
                  </MenuItem>
                ))}
              </TextField>
              <TextField select size="small" label="واحد مبلغ" value={divisor} onChange={(e) => setDivisor(Number(e.target.value))} sx={{ width: 140 }}>
                {AMOUNT_UNITS.map((u) => (
                  <MenuItem key={u.value} value={u.value}>
                    {u.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, minHeight: 320, bgcolor: 'background.default' }}>
              {title && (
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  {title}
                </Typography>
              )}
              {runs.length === 0 && (
                <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
                  برای سال {toPersianDigits(year)} اجرایی نیست؛ متغیرها بدون مقدار نشان داده می‌شوند.
                </Typography>
              )}
              <NarrativeContent contentJson={previewJson} statements={statements} linkedTemplateCode={linked || null} divisor={divisor} />
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={save.isPending}>
          {readOnly ? 'بستن' : 'انصراف'}
        </Button>
        {!readOnly && (
          <Button variant="contained" disabled={!title.trim() || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'در حال ذخیره…' : 'ذخیره (نسخهٔ تازه)'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
