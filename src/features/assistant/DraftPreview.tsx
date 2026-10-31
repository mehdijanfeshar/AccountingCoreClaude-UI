import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sysTypesApi } from '../../lib/api/sysTypesApi';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { formatThousands, toPersianDigits } from '../../lib/format/numbers';
import { gregorianToJalali } from './draftMapping';
import { AccrualNotice, type AccrualPreviewInput } from './AccrualPreview';
import { amountInWordsRial } from '../../lib/format/numberToWords';
import { useNavigate } from 'react-router-dom';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { useIsAccountant } from './roleView';
import type { PreviewInfo } from './assistantState';
import type { RiskLevel, VoucherDraft } from './types';

/** متن ساده، هشدار، ریسک، کنترل‌ها و مبنای سرور برای پیش‌نویس. */
export type DraftInfo = PreviewInfo;

export const RISK_CHIP: Record<RiskLevel, { label: string; color: 'success' | 'warning' | 'error' }> = {
  low: { label: 'ریسک پایین', color: 'success' },
  medium: { label: 'ریسک متوسط', color: 'warning' },
  high: { label: 'ریسک بالا', color: 'error' },
};

/** چیپ ریسک (سبز / کهربایی / قرمزِ ملایم)؛ دلیل‌ها در راهنمای شناور. */
export function RiskChip({ level, reasons, size = 'small' }: { level: RiskLevel; reasons?: string[]; size?: 'small' | 'medium' }) {
  const c = RISK_CHIP[level];
  return (
    <Tooltip title={reasons && reasons.length > 0 ? reasons.join(' · ') : ''}>
      <Chip size={size} color={c.color} variant="outlined" label={c.label} />
    </Tooltip>
  );
}

/** مبلغ سند (ریال) = جمع بدهکار؛ طرف حساب = اولین تفصیلی ردیف‌ها. فقط برای نمایش. */
export function draftAmount(draft: VoucherDraft): number {
  return draft.totalDebit;
}
export function draftCounterparty(draft: VoucherDraft): string {
  for (const line of draft.lines) {
    const d = line.details.find((x) => x.detailTitle);
    if (d) return d.detailTitle;
  }
  return '—';
}

interface DraftPreviewProps {
  draft: VoucherDraft | null;
  loading?: boolean;
  /** 0..1 — how much of the conversation is answered, shown while there is no draft yet. */
  progress?: number;
  templateTitle?: string;
  /** متن ساده و هشدارها از پاسخ preview. */
  info?: DraftInfo | null;
  /** داخل برگهٔ پایینی موبایل: بدون sticky و کادر. */
  embedded?: boolean;
  /** برای پیوند «اسناد مشابه» (تاریخچه با فیلتر الگو). */
  templateId?: string;
  /** ساخته‌شده از سوابق: دلیل‌های ریسک و یادآوری بررسی حسابدار و مدیر مالی. */
  fromHistory?: boolean;
  /** دکمه‌های انتهای کارت: ارسال و ویرایش کامل. */
  actions?: { onSubmit: () => void; onEditFull: () => void; submitting: boolean };
  /** فاز ۶۶: الگوی تعهدی — خط برگشت خودکار یا جدول تقسیم ماهانه (`accrualPreviewOf`). */
  accrual?: AccrualPreviewInput | null;
}

const STEPS = [
  { title: 'بگویید چه اتفاقی افتاده', hint: 'مثلاً «۵۰ میلیون دارو از شرکت هجرت خریدم» — یا یکی از کارت‌های عملیات را بزنید.' },
  { title: 'به سؤال‌ها جواب دهید', hint: 'مبلغ، تاریخ و طرف حساب؛ آنچه در جمله‌تان بود از قبل پر شده است.' },
  { title: 'پیش‌نویس سند همین‌جا ساخته می‌شود', hint: 'حساب‌ها، تفصیلی‌ها و بدهکار/بستانکار را سرور از روی الگو می‌چیند.' },
  { title: '«ثبت سند» را بزنید', hint: 'سند موقت در کارتابل اسناد می‌نشیند؛ قبل از آن می‌توانید همه‌چیز را ویرایش کنید.' },
];

