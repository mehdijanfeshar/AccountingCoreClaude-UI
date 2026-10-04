import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import PublishOutlinedIcon from '@mui/icons-material/PublishOutlined';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import { PageHeader } from '../../components/PageHeader';
import { StatTiles } from '../../components/StatTiles';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useSession } from '../../lib/session/SessionContext';
import { toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import { FS_FRAMEWORK_OPTIONS, type FsFrameworkValue } from '../../types/fsTemplate';
import { FS_PERIOD_STATE_META, FS_RUN_STATE, FS_RUN_STATE_META, type FsPeriodUnitDto } from '../../types/fsRun';
import { formatRatio } from '../../types/fsRatio';
import { fsPeriodsApi, fsRatiosApi } from './api';

const TASK_ICON: Record<string, React.ReactNode> = {
  approveRun: <TaskAltOutlinedIcon />,
  publishRun: <PublishOutlinedIcon />,
  check: <AssignmentIndOutlinedIcon />,
  reviewNarrative: <RateReviewOutlinedIcon />,
  reviseNarrative: <EditNoteOutlinedIcon />,
  reopenRequest: <LockOpenOutlinedIcon />,
};

/** پیشرفت بستن یک واحد (۰ تا ۱۰۰): تهیه ← بازبینی/تأیید ← بستهٔ موقت ← قفل ← منتشرشده. */
function progressOf(u: FsPeriodUnitDto): number {
  if (u.latestRun?.state === FS_RUN_STATE.Published) return 100;
  if (u.state === 3 || u.lockedVia) return 80;
  if (u.state === 2) return 60;
  if (u.latestRun && (u.latestRun.state === FS_RUN_STATE.InReview || u.latestRun.state === FS_RUN_STATE.Approved)) return 40;
  if (u.latestRun) return 20;
  return 0;
}

/**
 * ح-۹ — داشبورد صورت‌های مالی (سند منبع §۱۲-۳): چهار شاخص اصلی (نسبت‌های اول) با سال قبل، کاشی وضعیت بستن
 * هر زیرواحد (کلیک ⇒ «بستن دوره» همان واحد)، «کارهای من» و دسترسی سریع. شاخص‌ها از آخرین اجرای منتشرشده
 * (وگرنه آخرین اجرای جاری) و شمارهٔ آن اجرا زیر عنوان.
 */
export function FsDashboardPage() {
  const navigate = useNavigate();
  const { financialYear, unitCode } = useSession();
  const [framework, setFramework] = useState<FsFrameworkValue>(1);
  const [year, setYear] = useState(financialYear || '');
  const yearValid = /^1[34]\d{2}$/.test(year);

  const dashQuery = useQuery({
    queryKey: ['fs-dashboard', unitCode, framework, year],
    queryFn: () => fsRatiosApi.dashboard(framework, year),
    enabled: yearValid,
  });
  const boardQuery = useQuery({ queryKey: ['fs-periods', unitCode, year], queryFn: () => fsPeriodsApi.board(year), enabled: yearValid });

  const dash = dashQuery.data;
  const units = (boardQuery.data?.units ?? []).filter((u) => !u.isSelf);
  const self = boardQuery.data?.units.find((u) => u.isSelf);

  const tiles = (dash?.kpis ?? []).map((k) => ({
    key: k.code,
    label: k.titleFa,
    value: k.error ? '—' : formatRatio(k.current, k.format),
    hint: k.error ? 'محاسبه نشد' : k.prior !== null ? `سال قبل: ${formatRatio(k.prior, k.format)}` : undefined,
    tone: 'primary' as const,
  }));

  return (
    <section>
      <PageHeader
        eyebrow="صورت‌های مالی"
        icon={<DashboardOutlinedIcon />}
        title="داشبورد صورت‌های مالی"
        description={
          dash?.run
            ? `شاخص‌ها از اجرای شمارهٔ ${toPersianDigits(dash.run.runNo)} (${FS_RUN_STATE_META[dash.run.state]?.label ?? ''})`
            : 'برای این سال و مجموعه هنوز صورتی تهیه نشده است.'
        }
        actions={
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Button variant="contained" startIcon={<PlayArrowOutlinedIcon />} onClick={() => navigate('/fs/runs/new')}>
              تهیهٔ صورت‌ها
            </Button>
            {dash?.run && (
              <Button variant="outlined" startIcon={<AssessmentOutlinedIcon />} onClick={() => navigate(`/fs/runs/${dash.run!.id}`)}>
                مشاهدهٔ صورت‌ها
              </Button>
            )}
            <Button variant="outlined" startIcon={<InsightsOutlinedIcon />} onClick={() => navigate('/fs/analysis')}>
              تحلیل
            </Button>
            <Button variant="outlined" startIcon={<NotesOutlinedIcon />} onClick={() => navigate('/fs/narratives')}>
              یادداشت‌ها
            </Button>
          </Stack>
        }
      />

      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        <Tabs value={framework} onChange={(_, v: FsFrameworkValue) => setFramework(v)}>
          {FS_FRAMEWORK_OPTIONS.map((o) => (
            <Tab key={o.value} value={o.value} label={o.label} />
          ))}
        </Tabs>
        <TextField
          size="small"
          label="سال مالی"
          value={toPersianDigits(year)}
          onChange={(e) => setYear(toLatinDigits(e.target.value).replace(/\D/g, '').slice(0, 4))}
          sx={{ width: 110 }}
        />
      </Stack>

      {(dashQuery.error ?? boardQuery.error) && <ErrorBanner error={dashQuery.error ?? boardQuery.error} />}

      {tiles.length > 0 ? (
        <StatTiles tiles={tiles} isLoading={dashQuery.isLoading} />
      ) : (
        dash?.run && (
          <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
            <Typography variant="body2" color="text.secondary">
              نسبتی برای شاخص‌ها تعریف نشده است.{' '}
              <Button size="small" onClick={() => navigate('/fs/ratios')}>
                تعریف نسبت‌ها
              </Button>
            </Typography>
          </Paper>
        )
      )}

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '3fr 2fr' } }}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Stack direction="row" sx={{ alignItems: 'center', mb: 1.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
              وضعیت بستن سال
            </Typography>
            {self && <Chip size="small" color={FS_PERIOD_STATE_META[self.state].color} label={`واحد جاری: ${FS_PERIOD_STATE_META[self.state].label}`} />}
          </Stack>
          {units.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              این واحد زیرواحد مستقیم ندارد.{' '}
              <Button size="small" onClick={() => navigate('/fs/period-close')}>
                بستن دوره
              </Button>
            </Typography>
          ) : (
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
              {units.map((u) => {
                const p = progressOf(u);
                return (
                  <ButtonBase
                    key={u.vahedCode}
                    onClick={() => navigate(`/fs/period-close?unit=${u.vahedCode}`)}
                    sx={{ display: 'block', textAlign: 'start', borderRadius: 2 }}
                  >
                    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, '&:hover': { borderColor: 'primary.main' } }}>
                      <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                        {u.vahedName ?? u.vahedCode}
                      </Typography>
                      <Stack direction="row" spacing={0.5} sx={{ my: 0.75, alignItems: 'center' }}>
                        <Chip size="small" color={FS_PERIOD_STATE_META[u.state].color} label={u.lockedVia ? 'قفل (بالادستی)' : FS_PERIOD_STATE_META[u.state].label} />
                        {u.latestRun && u.latestRun.blockingFailed > 0 && (
                          <Chip size="small" color="error" variant="outlined" label={`${toPersianDigits(u.latestRun.blockingFailed)} خطا`} />
                        )}
                      </Stack>
                      <LinearProgress variant="determinate" value={p} color={p === 100 ? 'success' : 'primary'} sx={{ borderRadius: 1 }} />
                      <Typography variant="caption" color="text.secondary">
                        {toPersianDigits(p)}٪
                      </Typography>
                    </Paper>
                  </ButtonBase>
                );
              })}
            </Box>
          )}
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            کارهای من {dash ? `(${toPersianDigits(dash.tasks.length)})` : ''}
          </Typography>
          {dash && dash.tasks.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              کار باز ندارید.
            </Typography>
          )}
          <List dense disablePadding>
            {(dash?.tasks ?? []).map((t, i) => (
              <ListItemButton key={i} onClick={() => navigate(t.link)} sx={{ borderRadius: 1 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>{TASK_ICON[t.kind] ?? <TaskAltOutlinedIcon />}</ListItemIcon>
                <ListItemText
                  primary={t.title}
                  secondary={[t.detail, t.date ? toPersianDigits(new Date(t.date).toLocaleDateString('fa-IR')) : null].filter(Boolean).join(' · ') || undefined}
                />
              </ListItemButton>
            ))}
          </List>
        </Paper>
      </Box>
    </section>
  );
}
