import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import DesignServicesOutlinedIcon from '@mui/icons-material/DesignServicesOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { PageHeader } from '../../../components/PageHeader';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { useRoles } from '../../../lib/roles';
import { toPersianDigits } from '../../../lib/format/numbers';
import { assistantHistoryApi, templateDesignApi } from '../api';
import type { TemplateUsage } from '../types';

/** چند بار استفاده شده و آخرین بار کی (ستاد: همهٔ واحدها) — کلیک ⇒ سندهای حسابیار همین الگو. */
function UsageChip({ usage, onClick }: { usage: TemplateUsage | undefined; onClick: () => void }) {
  if (!usage) return <Chip size="small" variant="outlined" color="default" label="استفاده نشده" />;
  const last = new Date(usage.lastUsedUtc).toLocaleDateString('fa-IR');
  return (
    <Tooltip title={`آخرین استفاده: ${last} — کلیک: سندهای ساخته‌شده با این الگو`}>
      <Chip size="small" color="secondary" variant="outlined" label={`${toPersianDigits(usage.count)} بار`} onClick={onClick} />
    </Tooltip>
  );
}

/** الگوهای عملیات — فهرست، فعال/غیرفعال، ورود به طراحی. */
export function TemplatesListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isSetad, loaded } = useRoles();
  const list = useQuery({ queryKey: ['operation-template-definitions'], queryFn: templateDesignApi.list, retry: false });
  const usage = useQuery({ queryKey: ['operation-template-usage'], queryFn: assistantHistoryApi.usage, retry: false });
  const usageById = new Map((usage.data ?? []).map((u) => [u.templateId, u]));

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => templateDesignApi.setActive(id, isActive),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['operation-template-definitions'] });
      await queryClient.invalidateQueries({ queryKey: ['operation-templates'] });
    },
  });

  return (
    <Box>
      <PageHeader
        eyebrow="حسابیار"
        icon={<DesignServicesOutlinedIcon fontSize="small" />}
        accentColor="secondary"
        title="الگوهای عملیات"
        description="هر الگو یک عملیات روزمره (خرید کالا، دریافت از مشتری، پرداخت حقوق…) را به یک سند استاندارد تبدیل می‌کند."
        actions={
          <Button variant="contained" startIcon={<AddCircleOutlineIcon />} disabled={loaded && !isSetad} onClick={() => navigate('/assistant/templates/new')}>
            الگوی جدید
          </Button>
        }
      />

      {loaded && !isSetad && <Alert severity="info" sx={{ mb: 2 }}>تعریف و تغییر الگو فقط با نقش «مدیر ستاد» ممکن است.</Alert>}
      {list.error != null && <ErrorBanner error={list.error} />}
      {toggle.error != null && <ErrorBanner error={toggle.error} />}
      {list.isLoading && <CircularProgress sx={{ display: 'block', mx: 'auto', my: 4 }} />}

      {list.data && list.data.length === 0 && (
        <Card variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
          <Typography variant="body1" sx={{ mb: 1 }}>هنوز الگویی تعریف نشده است.</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            با پرکاربردترین عملیات شروع کنید، مثلاً «خرید کالا» یا «دریافت وجه از مشتری».
          </Typography>
          <Button variant="contained" disabled={loaded && !isSetad} onClick={() => navigate('/assistant/templates/new')}>ساخت اولین الگو</Button>
        </Card>
      )}

      <Grid container spacing={1.5}>
        {(list.data ?? []).map((t) => (
          <Grid key={t.id} size={{ xs: 12, md: 6, lg: 4 }}>
            <Card variant="outlined" sx={{ p: 2, height: '100%', borderRadius: 3, opacity: t.isActive ? 1 : 0.6 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', mb: 0.5 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>{t.title}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ direction: 'ltr', display: 'inline-block' }}>{t.code}</Typography>
                </Box>
                <Tooltip title={t.isActive ? 'فعال — در حسابیار دیده می‌شود' : 'غیرفعال'}>
                  <span>
                    <Switch
                      checked={t.isActive}
                      disabled={!isSetad || toggle.isPending}
                      onChange={(e) => toggle.mutate({ id: t.id, isActive: e.target.checked })}
                    />
                  </span>
                </Tooltip>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {t.description}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Chip size="small" variant="outlined" label={`${toPersianDigits(t.parameterCount)} سؤال`} />
                <Chip size="small" variant="outlined" label={`${toPersianDigits(t.lineCount)} ردیف`} />
                <UsageChip usage={usageById.get(t.id)} onClick={() => navigate(`/assistant/history?templateId=${t.id}`)} />
                <Box sx={{ flex: 1 }} />
                <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => navigate(`/assistant/templates/${t.id}/edit`)}>
                  {isSetad ? 'ویرایش' : 'مشاهده'}
                </Button>
              </Stack>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
