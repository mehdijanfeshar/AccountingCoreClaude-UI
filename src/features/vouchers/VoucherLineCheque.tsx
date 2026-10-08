import { useEffect, useState } from 'react';
import { Controller, useWatch, type UseFormReturn } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import { JalaliDateField } from '../../components/JalaliDateField';
import { toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import { chequeBookApi, type SoriChequeBookDto } from '../cheque-book/api';
import type { VoucherEntryFormSchema } from './voucherEntrySchema';

/** مدرک ردیف حساب بانکی. بدهکار (واریز): فیش یا حواله. بستانکار (برداشت): چک یا اعلامیهٔ صوری. */
type BankDoc = 'sori' | 'cheque' | 'fish' | 'havale';
type PickerMode = 'all' | 'real' | 'sori';

interface Props {
  form: UseFormReturn<VoucherEntryFormSchema>;
  index: number;
  /** Bumped by the row to open the picker (amount entered on a bank credit line with no cheque yet). */
  openRequest?: number;
}

/**
 * دفتر چک — چک ردیف سند: انتخاب برگ چک از دسته‌چک‌های حساب‌های بانکی همین معین، و «در وجه»، تاریخ و
 * بابت که برای چاپ چک لازم‌اند. در حالت ویرایش، اطلاعات چک موجود از سرور خوانده می‌شود.
 * چک صوری: دسته‌چک صوری انتخاب می‌شود و شمارهٔ بعدی (سال + کد واحد + ۰۰۰۱..۱۰۰۰) هنگام ثبت ردیف در سرور صادر
 * و برگش ساخته می‌شود.
 */
export function VoucherLineCheque({ form, index, openRequest = 0 }: Props) {
  const { control, setValue, formState } = form;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const accountId = useWatch({ control, name: `lines.${index}.accountId` });
  const checkId = useWatch({ control, name: `lines.${index}.checkId` });
  const checkLabel = useWatch({ control, name: `lines.${index}.checkLabel` });
  const soriCheckBookId = useWatch({ control, name: `lines.${index}.soriCheckBookId` });
  const chequeSori = useWatch({ control, name: `lines.${index}.chequeSori` });
  const loaded = useWatch({ control, name: `lines.${index}.chequeLoaded` });
  const errors = formState.errors.lines?.[index];
  const extrasReq = useWatch({ control, name: `lines.${index}.extrasReq` });
  const creditor = useWatch({ control, name: `lines.${index}.creditor` });
  const debtor = useWatch({ control, name: `lines.${index}.debtor` });
  const receiptKind = useWatch({ control, name: `lines.${index}.receiptKind` });
  const [pickerMode, setPickerMode] = useState<PickerMode>('all');
  // مدرک بانکی فقط برای معینی که در تعریف حساب بانک آمده، و آنجا الزامی است.
  const isBank = !!extrasReq?.isBankAccount;
  const side: 'debit' | 'credit' | null = Number(debtor || 0) > 0 ? 'debit' : Number(creditor || 0) > 0 ? 'credit' : null;

  useEffect(() => {
    if (openRequest > 0) {
      setPickerMode('all');
      setPickerOpen(true);
    }
  }, [openRequest]);

  const summary = useQuery({
    queryKey: ['cheque-summary', checkId],
    queryFn: () => chequeBookApi.get(checkId),
    enabled: !!checkId && !loaded,
  });

  useEffect(() => {
    if (!summary.data || loaded) return;
    setValue(`lines.${index}.checkLabel`, `${summary.data.isSori ? 'چک صوری' : 'چک'} ${summary.data.chequeNo}`);
    setValue(`lines.${index}.chequeSori`, summary.data.isSori);
    setValue(`lines.${index}.chequePayTo`, summary.data.payTo ?? '');
    setValue(`lines.${index}.chequeDate`, summary.data.chequeDate ?? '');
    setValue(`lines.${index}.chequeDesc`, summary.data.description ?? '');
    setValue(`lines.${index}.chequeLoaded`, true);
  }, [summary.data, loaded, index, setValue]);

  const available = useQuery({
    queryKey: ['cheques-available', accountId, search],
    queryFn: () => chequeBookApi.available(accountId || null, toLatinDigits(search.trim())),
    enabled: pickerOpen && pickerMode !== 'sori',
  });

  const soriBooks = useQuery({
    queryKey: ['cheque-sori-books', accountId],
    queryFn: () => chequeBookApi.soriBooks(accountId || null),
    enabled: pickerOpen && pickerMode !== 'real',
  });

  function clear() {
    setValue(`lines.${index}.checkId`, '', { shouldDirty: true });
    setValue(`lines.${index}.checkLabel`, '', { shouldDirty: true });
    setValue(`lines.${index}.soriCheckBookId`, '', { shouldDirty: true });
    setValue(`lines.${index}.chequeSori`, false);
    setValue(`lines.${index}.chequeLoaded`, true);
    setValue(`lines.${index}.chequePayTo`, '', { shouldDirty: true });
    setValue(`lines.${index}.chequeDate`, '', { shouldDirty: true });
    setValue(`lines.${index}.chequeDesc`, '', { shouldDirty: true });
  }

  const hasCheque = !!checkId || !!soriCheckBookId;
  const locked = summary.data?.isPrinted === true;
  const selected: BankDoc | '' = hasCheque
    ? soriCheckBookId || chequeSori ? 'sori' : 'cheque'
    : side === 'debit' ? (receiptKind === '2' ? 'havale' : 'fish') : '';

  function choose(doc: BankDoc) {
    if (doc === 'fish' || doc === 'havale') {
      setValue(`lines.${index}.receiptKind`, doc === 'havale' ? '2' : '1', { shouldDirty: true });
      return;
    }
    if (hasCheque) clear();
    setPickerMode(doc === 'sori' ? 'sori' : 'real');
    setPickerOpen(true);
  }

  /**
   * One choice for the line's bank document, with the options of the wrong side disabled rather
   * than hidden, so the user sees that a slip belongs to a deposit and a cheque to a withdrawal.
   */
  const docRadios = isBank ? (
    <Grid size={12}>
      <RadioGroup row value={selected} onChange={(e) => choose(e.target.value as BankDoc)} aria-label="مدرک بانکی ردیف">
        <FormControlLabel value="sori" control={<Radio size="small" />} label="اعلامیه صوری" disabled={side !== 'credit' || locked} />
        <FormControlLabel value="cheque" control={<Radio size="small" />} label="چک" disabled={side !== 'credit' || locked} />
        <FormControlLabel value="fish" control={<Radio size="small" />} label="فیش" disabled={side !== 'debit'} />
        <FormControlLabel value="havale" control={<Radio size="small" />} label="حواله" disabled={side !== 'debit'} />
      </RadioGroup>
      {!side && (
        <Typography variant="caption" color="text.secondary">
          ابتدا مبلغ را وارد کنید: بدهکار با فیش یا حواله، بستانکار با چک یا اعلامیهٔ صوری.
        </Typography>
      )}
    </Grid>
  ) : null;

  if (!hasCheque) {
    if (!isBank) return null;
    return (
      <>
        {docRadios}
        <ChequePicker
          mode={pickerMode}
          error={available.error ?? soriBooks.error}
          open={pickerOpen}
          search={search}
          onSearch={setSearch}
          loading={available.isLoading}
          items={available.data ?? []}
          soriBooks={soriBooks.data ?? []}
          onSelectSori={(b) => {
            setValue(`lines.${index}.soriCheckBookId`, b.checkBookId, { shouldDirty: true });
            setValue(`lines.${index}.chequeSori`, true);
            setValue(
              `lines.${index}.checkLabel`,
              `چک صوری ${b.nextNumber ?? ''} (شماره هنگام ثبت قطعی می‌شود)، ${b.bankName ?? ''} ${b.accountNumber ?? ''}`,
              { shouldDirty: true },
            );
            setValue(`lines.${index}.chequeLoaded`, true);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
          onSelect={(c) => {
            setValue(`lines.${index}.checkId`, c.checkId, { shouldDirty: true });
            setValue(`lines.${index}.checkLabel`, `چک ${c.chequeNo}، ${c.bankName ?? ''} ${c.accountNumber ?? ''}`, { shouldDirty: true });
            setValue(`lines.${index}.chequeLoaded`, true);
            setPickerOpen(false);
          }}
        />
      </>
    );
  }

  return (
    <>
      {docRadios}
      <Grid size={12}>
        <Chip
          icon={<PaymentsOutlinedIcon />}
          color="primary"
          variant="outlined"
          label={toPersianDigits(checkLabel || 'چک')}
          onDelete={locked ? undefined : clear}
        />
        {locked && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            این چک چاپ شده است و اطلاعاتش قابل تغییر نیست.
          </Typography>
        )}
      </Grid>
      <Grid size={{ xs: 12, sm: 5 }}>
        <Controller
          control={control}
          name={`lines.${index}.chequePayTo`}
          render={({ field }) => (
            <TextField {...field} label="در وجه" required={!chequeSori} fullWidth size="small" disabled={!loaded || locked}
              error={!!errors?.chequePayTo} helperText={errors?.chequePayTo?.message} />
          )}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 3 }}>
        <Controller
          control={control}
          name={`lines.${index}.chequeDate`}
          render={({ field }) => (
            <JalaliDateField label="تاریخ چک (سررسید)" required={!chequeSori} size="small" fullWidth disabled={!loaded || locked}
              value={field.value} onChange={field.onChange}
              error={!!errors?.chequeDate} helperText={errors?.chequeDate?.message} />
          )}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 4 }}>
        <Controller
          control={control}
          name={`lines.${index}.chequeDesc`}
          render={({ field }) => (
            <TextField {...field} label="بابت" fullWidth size="small" disabled={!loaded || locked}
              error={!!errors?.chequeDesc} helperText={errors?.chequeDesc?.message} />
          )}
        />
      </Grid>
    </>
  );
}

