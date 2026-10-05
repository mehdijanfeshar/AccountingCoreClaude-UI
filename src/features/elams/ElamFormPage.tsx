import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { JalaliDateField } from '../../components/JalaliDateField';
import { MonoCode } from '../../components/MonoCode';
import { AccountCodePickerDialog } from '../../components/AccountCodePickerDialog';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { useSession } from '../../lib/session/SessionContext';
import { formatThousands, normalizeNumericInput, toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import {
  ELAM_CASE_OPTIONS,
  ELAM_KIND,
  REVENUE_TYPE_OPTIONS,
  WEB_STAT_META,
  elamsApi,
  type ElamCase,
  type ElamKind,
  type ElamViewDto,
} from './api';
import { ElamLineEditor, newLine, type ElamLine } from './ElamLineEditor';
import { amount, jalali } from './ElamsListPage';

interface OtherHead {
  date: string;
  description: string;
  case: ElamCase;
  counterVahedCode: string;
  dabirNo: string;
  dabirDate: string;
}

interface RevenueHead {
  date: string;
  description: string;
  revenueType: number;
  counterVahedCode: string;
  accountId: string;
  accountLabel: string;
  amount: string;
  detailDescription: string;
  workshopCode: string;
  workshopName: string;
  debtNo: string;
  debtDate: string;
  lastMonth: string;
  elamYear: string;
  peimanNo: string;
  payNo: string;
}

const emptyOther: OtherHead = { date: '', description: '', case: 1, counterVahedCode: '', dabirNo: '', dabirDate: '' };
const emptyRevenue: RevenueHead = {
  date: '',
  description: '',
  revenueType: 1,
  counterVahedCode: '',
  accountId: '',
  accountLabel: '',
  amount: '',
  detailDescription: '',
  workshopCode: '',
  workshopName: '',
  debtNo: '',
  debtDate: '',
  lastMonth: '',
  elamYear: '',
  peimanNo: '',
  payNo: '',
};

const nn = (s: string) => (s.trim() ? toLatinDigits(s.trim()) : null);

/** ثبت/ویرایش/نمایش اعلامیه — «سایر اعلامیهٔ صادره» (چندردیفی) یا «اعلامیهٔ درآمد» (تک‌ردیف). */
export function ElamFormPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { financialYear } = useSession();

  const viewQuery = useQuery({ queryKey: ['elam', id], queryFn: () => elamsApi.get(id!), enabled: !!id });
  const units = useQuery({ queryKey: ['elam-units'], queryFn: elamsApi.units });

  const view = viewQuery.data;
  const kind: ElamKind = view ? view.head.kind : ((Number(searchParams.get('kind')) || ELAM_KIND.Sent) as ElamKind);
  const readOnly = !!view && !view.canEdit;

  const [other, setOther] = useState<OtherHead>(emptyOther);
  const [revenue, setRevenue] = useState<RevenueHead>(emptyRevenue);
  const [lines, setLines] = useState<ElamLine[]>([newLine()]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!view) return;
    const h = view.head;
    if (h.kind === ELAM_KIND.Revenue) {
      const d = view.details[0];
      setRevenue({
        date: h.date ?? '',
        description: h.description ?? '',
        revenueType: h.revenueType ?? 1,
        counterVahedCode: h.counterVahedCode ?? '',
        accountId: d?.accountId ?? '',
        accountLabel: d ? `${d.accCode ?? ''} - ${d.accName ?? ''}` : '',
        amount: d ? String(d.debtor + d.creditor) : '',
        detailDescription: d?.description ?? '',
        workshopCode: view.workshopCode ?? '',
        workshopName: view.workshopName ?? '',
        debtNo: view.rcvNo ?? '',
        debtDate: view.rcvDate ?? '',
        lastMonth: view.lastMonth ?? '',
        elamYear: view.elamYear ?? '',
        peimanNo: view.peimanNo ?? '',
        payNo: view.payNo ?? '',
      });
    } else {
      setOther({
        date: h.date ?? '',
        description: h.description ?? '',
        case: h.case ?? 1,
        counterVahedCode: h.counterVahedCode ?? '',
        dabirNo: h.dabirNo ?? '',
        dabirDate: h.dabirDate ?? '',
      });
      setLines(
        view.details.map((d) => ({
          key: d.id,
          accountId: d.accountId ?? '',
          accountLabel: `${d.accCode ?? ''} - ${d.accName ?? ''}`,
          amount: String(d.debtor + d.creditor),
          description: d.description ?? '',
          attribNo: d.attribNo ?? '',
          tafsili: Object.fromEntries(
            d.tafsilis.map((t) => [
              t.levelId,
              { levelId: t.levelId, tafsiliId: t.tafsiliId, label: `${t.code ?? ''} - ${t.name ?? ''}` },
            ]),
          ),
        })),
      );
    }
  }, [view]);

  const total = useMemo(() => lines.reduce((s, l) => s + (Number(l.amount) || 0), 0), [lines]);

  const save = useMutation({
    mutationFn: async () => {
      if (kind === ELAM_KIND.Revenue) {
        const body = {
          year: financialYear,
          date: revenue.date,
          description: revenue.description.trim(),
          revenueType: revenue.revenueType,
          counterVahedCode: toLatinDigits(revenue.counterVahedCode.trim()),
          accountId: revenue.accountId,
          amount: Number(revenue.amount) || 0,
          detailDescription: nn(revenue.detailDescription),
          workshopId: view?.workshopId ?? null,
          workshopCode: nn(revenue.workshopCode),
          workshopName: revenue.workshopName.trim() || null,
          debtNo: nn(revenue.debtNo),
          debtDate: revenue.debtDate || null,
          lastMonth: nn(revenue.lastMonth),
          elamYear: nn(revenue.elamYear),
          peimanNo: nn(revenue.peimanNo),
          payNo: nn(revenue.payNo),
        };
        return id ? (await elamsApi.updateRevenue(id, body), id) : elamsApi.createRevenue(body);
      }
      const body = {
        year: financialYear,
        date: other.date,
        description: other.description.trim(),
        case: other.case,
        counterVahedCode: other.counterVahedCode,
        dabirNo: nn(other.dabirNo),
        dabirDate: other.dabirDate || null,
        details: lines.map((l) => ({
          accountId: l.accountId,
          amount: Number(l.amount) || 0,
          description: l.description.trim() || null,
          attribNo: nn(l.attribNo),
          tafsiliLinks: Object.values(l.tafsili).map((t) => ({ tafsiliId: t.tafsiliId, levelId: t.levelId })),
        })),
      };
      return id ? (await elamsApi.updateOther(id, body), id) : elamsApi.createOther(body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['elams'] });
      await queryClient.invalidateQueries({ queryKey: ['elam', id] });
      notify(id ? 'اعلامیه ویرایش شد.' : 'اعلامیه ثبت شد.');
      navigate(`/operation/elams?kind=${kind}`);
    },
  });

  const title = id
    ? readOnly
      ? 'نمایش اعلامیه'
      : 'ویرایش اعلامیه'
    : kind === ELAM_KIND.Revenue
      ? 'اعلامیهٔ صادرهٔ درآمد جدید'
      : 'سایر اعلامیهٔ صادرهٔ جدید';

  if (id && viewQuery.isLoading) return <Skeleton variant="rounded" height={320} />;
  if (id && viewQuery.isError) return <ErrorBanner error={viewQuery.error} />;

  const unitOptions = (units.data ?? []).map((u) => (
    <MenuItem key={u.vahedCode} value={u.vahedCode}>
      {toPersianDigits(u.vahedCode)} — {u.vahedName}
    </MenuItem>
  ));

  return (
    <section>
      <PageHeader
        eyebrow="عملیات · اعلامیه"
        icon={<CampaignOutlinedIcon />}
        title={title}
        description={
          view
            ? `سریال ${toPersianDigits(view.head.serialNo ?? '')}${view.rabetCode ? ` · حساب رابط ${toPersianDigits(view.rabetCode)}` : ''}`
            : 'سریال و حساب رابط هنگام ثبت خودکار تعیین می‌شوند.'
        }
        actions={
          <Button startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate(`/operation/elams?kind=${kind}`)}>
            بازگشت
          </Button>
        }
      />

      {view && <ElamStatusBar view={view} onOpenVoucher={(vid) => navigate(`/operation/vouchers/${vid}/view`)} />}
      {readOnly && (
        <Alert severity="info" sx={{ mb: 2 }}>
          این اعلامیه سند دارد یا ارسال/دریافت شده است و فقط قابل مشاهده است.
        </Alert>
      )}
      {save.isError && <ErrorBanner error={save.error} />}

      {kind === ELAM_KIND.Revenue ? (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <JalaliDateField label="تاریخ اعلامیه" required size="small" fullWidth disabled={readOnly}
                value={revenue.date} onChange={(v) => setRevenue({ ...revenue, date: v })} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField select fullWidth size="small" label="نوع درآمد" disabled={readOnly}
                value={revenue.revenueType} onChange={(e) => setRevenue({ ...revenue, revenueType: Number(e.target.value) })}>
                {REVENUE_TYPE_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField select fullWidth size="small" required label="واحد شعبه" disabled={readOnly}
                value={revenue.counterVahedCode} onChange={(e) => setRevenue({ ...revenue, counterVahedCode: e.target.value })}>
                {unitOptions}
              </TextField>
            </Grid>
            <Grid size={12}>
              <TextField fullWidth size="small" required label="شرح اعلامیه" disabled={readOnly}
                value={revenue.description} onChange={(e) => setRevenue({ ...revenue, description: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth size="small" required label="معین" value={revenue.accountLabel} disabled={readOnly}
                onClick={() => !readOnly && setPickerOpen(true)}
                slotProps={{ input: { readOnly: true, endAdornment: <InputAdornment position="end"><SearchOutlinedIcon fontSize="small" /></InputAdornment> } }} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField fullWidth size="small" required label="مبلغ" disabled={readOnly}
                value={revenue.amount ? toPersianDigits(formatThousands(revenue.amount)) : ''}
                onChange={(e) => setRevenue({ ...revenue, amount: normalizeNumericInput(e.target.value).replace(/[.-]/g, '') })}
                slotProps={{ htmlInput: { inputMode: 'numeric', dir: 'ltr' } }} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField fullWidth size="small" label="شرح ردیف" disabled={readOnly}
                value={revenue.detailDescription} onChange={(e) => setRevenue({ ...revenue, detailDescription: e.target.value })} />
            </Grid>
            <Grid size={12}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1 }}>اطلاعات ارسال به سامانهٔ سبا (درآمد)</Typography>
            </Grid>
            {(
              [
                ['workshopCode', 'کد کارگاه (۱۰ رقم)', 3],
                ['workshopName', 'نام کارگاه', 5],
                ['debtNo', 'شمارهٔ بدهی', 4],
                ['lastMonth', 'ماه بدهی (۰۱..۱۲)', 2],
                ['elamYear', 'سال اعلامیه (دو رقم)', 2],
                ['peimanNo', 'شمارهٔ پیمان', 4],
                ['payNo', 'شمارهٔ پرداخت', 4],
              ] as const
            ).map(([key, label, w]) => (
              <Grid key={key} size={{ xs: 12, md: w }}>
                <TextField fullWidth size="small" label={label} disabled={readOnly}
                  value={revenue[key]} onChange={(e) => setRevenue({ ...revenue, [key]: e.target.value })} />
              </Grid>
            ))}
            <Grid size={{ xs: 12, md: 4 }}>
              <JalaliDateField label="تاریخ بدهی" size="small" fullWidth disabled={readOnly}
                value={revenue.debtDate} onChange={(v) => setRevenue({ ...revenue, debtDate: v })} />
            </Grid>
          </Grid>
          <AccountCodePickerDialog
            open={pickerOpen}
            title="انتخاب حساب معین"
            onClose={() => setPickerOpen(false)}
            onSelect={(a) => {
              setPickerOpen(false);
              setRevenue({ ...revenue, accountId: a.id, accountLabel: `${a.accCode ?? ''} - ${a.accCodeName ?? ''}` });
            }}
          />
        </Paper>
      ) : (
        <>
          <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 3 }}>
                <JalaliDateField label="تاریخ اعلامیه" required size="small" fullWidth disabled={readOnly}
                  value={other.date} onChange={(v) => setOther({ ...other, date: v })} />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField select fullWidth size="small" label="ماهیت اعلامیه" disabled={readOnly}
                  helperText={other.case === 1 ? 'ردیف‌ها بستانکار، رابط بدهکار' : 'ردیف‌ها بدهکار، رابط بستانکار'}
                  value={other.case} onChange={(e) => setOther({ ...other, case: Number(e.target.value) as ElamCase })}>
                  {ELAM_CASE_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField select fullWidth size="small" required disabled={readOnly}
                  label={kind === ELAM_KIND.Received ? 'واحد فرستنده' : 'واحد گیرنده'}
                  value={other.counterVahedCode} onChange={(e) => setOther({ ...other, counterVahedCode: e.target.value })}>
                  {unitOptions}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth size="small" required label="شرح اعلامیه" disabled={readOnly}
                  value={other.description} onChange={(e) => setOther({ ...other, description: e.target.value })} />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField fullWidth size="small" label="شمارهٔ دبیرخانه" disabled={readOnly}
                  value={other.dabirNo} onChange={(e) => setOther({ ...other, dabirNo: e.target.value })} />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <JalaliDateField label="تاریخ دبیرخانه" size="small" fullWidth disabled={readOnly}
                  value={other.dabirDate} onChange={(v) => setOther({ ...other, dabirDate: v })} />
              </Grid>
            </Grid>
          </Paper>

          {readOnly && view ? (
            <ElamDetailsTable view={view} />
          ) : (
            <Stack spacing={2}>
              {lines.map((line, i) => (
                <ElamLineEditor
                  key={line.key}
                  index={i}
                  line={line}
                  onChange={(next) => setLines(lines.map((l) => (l.key === line.key ? next : l)))}
                  onRemove={lines.length > 1 ? () => setLines(lines.filter((l) => l.key !== line.key)) : undefined}
                />
              ))}
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Button startIcon={<AddOutlinedIcon />} onClick={() => setLines([...lines, newLine()])}>
                  افزودن ردیف
                </Button>
                <Typography variant="body2">
                  جمع ردیف‌ها: <b>{amount(total)}</b> — ردیف حساب رابط هنگام صدور سند به همین مبلغ
                  {other.case === 1 ? ' بدهکار' : ' بستانکار'} می‌شود.
                </Typography>
              </Stack>
            </Stack>
          )}
        </>
      )}

      {kind === ELAM_KIND.Revenue && readOnly && view && <ElamDetailsTable view={view} />}

      {!readOnly && (
        <Stack direction="row" spacing={1} sx={{ mt: 3, justifyContent: 'flex-end' }}>
          <Button onClick={() => navigate(`/operation/elams?kind=${kind}`)}>انصراف</Button>
          <Button variant="contained" startIcon={<SaveOutlinedIcon />} disabled={save.isPending} onClick={() => save.mutate()}>
            {id ? 'ذخیرهٔ تغییرات' : 'ثبت اعلامیه'}
          </Button>
        </Stack>
      )}
    </section>
  );
}

