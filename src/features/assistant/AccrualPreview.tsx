import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import { formatThousands, toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import { ACCRUAL_MONTHS_KEY, type AccrualScheduleKindValue, type TemplateSummaryDto } from './types';

// حسابداری تعهدی در پیش‌نمایش حسابیار (فاز ۶۶). فقط نمایش کمکی: تاریخ برگشت و تقسیم قطعی را سرور می‌سازد.

const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

export interface AccrualPreviewInput {
  autoReverse: boolean;
  scheduleKind: AccrualScheduleKindValue | null;
  /** تعداد ماه جواب‌داده‌شده؛ null = هنوز نه یا نامعتبر. */
  months: number | null;
}

/** از الگو و جواب‌ها؛ الگوی غیرتعهدی ⇒ null. */
export function accrualPreviewOf(template: TemplateSummaryDto | null | undefined, answers: Record<string, { value: string }>): AccrualPreviewInput | null {
  if (!template || (!template.autoReverse && !template.scheduleKind)) return null;
  const raw = answers[ACCRUAL_MONTHS_KEY]?.value;
  const n = raw ? Number(toLatinDigits(raw)) : NaN;
  return {
    autoReverse: !!template.autoReverse,
    scheduleKind: template.scheduleKind ?? null,
    months: Number.isInteger(n) && n >= 1 && n <= 120 ? n : null,
  };
}

/** همان قاعدهٔ سرور (AccrualScheduleSplitter): کف تقسیم، باقیمانده روی آخرین. */
export function splitAmount(total: number, parts: number): number[] {
  if (parts < 1 || total < parts) return [];
  const share = Math.floor(total / parts);
  return Array.from({ length: parts }, (_, i) => (i === parts - 1 ? total - share * (parts - 1) : share));
}

const monthLabel = (year: number, month: number, offset: number) => {
  const index = year * 12 + (month - 1) + offset;
  return `${MONTHS[index % 12]} ${toPersianDigits(Math.floor(index / 12))}`;
};

/**
 * خط اطلاع (نه هشدار زرد) برای برگشت خودکار، یا جدول کوچک تقسیم ماهانه.
 * `jalaliDate` = تاریخ سند (`YYYYMMDD`)، `amount` = مبلغ سند.
 */
export function AccrualNotice({ accrual, jalaliDate, amount }: { accrual: AccrualPreviewInput; jalaliDate: string | null; amount: number }) {
  const year = jalaliDate ? Number(jalaliDate.slice(0, 4)) : NaN;
  const month = jalaliDate ? Number(jalaliDate.slice(4, 6)) : NaN;
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;

  if (accrual.autoReverse) {
    const text = month === 12
      ? 'برآورد اسفند برگشت خودکار ندارد؛ اگر لازم است، بعد از افتتاحیه دستی برگردانید.'
      : `این سند ۱ ${monthLabel(year, month, 1)} خودکار برگردانده می‌شود.`;
    return <InfoLine text={text} />;
  }

  if (!accrual.scheduleKind) return null;
  const title = accrual.scheduleKind === 2 ? 'سهم ماهانهٔ پیش‌پرداخت' : 'سهم ماهانهٔ درآمد انتقالی';
  if (!accrual.months) return <InfoLine text={`${title}: پس از جواب «تعداد ماه» جدول تقسیم اینجا نشان داده می‌شود.`} />;
  const shares = splitAmount(amount, accrual.months);
  if (shares.length === 0) return <InfoLine text={`${title}: مبلغ برای تقسیم روی ${toPersianDigits(accrual.months)} ماه کم است.`} />;

  return (
    <Box sx={{ mb: 1.5 }}>
      <InfoLine text={`${title}: آخر هر ماه سند سهم همان ماه خودکار ساخته می‌شود.`} />
      <Box sx={{ maxHeight: 240, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 2 }}>
        <Table size="small" stickyHeader aria-label="جدول تقسیم ماهانه">
          <TableHead>
            <TableRow>
              <TableCell>ماه</TableCell>
              <TableCell align="left">مبلغ (ریال)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {shares.map((s, i) => (
              <TableRow key={i}>
                <TableCell>{monthLabel(year, month, i)}</TableCell>
                <TableCell align="left">{toPersianDigits(formatThousands(s))}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>جمع (برابر مبلغ)</TableCell>
              <TableCell align="left" sx={{ fontWeight: 700 }}>{toPersianDigits(formatThousands(shares.reduce((a, b) => a + b, 0)))}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Box>
      <Typography variant="caption" color="text.secondary">نمایش کمکی است؛ اختلاف گرد روی ماه آخر می‌رود و عدد قطعی را سرور می‌سازد.</Typography>
    </Box>
  );
}

function InfoLine({ text }: { text: string }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', bgcolor: 'action.hover', borderRadius: 2, px: 1.25, py: 0.75, mb: 1 }}>
      <EventRepeatOutlinedIcon fontSize="small" color="info" sx={{ mt: 0.1 }} />
      <Typography variant="body2">{text}</Typography>
    </Stack>
  );
}
