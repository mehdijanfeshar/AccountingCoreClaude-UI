import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { ErrorBanner } from '../../components/ErrorBanner';
import { FormLoadingSkeleton } from '../../components/FormLoadingSkeleton';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { numberToPersianWords } from '../../lib/format/numberToWords';
import { formatThousands, toPersianDigits } from '../../lib/format/numbers';
import { PERSIAN_MONTHS } from '../../types/fsRun';
import { chequeBookApi } from './api';
import { BASE_H, BASE_W, resolveField, type ChequeFieldKey } from './chequeLayout';

/*
 * چاپ چک روی برگ چک — جای هر فیلد از «تنظیمات محیطی چک → جای فیلدها» (`TB_CHECK_TYPE.CHEQUE_*`)؛ فیلدی که
 * تنظیم نشده جای قالب سیستم قدیم را می‌گیرد (Extensions/Template.html: برگ ۱۷۰×۸۵ میلی‌متر، مقیاس‌شده با
 * طول/عرض برگ) — `chequeLayout.ts`. حاشیهٔ بالا و چپ چاپگر (می‌تواند منفی باشد) کل برگ را جابه‌جا می‌کند.
 * تصویر چک فقط برای پیش‌نمایش است و در چاپ نمی‌آید (مگر کلید روشن شود).
 */

const ORDINAL_DAYS = [
  'یکم', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم', 'هشتم', 'نهم', 'دهم',
  'یازدهم', 'دوازدهم', 'سیزدهم', 'چهاردهم', 'پانزدهم', 'شانزدهم', 'هفدهم', 'هجدهم', 'نوزدهم', 'بیستم',
  'بیست و یکم', 'بیست و دوم', 'بیست و سوم', 'بیست و چهارم', 'بیست و پنجم', 'بیست و ششم', 'بیست و هفتم',
  'بیست و هشتم', 'بیست و نهم', 'سی‌ام', 'سی و یکم',
];

function dateInWords(date: string | null): string {
  if (!date || date.length !== 8) return '';
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(4, 6));
  const d = Number(date.slice(6, 8));
  return `${ORDINAL_DAYS[d - 1] ?? ''} ${PERSIAN_MONTHS[m - 1] ?? ''} ${numberToPersianWords(y)}`;
}

export function ChequePrintPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [withImage, setWithImage] = useState(false);

  const query = useQuery({ queryKey: ['cheque-print', id], queryFn: () => chequeBookApi.print(id!), enabled: !!id });
  const mark = useMutation({
    mutationFn: () => chequeBookApi.markPrinted(id!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cheque-book'] });
      notify('چک «چاپ شده» ثبت شد.');
    },
  });

  if (query.isLoading) return <FormLoadingSkeleton />;
  if (query.isError || !query.data) return <ErrorBanner error={query.error} />;
  const c = query.data;

  const w = c.width || BASE_W;
  const h = c.height || BASE_H;
  const box = (key: ChequeFieldKey) => {
    const f = resolveField(key, c.fields, w, h);
    return {
      position: 'absolute' as const,
      left: `${f.left}mm`,
      top: `${f.top}mm`,
      width: `${f.width}mm`,
      fontSize: `${f.fontSize}pt`,
    lineHeight: 1.3,
    fontFamily: 'Vazirmatn, Tahoma, sans-serif',
      color: '#000',
    };
  };
  const amount = Math.round(c.amount);
  const numericDate = c.chequeDate?.length === 8 ? `${c.chequeDate.slice(0, 4)}/${c.chequeDate.slice(4, 6)}/${c.chequeDate.slice(6, 8)}` : '';

  async function print() {
    window.print();
    mark.mutate();
  }

  return (
    <Box
      sx={{
        '@page': { size: `${w}mm ${h}mm`, margin: 0 },
        '@media print': {
          '& .no-print': { display: 'none' },
          '& .cheque-sheet': { border: 'none !important', backgroundImage: withImage ? undefined : 'none !important' },
        },
      }}
    >
      <Stack direction="row" spacing={1} className="no-print" sx={{ mb: 2, alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
        <Button variant="contained" startIcon={<PrintOutlinedIcon />} onClick={print} disabled={mark.isPending}>
          چاپ چک
        </Button>
        <Button startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate('/operation/cheque-book')}>
          بازگشت به دفتر چک
        </Button>
        <FormControlLabel control={<Switch checked={withImage} onChange={(e) => setWithImage(e.target.checked)} />} label="تصویر چک در چاپ هم بیاید" />
        <Typography variant="body2" color="text.secondary">
          چک {toPersianDigits(c.chequeNo)} — {c.bankName ?? ''} {toPersianDigits(c.accountNumber ?? '')}
          {c.chequeTypeTitle ? ` — قالب «${c.chequeTypeTitle}»` : ''}
        </Typography>
      </Stack>
      {!c.chequeTypeId && (
        <Alert severity="warning" className="no-print" sx={{ mb: 2 }}>
          برای دسته‌چک این چک «تنظیمات محیطی چک» تعیین نشده؛ اندازهٔ پیش‌فرض ۱۷۰×۸۵ میلی‌متر به کار رفت.
        </Alert>
      )}
      {mark.isError && <ErrorBanner error={mark.error} />}

      <Box
        className="cheque-sheet"
        sx={{
          position: 'relative',
          width: `${w}mm`,
          height: `${h}mm`,
          marginTop: `${c.marginTop ?? 0}mm`,
          marginLeft: `${c.marginLeft ?? 0}mm`,
          border: '1px dashed',
          borderColor: 'divider',
          backgroundImage: c.image ? `url(data:image/*;base64,${c.image})` : undefined,
          backgroundSize: '100% 100%',
          direction: 'rtl',
          bgcolor: '#fff',
          overflow: 'hidden',
          '@media print': { margin: 0, transform: `translate(${c.marginLeft ?? 0}mm, ${c.marginTop ?? 0}mm)` },
        }}
      >
        <Box sx={{ ...box('NDATE'), direction: 'ltr', fontWeight: 700 }}>{toPersianDigits(numericDate)}</Box>
        <Box sx={box('ADATE')}>{dateInWords(c.chequeDate)}</Box>
        <Box sx={box('AAMOUNT')}>{`${numberToPersianWords(amount)} ریال`}</Box>
        <Box sx={box('DESCRIBE1')}>{c.payTo ?? ''}</Box>
        <Box sx={{ ...box('NAMOUNT'), direction: 'ltr', fontFamily: 'Arial', fontWeight: 700 }}>
          {`Rials ${formatThousands(amount)}/--`}
        </Box>
        <Box sx={box('DESCRIBE2')}>{c.paperDescription ?? ''}</Box>
      </Box>
    </Box>
  );
}
