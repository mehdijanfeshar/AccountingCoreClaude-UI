import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddCommentOutlinedIcon from '@mui/icons-material/AddCommentOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { PageHeader } from '../../../components/PageHeader';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { useSession } from '../../../lib/session/SessionContext';
import { toPersianDigits } from '../../../lib/format/numbers';
import { DraftPreview } from '../DraftPreview';
import { agentApi, type AgentMessage, type AgentProposal, type AgentStep } from './api';

/** پیام صفحه: پیام ذخیره‌شده + قدم‌های کار دستیار (فقط برای پیام‌های همین نشست). */
interface ChatMessage extends AgentMessage {
  steps?: AgentStep[];
  suggestManual?: boolean;
}

const EXAMPLES = [
  'امروز ۲ میلیون تومان از شرکت هجرت بابت فروش نقدی گرفتیم',
  'ماندهٔ صندوق چقدره؟',
  'دیروز ۵۰۰ هزار ریال هزینهٔ پذیرایی پرداخت شد',
];

/**
 * گفتگو با حسابیار (فاز ۶۵): کاربر کارش را می‌گوید؛ دستیار الگو را پیدا می‌کند، سؤال می‌پرسد، طرف حساب و مانده
 * را جستجو می‌کند و پیش‌نویس سند می‌سازد. دستیار هرگز ثبت نمی‌کند — «بررسی و ثبت» همان صفحهٔ حسابیار را با
 * جواب‌ها باز می‌کند و کاربر آنجا مرور و ثبت می‌کند (پیوست، تأیید برداشت هوش مصنوعی و کنترل ریسک همان‌جاست).
 */