/** راهنمای خالی پیش‌نویس: کاربر کجای کار است (به‌جای نوارهای خاکستری که شبیه «در حال بارگذاری» بودند). */
function Steps({ current }: { current: number }) {
  return (
    <Stack spacing={1.25}>
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <Stack key={s.title} direction="row" spacing={1.25} sx={{ alignItems: 'flex-start', opacity: done || active ? 1 : 0.55 }}>
            <Box
              sx={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
                fontSize: 12, fontWeight: 700,
                bgcolor: done ? 'success.main' : active ? 'secondary.main' : 'action.selected',
                color: done || active ? 'common.white' : 'text.secondary',
              }}
            >
              {done ? '✓' : toPersianDigits(String(i + 1))}
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: active ? 700 : 500 }}>{s.title}</Typography>
              {active && <Typography variant="caption" color="text.secondary">{s.hint}</Typography>}
            </Box>
          </Stack>
        );
      })}
    </Stack>
  );
}

/** The voucher as the accountant will see it in the کارتابل — built by the server, never by the browser. */
export function DraftPreview({ draft, loading, progress = 0, templateTitle, info, embedded, templateId, fromHistory, actions, accrual }: DraftPreviewProps) {
  const accountant = useIsAccountant();
  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, ...(embedded ? { border: 0, p: 0 } : { position: 'sticky', top: 16 }) }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5, flexWrap: 'wrap', rowGap: 0.75 }}>
        <ReceiptLongOutlinedIcon color="secondary" />
        <Typography variant="h2" component="h2" sx={{ flex: 1 }}>
          پیش‌نویس سند
        </Typography>
        {draft && <Chip size="small" label="پس از ارسال: موقت" color="info" variant="outlined" />}
        {draft && info?.risk && <RiskChip level={info.risk.level} reasons={info.risk.reasons} />}
      </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {!draft ? (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {templateTitle
              ? 'با پاسخ به سؤال‌ها، سند همین‌جا ساخته می‌شود. لازم نیست حساب و تفصیلی را بشناسید.'
              : 'یک عملیات انتخاب کنید یا سند را دستی بنویسید.'}
          </Typography>
          {templateTitle && <LinearProgress variant="determinate" value={Math.round(progress * 100)} sx={{ mb: 2, height: 6, borderRadius: 3 }} />}
          <Steps current={!templateTitle ? 0 : loading ? 2 : 1} />
        </Box>
      ) : (
        <>
          {fromHistory && (
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              <AlertTitle>ساخته‌شده از سوابق، نه الگوی ستاد</AlertTitle>
              {(info?.risk?.reasons ?? []).map((r) => <Box key={r}>• {r}</Box>)}
              این سند حتماً باید حسابدار و مدیر مالی بررسی کنند.
            </Alert>
          )}
          {accrual && <AccrualNotice accrual={accrual} jalaliDate={gregorianToJalali(draft.voucherDate)} amount={draft.totalDebit} />}
          <DraftBody draft={draft} info={info ?? null} templateId={templateId} />
          {actions && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
              <Button variant="contained" sx={{ minHeight: 44 }} onClick={actions.onSubmit} disabled={actions.submitting}>
                {actions.submitting ? 'در حال ارسال…' : accountant ? 'ثبت سند' : 'ارسال برای بررسی حسابدار'}
              </Button>
              <Button variant="outlined" sx={{ minHeight: 44 }} onClick={actions.onEditFull} disabled={actions.submitting}>ویرایش کامل</Button>
            </Stack>
          )}
        </>
      )}
    </Paper>
  );
}

/** هشدارها: علامت + متن ساده، بدون رنگ قرمز ترساننده (§۱۲.۱-۴). */
export function DraftWarnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <Stack spacing={0.75} sx={{ mb: 1.5 }} role="list" aria-label="نکته‌ها">
      {warnings.map((w, i) => (
        <Stack key={i} role="listitem" direction="row" spacing={1} sx={{ alignItems: 'flex-start', bgcolor: 'rgba(237, 108, 2, 0.08)', borderRadius: 2, px: 1.25, py: 0.75 }}>
          <WarningAmberOutlinedIcon fontSize="small" sx={{ color: 'warning.dark', mt: 0.1 }} />
          <Typography variant="body2">{w}</Typography>
        </Stack>
      ))}
    </Stack>
  );
}

