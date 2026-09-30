import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useSession } from '../../lib/session/SessionContext';
import { toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import { DOC_LIFE_OPTIONS } from '../vouchers/api';
import { FS_FRAMEWORK_OPTIONS, labelOf, type FsFrameworkValue } from '../../types/fsTemplate';
import { PERSIAN_MONTHS, describePeriod } from '../../types/fsRun';
import { fsRunsApi } from './api';

const STEPS = ['مجموعه و دوره', 'دامنه و اسناد', 'گزینه‌ها و اجرا'];

/**
 * ویزارد «تهیهٔ صورت‌های مالی» (بخش ۴۵-ب، سند منبع §۱۲-۳). سه مرحله به‌جای چهار: ستون‌های مقایسه
 * فعلاً فقط «سال قبل» است و بودجه نداریم. واحد همان واحد جاری نشست است (هدر `X-Vahed-Code`).
 */
export function FsRunWizardPage() {
  const navigate = useNavigate();
  const { financialYear, unitName, unitCode } = useSession();

  const [step, setStep] = useState(0);
  const [framework, setFramework] = useState<FsFrameworkValue>(1);
  const [year, setYear] = useState(financialYear || '');
  const [toMonth, setToMonth] = useState(12);
  const [includeSubUnits, setIncludeSubUnits] = useState(true);
  const [minDocLife, setMinDocLife] = useState(4);
  const [includePrior, setIncludePrior] = useState(true);
  const [useDraftVersions, setUseDraftVersions] = useState(false);
  const [description, setDescription] = useState('');
  const [noteStartNo, setNoteStartNo] = useState("1");

  const yearValid = /^1[34]\d{2}$/.test(year);

  const mutation = useMutation({
    mutationFn: () =>
      fsRunsApi.generate({
        framework,
        year,
        toMonth,
        includeSubUnits,
        minDocLife,
        includePrior,
        useDraftVersions,
        description: description.trim() || null,
        noteStartNo: Number(noteStartNo) || 1,
      }),
    onSuccess: (id) => navigate(`/fs/runs/${id}`),
  });

  return (
    <section>
      <PageHeader
        eyebrow="صورت‌های مالی"
        icon={<AssessmentOutlinedIcon />}
        title="تهیهٔ صورت‌های مالی"
        description="صورت‌های یک مجموعه را از اسناد دوره محاسبه می‌کند. نتیجه ثابت نگه داشته می‌شود و تغییر بعدی اسناد یا قالب آن را عوض نمی‌کند."
      />

      <Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>
        {STEPS.map((s) => (
          <Step key={s}>
            <StepLabel>{s}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
        {step === 0 && (
          <Grid container spacing={3}>
            <Grid size={12}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                مجموعهٔ صورت‌ها
              </Typography>
              <ToggleButtonGroup
                exclusive
                color="primary"
                value={framework}
                onChange={(_, v: FsFrameworkValue | null) => v && setFramework(v)}
                sx={{ flexWrap: 'wrap' }}
              >
                {FS_FRAMEWORK_OPTIONS.map((o) => (
                  <ToggleButton key={o.value} value={o.value} sx={{ px: 2.5 }}>
                    {o.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="سال مالی"
                fullWidth
                value={toPersianDigits(year)}
                onChange={(e) => setYear(toLatinDigits(e.target.value).replace(/\D/g, '').slice(0, 4))}
                error={year !== '' && !yearValid}
                helperText={year !== '' && !yearValid ? 'سال شمسی چهاررقمی' : ' '}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField select fullWidth label="پایان دوره" value={toMonth} onChange={(e) => setToMonth(Number(e.target.value))} helperText="از ابتدای سال تا پایان این ماه">
                {PERSIAN_MONTHS.map((m, i) => (
                  <MenuItem key={m} value={i + 1}>
                    پایان {m}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        )}

        {step === 1 && (
          <Grid container spacing={3}>
            <Grid size={12}>
              <Typography variant="subtitle2">واحد گزارشگری</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {unitName || unitCode || '—'} (واحد جاری؛ برای واحد دیگر از بالای صفحه واحد را عوض کنید)
              </Typography>
              <FormControlLabel
                control={<Checkbox checked={includeSubUnits} onChange={(e) => setIncludeSubUnits(e.target.checked)} />}
                label="صورت ترکیبی: اسناد همهٔ واحدهای زیرمجموعه هم جمع شود"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                fullWidth
                label="اسناد با وضعیت حداقل"
                value={minDocLife}
                onChange={(e) => setMinDocLife(Number(e.target.value))}
                helperText="مثلاً «موقت» یعنی اسناد موقت، بررسی‌شده و تأیید دائم"
              >
                {DOC_LIFE_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={12}>
              <Alert severity="info" variant="outlined">
                ماندهٔ ابتدای سال از سند افتتاحیهٔ همان سال خوانده می‌شود و سند اختتامیه هرگز حساب نمی‌شود.
              </Alert>
            </Grid>
          </Grid>
        )}

        {step === 2 && (
          <Grid container spacing={2}>
            <Grid size={12}>
              <FormControlLabel
                control={<Checkbox checked={includePrior} onChange={(e) => setIncludePrior(e.target.checked)} />}
                label="ستون مقایسه‌ای: همان دوره در سال قبل"
              />
            </Grid>
            <Grid size={12}>
              <FormControlLabel
                control={<Checkbox checked={useDraftVersions} onChange={(e) => setUseDraftVersions(e.target.checked)} />}
                label="استفاده از قالب‌های پیش‌نویس (اجرای آزمایشی)"
              />
              <Typography variant="caption" color="text.secondary" component="p" sx={{ pr: 4 }}>
                برای امتحان قالب پیش از فعال‌سازی. صورت با برچسب «آزمایشی» نمایش داده می‌شود.
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="شمارهٔ اولین یادداشت عددی"
                fullWidth
                value={toPersianDigits(noteStartNo)}
                onChange={(e) => setNoteStartNo(toLatinDigits(e.target.value).replace(/\D/g, '').slice(0, 3))}
                helperText="یادداشت‌های پیش از آن معمولاً متنی‌اند (تاریخچه، مبنا، رویه‌ها)"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField label="توضیح (اختیاری)" fullWidth value={description} onChange={(e) => setDescription(e.target.value)} slotProps={{ htmlInput: { maxLength: 1000 } }} />
            </Grid>
            <Grid size={12}>
              <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  خلاصه
                </Typography>
                <Typography variant="body2">
                  {labelOf(FS_FRAMEWORK_OPTIONS, framework)} · {describePeriod(year, toMonth, toPersianDigits)}
                </Typography>
                <Typography variant="body2">
                  {unitName || unitCode}
                  {includeSubUnits ? ' و زیرمجموعه‌ها (ترکیبی)' : ' (جداگانه)'} · اسناد از وضعیت «
                  {labelOf(DOC_LIFE_OPTIONS, minDocLife)}» به بالا
                  {includePrior ? ' · با ستون سال قبل' : ''}
                  {useDraftVersions ? ' · آزمایشی' : ''}
                </Typography>
              </Box>
            </Grid>
            {mutation.isError && (
              <Grid size={12}>
                <ErrorBanner error={mutation.error} />
              </Grid>
            )}
          </Grid>
        )}

        <Stack direction="row" spacing={1} sx={{ mt: 3, justifyContent: 'space-between' }}>
          <Button disabled={step === 0 || mutation.isPending} onClick={() => setStep((s) => s - 1)}>
            قبلی
          </Button>
          {step < STEPS.length - 1 ? (
            <Button variant="contained" disabled={step === 0 && !yearValid} onClick={() => setStep((s) => s + 1)}>
              بعدی
            </Button>
          ) : (
            <Button
              variant="contained"
              color="success"
              startIcon={mutation.isPending ? <CircularProgress size={16} color="inherit" /> : <PlayArrowOutlinedIcon />}
              disabled={mutation.isPending || !yearValid}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? 'در حال محاسبه…' : 'تهیهٔ صورت‌ها'}
            </Button>
          )}
        </Stack>
      </Paper>
    </section>
  );
}
