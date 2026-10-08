import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { PageHeader } from '../../../components/PageHeader';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { JalaliDateField } from '../../../components/JalaliDateField';
import { MonoCode } from '../../../components/MonoCode';
import { DataTable, type DataTableColumn } from '../../../components/DataTable';
import { StatTiles, type StatTile } from '../../../components/StatTiles';
import { useSession } from '../../../lib/session/SessionContext';
import { toPersianDigits } from '../../../lib/format/numbers';
import { DOC_LIFE_OPTIONS, getDocLifeLabel } from '../../vouchers/api';
import {
  attributeAccountsApi,
  MISMATCH_REASON_LABEL,
  type AttributeAccountCriteria,
  type AttributeAccountLineDto,
  type AttributeAccountMoeinDto,
  type AttributeAccountValueDto,
} from './api';

function amount(value: number): string {
  return toPersianDigits(value.toLocaleString('en-US'));
}

function jalali(value: string | null): string {
  if (!value) return '—';
  if (value.length !== 8) return toPersianDigits(value);
  return toPersianDigits(`${value.slice(0, 4)}/${value.slice(4, 6)}/${value.slice(6, 8)}`);
}

/** مانده با برچسب بد/بس؛ صفر = «—». */
function balance(debtor: number, creditor: number): string {
  const b = debtor - creditor;
  if (b === 0) return '—';
  return `${amount(Math.abs(b))} ${b > 0 ? 'بد' : 'بس'}`;
}

const ATTRIB_SUM_LABEL: Record<number, string> = { 1: 'جمع‌پذیر', 2: 'جمع‌ناپذیر' };

/**
 * مغایرت‌گیری حساب‌های شناسه‌دار (FINACC-523) — سه سطح: معین ← شناسه ← ردیف سند.
 * مغایرت: جمع‌پذیر ⇒ مانده ≠ ۰؛ جمع‌ناپذیر ⇒ علاوه بر آن، هر بدهکار باید با یک بستانکار هم‌مبلغ جفت شود؛
 * ردیف بی‌شناسه روی حساب شناسه‌دار همیشه مغایر است.
 */