function DraftBody({ draft, info, templateId }: { draft: VoucherDraft; info: DraftInfo | null; templateId?: string }) {
  const accountant = useIsAccountant();
  const [tab, setTab] = useState<'simple' | 'accounting' | null>(null);
  const active = tab ?? (accountant ? 'accounting' : 'simple');
  return (
    <Box>
      <Tabs value={active} onChange={(_, v) => setTab(v)} variant="fullWidth" sx={{ mb: 1.5, minHeight: 44 }}>
        <Tab value="simple" label="به زبان ساده" sx={{ minHeight: 44 }} />
        <Tab value="accounting" label="سند حسابداری" sx={{ minHeight: 44 }} />
      </Tabs>
      {active === 'simple' ? (
        <SimpleView draft={draft} info={info} templateId={templateId} />
      ) : (
        <>
          <DraftWarnings warnings={info?.warnings ?? []} />
          <AccountingView draft={draft} />
        </>
      )}
    </Box>
  );
}

/** متن ساده با مقدارهای کلیدی (اعداد و طرف حساب) پررنگ. */
function boldKeyValues(text: string, keywords: string[]): ReactNode[] {
  const escaped = keywords.filter((k) => k && k !== '—').map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const numbers = '[0-9۰-۹][0-9۰-۹٬,،.]{2,}';
  const re = new RegExp(`(${[...escaped, numbers].join('|')})`, 'g');
  return text.split(re).map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

function SimpleView({ draft, info, templateId }: { draft: VoucherDraft; info: DraftInfo | null; templateId?: string }) {
  const navigate = useNavigate();
  const balanced = draft.totalDebit === draft.totalCredit;
  const amount = draftAmount(draft);
  const counterparty = draftCounterparty(draft);
  const controls = info?.controls ?? [];
  const warnings = info?.warnings ?? [];
  return (
    <Box>
      <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, px: 1.75, py: 1.25, mb: 1.5 }}>
        <Typography variant="body1" sx={{ lineHeight: 2 }}>
          {boldKeyValues(info?.plainText || draft.description || '—', [counterparty])}
        </Typography>
      </Box>

      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
        <KeyCard label="مبلغ" value={`${toPersianDigits(formatThousands(amount))} ریال`} hint={`معادل ${toPersianDigits(formatThousands(Math.round(amount / 10)))} تومان · ${amountInWordsRial(amount)}`} />
        <KeyCard label="طرف حساب" value={counterparty} />
        <KeyCard label="تاریخ سند" value={formatLegacyJalaliDate(gregorianToJalali(draft.voucherDate))} />
        <KeyCard label="پیوست" value={draft.apendix || 'هنوز ندارد'} warn={!draft.apendix} />
      </Stack>

      <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.75 }}>کنترل‌ها</Typography>
      <Stack spacing={0.5} sx={{ mb: 1.5 }} role="list" aria-label="کنترل‌ها">
        {controls.length > 0 ? (
          controls.map((c) => (
            <Stack key={c.key} role="listitem" direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              {c.passed ? <CheckCircleOutlineIcon fontSize="small" color="success" /> : <WarningAmberOutlinedIcon fontSize="small" sx={{ color: 'warning.dark' }} />}
              <Typography variant="body2">{c.label}</Typography>
            </Stack>
          ))
        ) : (
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
            {balanced ? <CheckCircleOutlineIcon fontSize="small" color="success" /> : <WarningAmberOutlinedIcon fontSize="small" sx={{ color: 'warning.dark' }} />}
            <Typography variant="body2">{balanced ? 'تراز: بدهکار و بستانکار برابرند' : 'بدهکار و بستانکار برابر نیستند؛ حسابدار بررسی می‌کند'}</Typography>
          </Stack>
        )}
      </Stack>

      <DraftWarnings warnings={warnings} />

      {info?.basis && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          مبنا: الگوی ستاد «{info.basis.templateTitle}» · {toPersianDigits(info.basis.usageCountInUnit)} بار در این واحد استفاده شده
          {templateId && (
            <>
              {' · '}
              <Box
                component="button"
                type="button"
                onClick={() => navigate(`/assistant/history?templateId=${templateId}`)}
                sx={{ all: 'unset', cursor: 'pointer', color: 'primary.main', textDecoration: 'underline', minHeight: 24 }}
              >
                اسناد مشابه
              </Box>
            </>
          )}
        </Typography>
      )}
    </Box>
  );
}

