import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { formatThousands, toPersianDigits } from '../../lib/format/numbers';
import { salesApi } from './api';
import { DOC_TYPE_LABEL, POSTABLE, ROLE_LABEL, type SalesDocListRow } from './types';

/** میز کار فروش: کارتابل هر نقش (تأیید، قطعی‌سازی، پیش‌نویس) و اقدامات سریع. */
export function SalesHomePage() {
  const navigate = useNavigate();
  const setup = useQuery({ queryKey: ['sales-setup'], queryFn: salesApi.setup, retry: false });
  const has = (r: 1 | 2 | 3) => !!setup.data && (setup.data.isAdmin || setup.data.myRoles.includes(r));
  const pending = useQuery({ queryKey: ['sales-docs', 'pending'], queryFn: () => salesApi.docs({ status: 2, page: 1, pageSize: 50 }), enabled: has(2), retry: false });
  const approved = useQuery({ queryKey: ['sales-docs', 'approved'], queryFn: () => salesApi.docs({ status: 3, page: 1, pageSize: 100 }), enabled: has(3), retry: false });
  const drafts = useQuery({ queryKey: ['sales-docs', 'drafts'], queryFn: () => salesApi.docs({ status: 1, page: 1, pageSize: 50 }), enabled: has(1), retry: false });
  const toPost = (approved.data?.items ?? []).filter((d) => POSTABLE.includes(d.docType));

  return (
    <Box>
      <PageHeader eyebrow="فروش" icon={<StorefrontOutlinedIcon fontSize="small" />} title="میز کار فروش"
        description={setup.data ? `نقش شما: ${setup.data.isAdmin ? 'مدیر (همهٔ نقش‌ها)' : setup.data.myRoles.map((r) => ROLE_LABEL[r]).join('، ') || 'بدون نقش فروش'}` : undefined}
        actions={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => navigate('/sales/docs/new?type=4')}>فاکتور مستقیم</Button>
            <Button variant="contained" onClick={() => navigate('/sales/docs/new?type=1')}>پیش‌فاکتور جدید</Button>
          </Stack>
        } />
      {setup.error != null && <ErrorBanner error={setup.error} />}
      {setup.data && !setup.data.configured && (
        <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" onClick={() => navigate('/sales/settings')}>تنظیمات فروش</Button>}>
          تنظیمات فروش این واحد کامل نیست: حداقل حساب «حساب‌های دریافتنی» را تعریف و تنظیمات را ذخیره کنید.
        </Alert>
      )}
      {setup.data && !setup.data.isAdmin && setup.data.myRoles.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>برای کار با فروش، مدیر مالی واحد باید در «تنظیمات فروش» به شما نقش بدهد.</Alert>
      )}

      <Grid container spacing={2.5}>
        {has(2) && <Inbox title="در انتظار تأیید من" hint="تخفیف بیش از آستانه یا عبور از سقف اعتبار" rows={pending.data?.items ?? []} />}
        {has(3) && <Inbox title="آمادهٔ قطعی‌سازی" hint="حواله، فاکتور و برگشتِ تأییدشده" rows={toPost} />}
        {has(1) && <Inbox title="پیش‌نویس‌ها" hint="سندهایی که هنوز ثبت نشده‌اند" rows={drafts.data?.items ?? []} />}
      </Grid>
    </Box>
  );
}

function Inbox({ title, hint, rows }: { title: string; hint: string; rows: SalesDocListRow[] }) {
  const navigate = useNavigate();
  return (
    <Grid size={{ xs: 12, md: 6, lg: 4 }}>
      <Paper variant="outlined" sx={{ borderRadius: 3, height: '100%' }}>
        <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title} <Typography component="span" color="text.secondary">({toPersianDigits(rows.length)})</Typography></Typography>
          <Typography variant="caption" color="text.secondary">{hint}</Typography>
        </Box>
        <Stack sx={{ p: 1 }}>
          {rows.slice(0, 12).map((d) => (
            <Button key={d.id} onClick={() => navigate(`/sales/docs/${d.id}`)} sx={{ justifyContent: 'space-between', textAlign: 'start' }} color="inherit">
              <span>{DOC_TYPE_LABEL[d.docType]} {d.docNo ? toPersianDigits(d.docNo) : ''} · {d.customerName}</span>
              <Typography variant="caption" color="text.secondary">{toPersianDigits(formatThousands(d.total))} · {formatLegacyJalaliDate(d.docDate)}</Typography>
            </Button>
          ))}
          {rows.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>موردی نیست.</Typography>}
        </Stack>
      </Paper>
    </Grid>
  );
}
