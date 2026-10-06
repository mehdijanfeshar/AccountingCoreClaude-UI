import { useQuery } from '@tanstack/react-query';
import { sysTypesApi } from '../../lib/api/sysTypesApi';
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
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { formatThousands, toPersianDigits } from '../../lib/format/numbers';
import { gregorianToJalali } from './draftMapping';
import type { VoucherDraft } from './types';

interface DraftPreviewProps {
  draft: VoucherDraft | null;
  loading?: boolean;
  /** 0..1 — how much of the conversation is answered, shown while there is no draft yet. */
  progress?: number;
  templateTitle?: string;
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
export function DraftPreview({ draft, loading, progress = 0, templateTitle }: DraftPreviewProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5, position: 'sticky', top: 16, borderRadius: 3 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
        <ReceiptLongOutlinedIcon color="secondary" />
        <Typography variant="h2" component="h2" sx={{ flex: 1 }}>
          پیش‌نویس سند
        </Typography>
        {draft && <Chip size="small" label="موقت" color="info" variant="outlined" />}
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
        <DraftBody draft={draft} />
      )}
    </Paper>
  );
}

function DraftBody({ draft }: { draft: VoucherDraft }) {
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