function KeyCard({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <Paper variant="outlined" sx={{ px: 1.5, py: 1, borderRadius: 2, flex: '1 1 140px', minWidth: 130, ...(warn && { borderColor: 'warning.main', bgcolor: 'rgba(237, 108, 2, 0.06)' }) }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{label}</Typography>
      <Typography variant="body1" sx={{ fontWeight: 700, ...(warn && { color: 'warning.dark' }) }}>{value}</Typography>
      {hint && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{hint}</Typography>}
    </Paper>
  );
}

function AccountingView({ draft }: { draft: VoucherDraft }) {
  const balanced = draft.totalDebit === draft.totalCredit;
  const sysTypes = useQuery({ queryKey: ['sys-types'], queryFn: () => sysTypesApi.list() });
  const sysTypeName = (id: string | null) => {
    if (!id) return '—';
    const t = (sysTypes.data ?? []).find((x) => x.id === id);
    return t ? t.sysName ?? t.sysCode : '…';
  };
  return (
    <Box>
      <Stack direction="row" spacing={3} sx={{ mb: 1.5, flexWrap: 'wrap', rowGap: 1 }}>
        <Meta label="تاریخ" value={formatLegacyJalaliDate(gregorianToJalali(draft.voucherDate))} />
        <Meta label="شماره" value="هنگام ثبت" />
        <Meta label="منبع" value={draft.sourceTemplateCode === 'MANUAL' ? 'سند دستی' : draft.sourceTemplateCode} />
        <Meta label="نوع سند" value={sysTypeName(draft.systemTypeId)} />
      </Stack>
      <Typography variant="body2" sx={{ mb: 1.5 }}>
        <Box component="span" sx={{ color: 'text.secondary' }}>شرح: </Box>
        {draft.description || '—'}
      </Typography>
      {draft.apendix && (
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          <Box component="span" sx={{ color: 'text.secondary' }}>پیوست: </Box>
          {draft.apendix}
        </Typography>
      )}

      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>حساب و تفصیلی</TableCell>
              <TableCell align="left">بدهکار</TableCell>
              <TableCell align="left">بستانکار</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {draft.lines.map((line, i) => (
              <TableRow key={i}>
                <TableCell>{toPersianDigits(i + 1)}</TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {line.subsidiaryAccountCode ? `${line.subsidiaryAccountCode} - ` : ''}
                    {line.subsidiaryAccountTitle}
                  </Typography>
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5, mt: 0.5 }}>
                    {line.details.map((d) => (
                      <Chip key={d.levelId} size="small" variant="outlined" label={`سطح ${toPersianDigits(d.level)}: ${d.detailTitle}`} />
                    ))}
                    {line.checkId && <Chip size="small" color="secondary" variant="outlined" label="چک" />}
                  </Stack>
                  {line.description && line.description !== draft.description && (
                    <Typography variant="caption" color="text.secondary">{line.description}</Typography>
                  )}
                </TableCell>
                <TableCell align="left">{line.debit ? formatThousands(line.debit) : '—'}</TableCell>
                <TableCell align="left">{line.credit ? formatThousands(line.credit) : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      <Divider sx={{ my: 1.5 }} />
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
        <Meta label="جمع بدهکار" value={formatThousands(draft.totalDebit)} />
        <Meta label="جمع بستانکار" value={formatThousands(draft.totalCredit)} />
        <Box sx={{ flex: 1 }} />
        <Chip
          icon={balanced ? <CheckCircleOutlineIcon /> : <ErrorOutlineIcon />}
          color={balanced ? 'success' : 'error'}
          label={balanced ? 'تراز است' : 'تراز نیست'}
        />
      </Stack>
    </Box>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>{value}</Typography>
    </Box>
  );
}
