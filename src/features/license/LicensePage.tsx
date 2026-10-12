import { useRef, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { toPersianDigits } from '../../lib/format/numbers';
import { useRoles } from '../../lib/roles';
import { LICENSE_STATUS_KEY, licenseApi, type LicenseStateName } from './api';

const STATE: Record<LicenseStateName, { label: string; color: 'success' | 'warning' | 'error' }> = {
  Valid: { label: 'فعال', color: 'success' },
  Grace: { label: 'مهلت ارفاقی', color: 'warning' },
  ReadOnly: { label: 'فقط‌خواندنی', color: 'error' },
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack direction="row" spacing={2} sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}>
      <Typography color="text.secondary" sx={{ width: 160 }}>{label}</Typography>
      <Typography component="div">{children}</Typography>
    </Stack>
  );
}

/** مدیریت لایسنس — وضعیت فعلی و بارگذاری فایل تمدید (فقط مدیر ستاد). */
export function LicensePage() {
  const roles = useRoles();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const status = useQuery({ queryKey: LICENSE_STATUS_KEY, queryFn: licenseApi.status });
  const upload = useMutation({
    mutationFn: licenseApi.upload,
    onSuccess: (data) => queryClient.setQueryData(LICENSE_STATUS_KEY, data),
  });

  const s = status.data;
  const expires = s?.expiresAt ? new Date(`${s.expiresAt}T00:00:00`).toLocaleDateString('fa-IR') : null;

  return (
    <section>
      <PageHeader
        eyebrow="اطلاعات پایه"
        icon={<VpnKeyOutlinedIcon />}
        title="لایسنس"
        description="وضعیت لایسنس سامانه و بارگذاری فایل تمدید. پس از انقضا و پایان مهلت، سامانه فقط‌خواندنی می‌شود."
      />
      {status.error && <ErrorBanner error={status.error} />}
      {upload.error && <ErrorBanner error={upload.error} />}
      {upload.isSuccess && <Alert severity="success" sx={{ mb: 2 }}>لایسنس جدید ثبت شد.</Alert>}

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, maxWidth: 640 }}>
        {s && !s.enforced && (
          <Alert severity="info" sx={{ mb: 2 }}>
            کنترل لایسنس در این نصب خاموش است (<bdi>License:Enforce</bdi>)؛ هیچ محدودیتی اعمال نمی‌شود.
          </Alert>
        )}
        {s && (
          <>
            <Row label="وضعیت"><Chip size="small" label={STATE[s.state].label} color={STATE[s.state].color} /></Row>
            <Row label="مشتری">{s.customer ?? '—'}</Row>
            <Row label="تاریخ انقضا">{expires ?? '—'}</Row>
            <Row label="روز باقی‌مانده">{s.daysLeft != null ? toPersianDigits(String(Math.max(s.daysLeft, 0))) : '—'}</Row>
            {s.state === 'Grace' && <Row label="مهلت باقی‌مانده">{toPersianDigits(String(s.graceDaysLeft ?? 0))} روز</Row>}
            {s.message && <Row label="پیام">{s.message}</Row>}
            {s.perUnit && s.units.length > 0 && (
              <Row label="واحدها">
                <Stack spacing={0.5}>
                  {s.units.map((u) => (
                    <Stack key={u.code} direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <bdi>{u.code}</bdi>
                      <Chip size="small" label={STATE[u.state].label} color={STATE[u.state].color} />
                      <Typography variant="body2" color="text.secondary">
                        {u.expiresAt ? new Date(`${u.expiresAt}T00:00:00`).toLocaleDateString("fa-IR") : "—"}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Row>
            )}
          </>
        )}

        {roles.isSetad ? (
          <>
            <input
              ref={fileInput}
              type="file"
              accept=".lic,application/json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) upload.mutate(file);
              }}
            />
            <Button
              sx={{ mt: 3 }}
              variant="contained"
              startIcon={<UploadFileOutlinedIcon />}
              disabled={upload.isPending}
              onClick={() => fileInput.current?.click()}
            >
              بارگذاری فایل لایسنس
            </Button>
          </>
        ) : (
          <Typography color="text.secondary" sx={{ mt: 3 }}>بارگذاری لایسنس فقط برای مدیر ستاد مجاز است.</Typography>
        )}
      </Paper>
    </section>
  );
}
