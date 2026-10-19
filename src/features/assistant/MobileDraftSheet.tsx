import { useRef, useState, type Dispatch, type TouchEvent } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { formatThousands, toPersianDigits } from '../../lib/format/numbers';
import { AnswerComposer, questionProgress } from './ConversationFooter';
import { DraftPreview, RiskChip, draftAmount, type DraftInfo } from './DraftPreview';
import { orderedParameters, type AssistantAction, type AssistantState } from './assistantState';
import type { VoucherDraft } from './types';

interface MobileDraftSheetProps {
  state: AssistantState;
  dispatch: Dispatch<AssistantAction>;
  draft: VoucherDraft | null;
  info: DraftInfo | null;
  loading?: boolean;
  actions?: { onSubmit: () => void; onEditFull: () => void; submitting: boolean };
}

/**
 * موبایل (xs): برگهٔ پایینی با دستگیره — «پیش‌نویس سند»، مبلغ، نشان «تراز ✓» و «N هشدار»، «N از M سؤال · برای دیدن سند بالا بکشید»
 * و کادر جواب داخل خود برگه. کشیدن به بالا (یا زدن دستگیره) همان DraftPreview کامل را در Drawer باز می‌کند.
 * تا وقتی همهٔ سؤال‌های لازم جواب داده نشده، سرور پیش‌نویسی نمی‌سازد؛ پس مبلغ از جواب کاربر می‌آید و نشان تراز نیست.
 */
export function MobileDraftSheet({ state, dispatch, draft, info, loading, actions }: MobileDraftSheetProps) {
  const [open, setOpen] = useState(false);
  const touchY = useRef<number | null>(null);
  const { done, total } = questionProgress(state);

  const amountParam = orderedParameters(state.template).find((p) => p.type === 1);
  const answeredAmount = amountParam ? Number(state.answers[amountParam.key]?.value ?? 0) : 0;
  const amount = draft ? draftAmount(draft) : answeredAmount;
  const balanced = draft ? draft.totalDebit === draft.totalCredit : false;
  const warnings = info?.warnings.length ?? 0;

  function onTouchStart(e: TouchEvent) {
    touchY.current = e.touches[0]?.clientY ?? null;
  }
  function onTouchEnd(e: TouchEvent) {
    const start = touchY.current;
    touchY.current = null;
    const end = e.changedTouches[0]?.clientY;
    if (start !== null && end !== undefined && start - end > 30) setOpen(true);
  }

  return (
    <>
      <Paper
        elevation={8}
        sx={{ position: 'fixed', insetInline: 0, bottom: 0, zIndex: (t) => t.zIndex.appBar, borderTopLeftRadius: 20, borderTopRightRadius: 20, px: 2, pb: 1.5 }}
      >
        <ButtonBase
          onClick={() => setOpen(true)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          aria-label="باز کردن پیش‌نویس سند"
          sx={{ display: 'block', width: '100%', textAlign: 'start', pt: 1 }}
        >
          <Box sx={{ width: 40, height: 5, borderRadius: 3, bgcolor: 'divider', mx: 'auto', mb: 1 }} />
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>پیش‌نویس سند</Typography>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                {amount > 0 ? `${toPersianDigits(formatThousands(amount))} ریال` : '—'}
              </Typography>
            </Box>
            {draft && (
              <Chip
                size="small"
                color={balanced ? 'success' : 'warning'}
                variant="outlined"
                icon={balanced ? <CheckCircleOutlineIcon /> : <WarningAmberOutlinedIcon />}
                label={balanced ? 'تراز ✓' : 'تراز نیست'}
              />
            )}
            {draft && warnings > 0 && (
              <Chip size="small" variant="outlined" icon={<WarningAmberOutlinedIcon />} label={`${toPersianDigits(warnings)} هشدار`} />
            )}
            {draft && info?.risk && <RiskChip level={info.risk.level} reasons={info.risk.reasons} />}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, mb: 1 }}>
            {toPersianDigits(done)} از {toPersianDigits(total)} سؤال · برای دیدن سند بالا بکشید
          </Typography>
        </ButtonBase>
        {state.phase === 'ask' && <AnswerComposer state={state} dispatch={dispatch} />}
      </Paper>
      <Drawer anchor="bottom" open={open} onClose={() => setOpen(false)} slotProps={{ paper: { sx: { maxHeight: '90vh', borderTopLeftRadius: 16, borderTopRightRadius: 16, p: 2 } } }}>
        <Stack direction="row" sx={{ justifyContent: 'flex-end', mb: 0.5 }}>
          <IconButton onClick={() => setOpen(false)} aria-label="بستن پیش‌نویس" sx={{ width: 44, height: 44 }}><CloseIcon /></IconButton>
        </Stack>
        <DraftPreview
          draft={draft}
          info={info}
          loading={loading}
          embedded
          templateTitle={state.template?.title}
          templateId={state.source === 'history' ? undefined : state.template?.id}
          fromHistory={state.source === 'history'}
          actions={actions && { ...actions, onSubmit: () => { setOpen(false); actions.onSubmit(); } }}
        />
      </Drawer>
    </>
  );
}