export function AttributeAccountReconciliationPage() {
  const { financialYear, unitLabel, isConfigured } = useSession();
  const navigate = useNavigate();

  const emptyDraft = { fromDate: '', toDate: '', docLife: '' };
  const [draft, setDraft] = useState(emptyDraft);
  const [applied, setApplied] = useState(emptyDraft);
  const [onlyMismatched, setOnlyMismatched] = useState(false);
  const [moein, setMoein] = useState<AttributeAccountMoeinDto | null>(null);
  // undefined = هیچ شناسه‌ای انتخاب نشده؛ null = «بدون شناسه».
  const [value, setValue] = useState<string | null | undefined>(undefined);

  const criteria: AttributeAccountCriteria = {
    year: financialYear,
    fromDate: applied.fromDate || undefined,
    toDate: applied.toDate || undefined,
    docLife: applied.docLife === '' ? undefined : Number(applied.docLife),
  };

  const moeinsQuery = useQuery({
    queryKey: ['attribute-accounts', 'moeins', criteria],
    queryFn: () => attributeAccountsApi.moeins(criteria),
    enabled: isConfigured && !!financialYear,
  });

  const valuesQuery = useQuery({
    queryKey: ['attribute-accounts', 'values', criteria, moein?.accountId],
    queryFn: () => attributeAccountsApi.values(criteria, moein!.accountId),
    enabled: !!moein,
  });

  const linesQuery = useQuery({
    queryKey: ['attribute-accounts', 'lines', criteria, moein?.accountId, value],
    queryFn: () => attributeAccountsApi.lines(criteria, moein!.accountId, value ?? null),
    enabled: !!moein && value !== undefined,
  });

  function apply() {
    setApplied(draft);
    setMoein(null);
    setValue(undefined);
  }

  const moeins = (moeinsQuery.data ?? []).filter(
    (m) => !onlyMismatched || m.mismatchCount > 0 || m.linesWithoutIdentifier > 0,
  );
  const values = (valuesQuery.data ?? []).filter((v) => !onlyMismatched || v.isMismatch);
  const all = moeinsQuery.data ?? [];

  const tiles: StatTile[] = [
    { key: 'moeins', label: 'معین شناسه‌دار', value: all.length, tone: 'primary' },
    { key: 'ids', label: 'تعداد شناسه', value: all.reduce((s, m) => s + m.identifierCount, 0), tone: 'info' },
    {
      key: 'mismatch',
      label: 'شناسهٔ مغایر',
      value: all.reduce((s, m) => s + m.mismatchCount - (m.linesWithoutIdentifier > 0 ? 1 : 0), 0),
      tone: all.some((m) => m.mismatchCount > 0) ? 'error' : 'success',
    },
    {
      key: 'missing',
      label: 'ردیف بدون شناسه',
      value: all.reduce((s, m) => s + m.linesWithoutIdentifier, 0),
      tone: all.some((m) => m.linesWithoutIdentifier > 0) ? 'warning' : 'success',
    },
  ];

  const moeinColumns: DataTableColumn<AttributeAccountMoeinDto>[] = [
    { key: 'code', header: 'کد معین', width: 110, render: (m) => <MonoCode value={m.accCode} /> },
    { key: 'name', header: 'شرح معین', render: (m) => m.accName ?? '—' },
    { key: 'sum', header: 'حالت شناسه', render: (m) => ATTRIB_SUM_LABEL[m.attribSum] ?? '—' },
    { key: 'd', header: 'گردش بدهکار', align: 'end', render: (m) => amount(m.debtor) },
    { key: 'c', header: 'گردش بستانکار', align: 'end', render: (m) => amount(m.creditor) },
    { key: 'b', header: 'مانده', align: 'end', render: (m) => balance(m.debtor, m.creditor) },
    { key: 'n', header: 'شناسه', align: 'center', render: (m) => toPersianDigits(m.identifierCount) },
    {
      key: 'mm',
      header: 'مغایرت',
      align: 'center',
      render: (m) => {
        const ids = m.mismatchCount - (m.linesWithoutIdentifier > 0 ? 1 : 0);
        return (
          <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'center' }}>
            {ids > 0 ? (
              <Chip size="small" color="error" label={`${toPersianDigits(ids)} شناسه`} />
            ) : (
              <Chip size="small" color="success" variant="outlined" label="ندارد" />
            )}
            {m.linesWithoutIdentifier > 0 && (
              <Chip size="small" color="warning" label={`${toPersianDigits(m.linesWithoutIdentifier)} بی‌شناسه`} />
            )}
          </Stack>
        );
      },
    },
    {
      key: 'act',
      header: '',
      align: 'end',
      render: (m) => (
        <Button
          size="small"
          variant={moein?.accountId === m.accountId ? 'contained' : 'text'}
          onClick={() => {
            setMoein(m);
            setValue(undefined);
          }}
        >
          ریز شناسه‌ها
        </Button>
      ),
    },
  ];

  const valueColumns: DataTableColumn<AttributeAccountValueDto>[] = [
    {
      key: 'v',
      header: 'شناسه',
      render: (v) =>
        v.attributeValue === null ? (
          <Typography variant="body2" color="warning.main">(بدون شناسه)</Typography>
        ) : (
          <MonoCode value={v.attributeValue} />
        ),
    },
    { key: 'n', header: 'ردیف', align: 'center', render: (v) => toPersianDigits(v.lineCount) },
    { key: 'd', header: 'بدهکار', align: 'end', render: (v) => amount(v.debtor) },
    { key: 'c', header: 'بستانکار', align: 'end', render: (v) => amount(v.creditor) },
    { key: 'b', header: 'مانده', align: 'end', render: (v) => balance(v.debtor, v.creditor) },
    {
      key: 'st',
      header: 'وضعیت',
      render: (v) =>
        v.isMismatch && v.reason ? (
          <Chip size="small" color={v.reason === 3 ? 'warning' : 'error'} label={MISMATCH_REASON_LABEL[v.reason]} />
        ) : (
          <Chip size="small" color="success" variant="outlined" label="تطبیق" />
        ),
    },
    {
      key: 'act',
      header: '',
      align: 'end',
      render: (v) => (
        <Button
          size="small"
          variant={value === v.attributeValue ? 'contained' : 'text'}
          onClick={() => setValue(v.attributeValue)}
        >
          ریز سند
        </Button>
      ),
    },
  ];

  const lineColumns: DataTableColumn<AttributeAccountLineDto>[] = [
    { key: 'no', header: 'شماره سند', width: 90, render: (l) => toPersianDigits(l.docNum ?? '—') },
    { key: 'date', header: 'تاریخ سند', width: 110, render: (l) => jalali(l.dateDoc) },
    { key: 'life', header: 'وضعیت', render: (l) => (l.docLife ? getDocLifeLabel(l.docLife) : '—') },
    { key: 'desc', header: 'شرح آرتیکل', render: (l) => l.lineDesc || l.headDesc || '—' },
    { key: 'd', header: 'بدهکار', align: 'end', render: (l) => (l.debtor ? amount(l.debtor) : '—') },
    { key: 'c', header: 'بستانکار', align: 'end', render: (l) => (l.creditor ? amount(l.creditor) : '—') },
    {
      key: 'act',
      header: '',
      align: 'end',
      render: (l) => (
        <Tooltip title="نمایش سند">
          <IconButton size="small" color="primary" onClick={() => navigate(`/operation/vouchers/${l.voucherHeadId}/view`)}>
            <VisibilityOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  const lines = linesQuery.data ?? [];

  return (
    <section>
      <PageHeader
        icon={<RuleOutlinedIcon />}
        title="مغایرت‌گیری حساب‌های شناسه‌دار"
        description={`معین‌هایی که شناسه دارند، شناسه‌های تسویه‌نشده و ردیف‌های سند هرکدام. ${unitLabel ?? ''} سال ${toPersianDigits(financialYear || '-')}.`}
      />

      <Paper
        variant="outlined"
        sx={{ p: 2, mb: 2 }}
        component="form"
        noValidate
        onSubmit={(e: React.FormEvent) => {
          e.preventDefault();
          apply();
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' } }}>
          <JalaliDateField
            label="از تاریخ"
            value={draft.fromDate}
            onChange={(v) => setDraft((d) => ({ ...d, fromDate: v }))}
            size="small"
          />
          <JalaliDateField
            label="تا تاریخ"
            value={draft.toDate}
            onChange={(v) => setDraft((d) => ({ ...d, toDate: v }))}
            size="small"
          />
          <TextField
            select
            size="small"
            label="وضعیت سند"
            value={draft.docLife}
            onChange={(e) => setDraft((d) => ({ ...d, docLife: e.target.value }))}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">همه</MenuItem>
            {DOC_LIFE_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={String(o.value)}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          <Button type="submit" variant="contained">
            نمایش
          </Button>
          <FormControlLabel
            control={<Switch checked={onlyMismatched} onChange={(e) => setOnlyMismatched(e.target.checked)} />}
            label="فقط مغایرها"
          />
        </Stack>
      </Paper>

      {moeinsQuery.isError && <ErrorBanner error={moeinsQuery.error} />}
      {moeinsQuery.data && <StatTiles tiles={tiles} />}

      <DataTable
        columns={moeinColumns}
        rows={moeins}
        getRowKey={(m) => m.accountId}
        isLoading={moeinsQuery.isLoading}
        isRowHighlighted={(m) => m.accountId === moein?.accountId}
        emptyMessage={onlyMismatched ? 'مغایرتی یافت نشد.' : 'برای این واحد و سال، معین شناسه‌داری تعریف نشده است.'}
      />

      {moein && (
        <Paper variant="outlined" sx={{ p: 2, mt: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            شناسه‌های معین <MonoCode value={moein.accCode} /> {moein.accName ?? ''} ({ATTRIB_SUM_LABEL[moein.attribSum]})
          </Typography>
          {valuesQuery.isError && <ErrorBanner error={valuesQuery.error} />}
          <DataTable
            columns={valueColumns}
            rows={values}
            getRowKey={(v) => v.attributeValue ?? '__none__'}
            isLoading={valuesQuery.isLoading}
            isRowHighlighted={(v) => v.attributeValue === value}
            emptyMessage={onlyMismatched ? 'این معین شناسهٔ مغایر ندارد.' : 'ردیفی روی این معین نیست.'}
          />
        </Paper>
      )}

      {moein && value !== undefined && (
        <Paper variant="outlined" sx={{ p: 2, mt: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            ریز سند: {value === null ? 'ردیف‌های بدون شناسه' : <>شناسهٔ <MonoCode value={value} /></>}
          </Typography>
          {linesQuery.isError && <ErrorBanner error={linesQuery.error} />}
          <DataTable
            columns={lineColumns}
            rows={lines}
            getRowKey={(l) => l.lineId}
            isLoading={linesQuery.isLoading}
            emptyMessage="ردیفی یافت نشد."
          />
          {lines.length > 0 && (
            <Stack direction="row" spacing={3} sx={{ mt: 1.5, justifyContent: 'flex-end' }}>
              <Typography variant="body2">جمع بدهکار: {amount(lines.reduce((s, l) => s + l.debtor, 0))}</Typography>
              <Typography variant="body2">جمع بستانکار: {amount(lines.reduce((s, l) => s + l.creditor, 0))}</Typography>
            </Stack>
          )}
        </Paper>
      )}
    </section>
  );
}
