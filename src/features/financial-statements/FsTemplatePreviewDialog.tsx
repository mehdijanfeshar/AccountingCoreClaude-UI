import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useSession } from '../../lib/session/SessionContext';
import { toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import { DOC_LIFE_OPTIONS } from '../vouchers/api';
import { PERSIAN_MONTHS, describePeriod, type FsRunStatementDto } from '../../types/fsRun';
import type { FsTemplateVersionDetailDto } from '../../types/fsTemplate';
import { fsTemplateVersionsApi } from './api';
import { AMOUNT_UNITS, FsStatementSheet } from './FsStatementSheet';

interface Props {
  version: FsTemplateVersionDetailDto;
  onClose: () => void;
}

/**
 * پیش‌نمایش زندهٔ یک نسخهٔ قالب (بخش ۴۵-و، سند منبع §۱۲-۳ «پیش‌نمایش زنده با دادهٔ واقعی»): همین نسخه —
 * حتی پیش‌نویسِ ذخیره‌نشده در اجرا — روی اسناد واقعی واحد جاری محاسبه و با همان برگهٔ رسمی نمایش داده
 * می‌شود؛ هیچ اجرایی ذخیره نمی‌شود. فقط ستون جاری؛ ردیف‌های «مقدار دستی» صفرند.
 */
export function FsTemplatePreviewDialog({ version, onClose }: Props) {
  const { financialYear, unitName, unitCode } = useSession();
  const [year, setYear] = useState(financialYear || '');
  const [toMonth, setToMonth] = useState(12);
  const [minDocLife, setMinDocLife] = useState(1);
  const [includeSubUnits, setIncludeSubUnits] = useState(true);
  const [unitDivisor, setUnitDivisor] = useState<number>(1);

  const yearValid = /^1[34]\d{2}$/.test(year);

  const query = useQuery({
    queryKey: ['fs-template-preview', version.id, unitCode, year, toMonth, minDocLife, includeSubUnits],
    queryFn: () => fsTemplateVersionsApi.preview(version.id, { year, toMonth, minDocLife, includeSubUnits }),
    enabled: yearValid,
  });

  const statement: FsRunStatementDto | null = query.data
    ? {
        id: version.id,
        templateId: version.templateId,
        versionId: version.id,
        templateCode: version.templateCode,
        titleFa: version.templateTitleFa,
        statementType: version.statementType,
        orderNo: 0,
        versionNo: version.versionNo,
        versionState: version.state,
        isNote: false,
        noteNo: null,
        parentTemplateCode: null,
        parentRowCode: null,
        totalRowCode: null,
        checkDiffCur: null,
        checkDiffPrv: null,
        rows: query.data.rows,
      }
    : null;

  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>پیش‌نمایش با دادهٔ واقعی — نسخهٔ {toPersianDigits(version.versionNo)}</DialogTitle>
      <DialogContent>
        <Stack direction="row" spacing={1.5} sx={{ my: 1, flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
          <TextField
            size="small"
            label="سال مالی"
            value={toPersianDigits(year)}
            onChange={(e) => setYear(toLatinDigits(e.target.value).replace(/\D/g, '').slice(0, 4))}
            sx={{ width: 100 }}
          />
          <TextField select size="small" label="پایان دوره" value={toMonth} onChange={(e) => setToMonth(Number(e.target.value))} sx={{ width: 140 }}>
            {PERSIAN_MONTHS.map((m, i) => (
              <MenuItem key={m} value={i + 1}>
                پایان {m}
              </MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="اسناد از وضعیت" value={minDocLife} onChange={(e) => setMinDocLife(Number(e.target.value))} sx={{ width: 150 }}>
            {DOC_LIFE_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            control={<Checkbox checked={includeSubUnits} onChange={(e) => setIncludeSubUnits(e.target.checked)} />}
            label="با زیرمجموعه‌ها"
          />
          <TextField select size="small" label="واحد مبلغ" value={unitDivisor} onChange={(e) => setUnitDivisor(Number(e.target.value))} sx={{ width: 140 }}>
            {AMOUNT_UNITS.map((u) => (
              <MenuItem key={u.value} value={u.value}>
                {u.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
          فقط برای امتحان قالب — هیچ اجرایی ذخیره نمی‌شود و ردیف‌های «مقدار دستی» صفرند.
        </Alert>

        {query.isError && <ErrorBanner error={query.error} />}
        {query.data?.error && <Alert severity="error" sx={{ mb: 2 }}>{query.data.error}</Alert>}
        {query.isLoading && yearValid && <Skeleton variant="rounded" height={360} />}
        {statement && (
          <FsStatementSheet
            statement={statement}
            orgName={unitName || unitCode}
            periodLine={describePeriod(year, toMonth, toPersianDigits)}
            currentLabel={toPersianDigits(year)}
            priorLabel={null}
            unitDivisor={unitDivisor}
            unitLabel={AMOUNT_UNITS.find((u) => u.value === unitDivisor)?.label ?? 'ریال'}
            showChange={false}
            isTrial
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => void query.refetch()} disabled={!yearValid || query.isFetching}>
          محاسبهٔ دوباره
        </Button>
        <Button onClick={onClose}>بستن</Button>
      </DialogActions>
    </Dialog>
  );
}