export function AgentChatPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { financialYear } = useSession();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const status = useQuery({ queryKey: ['agent-status'], queryFn: agentApi.status, retry: false });
  const conversations = useQuery({ queryKey: ['agent-conversations'], queryFn: agentApi.conversations, retry: false, enabled: status.data?.enabled === true });

  const open = useMutation({
    mutationFn: agentApi.conversation,
    onSuccess: (c) => {
      setConversationId(c.id);
      setMessages(c.messages);
    },
  });

  const send = useMutation({
    mutationFn: (message: string) => agentApi.send(conversationId, message, financialYear),
    onMutate: (message) => {
      setMessages((m) => [...m, { role: 'user', text: message, proposal: null, createdAtUtc: new Date().toISOString() }]);
      setText('');
    },
    onSuccess: (r) => {
      if (r.conversationId) setConversationId(r.conversationId);
      setMessages((m) => [...m, { role: 'assistant', text: r.reply, proposal: r.proposal, steps: r.steps, suggestManual: r.suggestManual, createdAtUtc: new Date().toISOString() }]);
      void queryClient.invalidateQueries({ queryKey: ['agent-conversations'] });
    },
  });

  const remove = useMutation({
    mutationFn: agentApi.remove,
    onSuccess: (_, id) => {
      if (id === conversationId) startNew();
      void queryClient.invalidateQueries({ queryKey: ['agent-conversations'] });
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, send.isPending]);

  function startNew() {
    setConversationId(null);
    setMessages([]);
    send.reset();
  }

  function submit(message = text) {
    const m = message.trim();
    if (!m || send.isPending) return;
    send.mutate(m);
  }

  /** «بررسی و ثبت»: صفحهٔ حسابیار با همان الگو و جواب‌ها؛ آخرین پیام کاربر جملهٔ ثبت‌شده با سند است. */
  function review(proposal: AgentProposal, index: number) {
    const sentence = [...messages.slice(0, index)].reverse().find((m) => m.role === 'user')?.text ?? '';
    navigate('/assistant', { state: { agentProposal: proposal, sentence } });
  }

  /** پیش‌نویسی ساخته نشد ⇒ همان جملهٔ کاربر در صفحهٔ «ثبت سند با حسابیار» (روش فرم و قاعده‌ای). */
  function continueManually(index: number) {
    const sentence = [...messages.slice(0, index)].reverse().find((m) => m.role === 'user')?.text ?? '';
    navigate('/assistant', { state: { sentence } });
  }

  const disabled = status.data?.enabled === false;
  const lastProposalIndex = messages.reduce((last, m, i) => (m.proposal ? i : last), -1);

  return (
    <Box>
      <PageHeader
        eyebrow="حسابیار"
        icon={<ForumOutlinedIcon fontSize="small" />}
        accentColor="secondary"
        title="گفتگو با حسابیار"
        description="کارتان را با زبان خودتان بگویید؛ حسابیار سؤال می‌پرسد و پیش‌نویس سند را آماده می‌کند. ثبت همیشه با خود شماست."
        actions={
          <Stack direction="row" spacing={1}>
            <Button color="inherit" onClick={() => navigate('/assistant')}>ثبت سند با حسابیار</Button>
            <Button variant="contained" startIcon={<AddCommentOutlinedIcon />} onClick={startNew} disabled={disabled}>گفتگوی تازه</Button>
          </Stack>
        }
      />

      {status.error != null && <ErrorBanner error={status.error} />}
      {disabled && (
        <Alert severity="info" sx={{ mb: 2 }}>
          گفتگو با حسابیار در تنظیمات سرور خاموش است. می‌توانید از «ثبت سند با حسابیار» استفاده کنید.
        </Alert>
      )}
      {status.data?.enabled && !status.data.dataTools && (
        <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
          برای حفظ اطلاعات، نام طرف حساب‌ها و مانده‌ها به سرویس هوش مصنوعی بیرونی فرستاده نمی‌شود؛ پرسیدن مانده در این حالت ممکن نیست.
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <Typography variant="subtitle2" sx={{ px: 2, pt: 1.5, pb: 1, color: 'text.secondary' }}>گفتگوهای من</Typography>
            {conversations.isLoading && <LinearProgress />}
            {conversations.error != null && <Box sx={{ px: 1 }}><ErrorBanner error={conversations.error} /></Box>}
            <List dense sx={{ maxHeight: { xs: 180, md: 520 }, overflow: 'auto', py: 0 }}>
              {(conversations.data ?? []).map((c) => (
                <ListItemButton
                  key={c.id}
                  selected={c.id === conversationId}
                  onClick={() => open.mutate(c.id)}
                  sx={{ pr: 1 }}
                >
                  <ListItemText
                    primary={c.title}
                    secondary={toPersianDigits(new Date(c.updatedAtUtc).toLocaleDateString('fa-IR'))}
                    slotProps={{ primary: { noWrap: true } }}
                  />
                  <Tooltip title="حذف گفتگو">
                    <IconButton size="small" edge="end" aria-label="حذف گفتگو" onClick={(e) => { e.stopPropagation(); remove.mutate(c.id); }}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </ListItemButton>
              ))}
              {conversations.data?.length === 0 && (
                <Typography variant="body2" sx={{ px: 2, pb: 2, color: 'text.secondary' }}>هنوز گفتگویی ندارید.</Typography>
              )}
            </List>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 9 }}>
          <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 1.5, sm: 2.5 }, minHeight: 420, display: 'flex', flexDirection: 'column' }}>
            {open.isPending && <LinearProgress sx={{ mb: 2 }} />}
            {open.error != null && <ErrorBanner error={open.error} />}

            <Stack spacing={2} sx={{ flex: 1, mb: 2 }}>
              {messages.length === 0 && !open.isPending && (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Avatar sx={{ bgcolor: 'secondary.main', mx: 'auto', mb: 1.5 }}><AutoAwesomeOutlinedIcon /></Avatar>
                  <Typography variant="h3" component="p" sx={{ mb: 0.5 }}>سلام! چه کاری انجام شده؟</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>مثلاً:</Typography>
                  <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                    {EXAMPLES.map((e) => (
                      <Chip key={e} label={e} variant="outlined" onClick={() => submit(e)} disabled={disabled || send.isPending} />
                    ))}
                  </Stack>
                </Box>
              )}

              {messages.map((m, i) => (
                <Box key={i} sx={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-start' : 'flex-end' }}>
                  <Paper
                    elevation={0}
                    sx={{
                      px: 2, py: 1.25, maxWidth: { xs: '92%', sm: '78%' }, borderRadius: 3, whiteSpace: 'pre-wrap',
                      bgcolor: m.role === 'user' ? 'primary.main' : 'action.hover',
                      color: m.role === 'user' ? 'primary.contrastText' : 'text.primary',
                    }}
                  >
                    <Typography variant="body1">{m.text}</Typography>
                  </Paper>
                  {m.steps && m.steps.length > 0 && (
                    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.75, justifyContent: 'flex-end' }}>
                      {m.steps.map((s, j) => (
                        <Chip
                          key={j}
                          size="small"
                          variant="outlined"
                          color={s.succeeded ? 'default' : 'warning'}
                          icon={s.succeeded ? <CheckCircleOutlineIcon /> : <ErrorOutlineIcon />}
                          label={s.label}
                        />
                      ))}
                    </Stack>
                  )}
                  {m.suggestManual && !m.proposal && (
                    <Button size="small" variant="outlined" sx={{ mt: 1 }} onClick={() => continueManually(i)}>
                      ادامه در ثبت سند با حسابیار
                    </Button>
                  )}
                  {m.proposal?.preview.draft && (
                    <Paper variant="outlined" sx={{ width: '100%', maxWidth: 720, mt: 1.5, p: 2, borderRadius: 3, opacity: i === lastProposalIndex ? 1 : 0.6 }}>
                      <DraftPreview
                        embedded
                        draft={m.proposal.preview.draft}
                        templateTitle={m.proposal.templateTitle}
                        templateId={m.proposal.templateId}
                        info={{
                          plainText: m.proposal.preview.plainText ?? '',
                          warnings: m.proposal.preview.warnings ?? [],
                          risk: m.proposal.preview.risk ?? null,
                          controls: m.proposal.preview.controls ?? [],
                          basis: m.proposal.preview.basis ?? null,
                        }}
                      />
                      <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: 'flex-end', alignItems: 'center' }}>
                        {i !== lastProposalIndex && <Typography variant="caption" sx={{ color: 'text.secondary' }}>پیش‌نویس قدیمی‌تر</Typography>}
                        <Button variant="contained" onClick={() => review(m.proposal!, i)} disabled={i !== lastProposalIndex}>
                          بررسی و ثبت
                        </Button>
                      </Stack>
                    </Paper>
                  )}
                </Box>
              ))}

              {send.isPending && (
                <Box sx={{ alignSelf: 'flex-end', width: 200 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>حسابیار در حال بررسی…</Typography>
                  <LinearProgress />
                </Box>
              )}
              {send.error != null && <ErrorBanner error={send.error} />}
              <div ref={endRef} />
            </Stack>

            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end' }}>
              <TextField
                fullWidth
                multiline
                maxRows={4}
                placeholder="کارتان را بنویسید… (Enter = ارسال، Shift+Enter = خط تازه)"
                value={text}
                disabled={disabled}
                onChange={(e) => setText(e.target.value.slice(0, 1000))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
              <Button
                variant="contained"
                endIcon={<SendOutlinedIcon sx={{ transform: 'scaleX(-1)' }} />}
                onClick={() => submit()}
                disabled={disabled || send.isPending || !text.trim()}
                sx={{ flexShrink: 0, height: 56 }}
              >
                ارسال
              </Button>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