function ChequePicker({
  mode, error, open, search, onSearch, loading, items, soriBooks, onClose, onSelect, onSelectSori,
}: {
  mode: PickerMode;
  error: unknown;
  soriBooks: SoriChequeBookDto[];
  onSelectSori: (b: SoriChequeBookDto) => void;
  open: boolean;
  search: string;
  onSearch: (v: string) => void;
  loading: boolean;
  items: { checkId: string; chequeNo: string; checkBookTitle: string | null; accountNumber: string | null; bankName: string | null }[];
  onClose: () => void;
  onSelect: (c: { checkId: string; chequeNo: string; accountNumber: string | null; bankName: string | null }) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{mode === 'sori' ? 'انتخاب اعلامیهٔ صوری' : 'انتخاب برگ چک'}</DialogTitle>
      <DialogContent>
        {/* A failed request used to read as «no free leaves»; say it failed instead. */}
        {!!error && <Alert severity="error" sx={{ mt: 1 }}>دریافت فهرست چک‌ها با خطا مواجه شد. دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.</Alert>}
        {mode !== 'sori' && <TextField size="small" fullWidth label="جستجوی شمارهٔ چک" value={search} onChange={(e) => onSearch(e.target.value)} sx={{ mt: 1, mb: 1 }} />}
        <Typography variant="caption" color="text.secondary">
          {mode === 'sori'
            ? 'دسته‌چک‌های صوری حساب‌های بانکی همین معین؛ شمارهٔ مجاز بعدی هنگام ثبت قطعی می‌شود.'
            : 'برگ‌های ابطال‌نشده و استفاده‌نشدهٔ دسته‌چک‌های حساب‌های بانکی متصل به همین معین.'}
        </Typography>
        <List dense sx={{ maxHeight: 360, overflow: 'auto' }}>
          {mode === 'all' && soriBooks.length > 0 && <ListSubheader>چک صوری (اعلامیه)</ListSubheader>}
          {mode === 'sori' && soriBooks.length === 0 && !error && (
            <Typography sx={{ p: 2 }} color="text.secondary">برای حساب بانکی این معین دسته‌چک صوری (اعلامیه) تعریف نشده است.</Typography>
          )}
          {mode !== 'real' && soriBooks.map((b) => (
            <ListItemButton key={b.checkBookId} disabled={!b.nextNumber} onClick={() => onSelectSori(b)}>
              <ListItemText
                primary={b.nextNumber ? `چک صوری — شمارهٔ بعدی ${toPersianDigits(b.nextNumber)}` : 'چک صوری — شماره‌ها تمام شده'}
                secondary={`${b.bankName ?? ''} — حساب ${toPersianDigits(b.accountNumber ?? '')} — ${toPersianDigits(b.fromNumber)} تا ${toPersianDigits(b.toNumber)}`}
              />
            </ListItemButton>
          ))}
          {mode === 'all' && soriBooks.length > 0 && <ListSubheader>برگ چک واقعی</ListSubheader>}
          {mode !== 'sori' && loading && <Typography sx={{ p: 2 }}>در حال دریافت…</Typography>}
          {mode !== 'sori' && !loading && !error && items.length === 0 && (
            <Typography sx={{ p: 2 }} color="text.secondary">
              برگ چک آزادی برای حساب‌های بانکی این معین نیست.
            </Typography>
          )}
          {mode !== 'sori' && items.map((c) => (
            <ListItemButton key={c.checkId} onClick={() => onSelect(c)}>
              <ListItemText
                primary={`چک ${toPersianDigits(c.chequeNo)}`}
                secondary={`${c.bankName ?? ''} — حساب ${toPersianDigits(c.accountNumber ?? '')}${c.checkBookTitle ? ` — ${c.checkBookTitle}` : ''}`}
              />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>بستن</Button>
      </DialogActions>
    </Dialog>
  );
}