function ElamStatusBar({ view, onOpenVoucher }: { view: ElamViewDto; onOpenVoucher: (id: string) => void }) {
  const m = WEB_STAT_META[view.head.webStat ?? 0];
  return (
    <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
      {m && <Chip color={m.color} label={m.label} />}
      <Typography variant="body2" color="text.secondary">
        تاریخ {jalali(view.head.date)} · مبلغ {amount(view.head.amount)}
      </Typography>
      {view.head.voucherHeadId && (
        <Button size="small" onClick={() => onOpenVoucher(view.head.voucherHeadId!)}>
          سند {toPersianDigits(view.head.voucherNumber ?? '')}
        </Button>
      )}
    </Stack>
  );
}

function ElamDetailsTable({ view }: { view: ElamViewDto }) {
  return (
    <Paper variant="outlined" sx={{ mt: 2, overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>معین</TableCell>
            <TableCell>تفصیلی‌ها</TableCell>
            <TableCell>شرح</TableCell>
            <TableCell>شناسه</TableCell>
            <TableCell align="right">بدهکار</TableCell>
            <TableCell align="right">بستانکار</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {view.details.map((d) => (
            <TableRow key={d.id}>
              <TableCell>
                <MonoCode value={d.accCode} /> {d.accName}
              </TableCell>
              <TableCell>{d.tafsilis.map((t) => `${t.code ?? ''} ${t.name ?? ''}`).join('، ') || '—'}</TableCell>
              <TableCell>{d.description ?? '—'}</TableCell>
              <TableCell>{toPersianDigits(d.attribNo ?? '—')}</TableCell>
              <TableCell align="right">{d.debtor ? amount(d.debtor) : '—'}</TableCell>
              <TableCell align="right">{d.creditor ? amount(d.creditor) : '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}
