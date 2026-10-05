import { useEffect, useState } from 'react';
import { Controller, useWatch, type UseFormReturn } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
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

interface Props {
  form: UseFormReturn<VoucherEntryFormSchema>;
  index: number;
}

/**
 * دفتر چک — چک ردیف سند: انتخاب برگ چک از دسته‌چک‌های حساب‌های بانکی همین معین، و «در وجه»، تاریخ و
 * بابت که برای چاپ چک لازم‌اند. در حالت ویرایش، اطلاعات چک موجود از سرور خوانده می‌شود.
 * چک صوری: دسته‌چک صوری انتخاب می‌شود و شمارهٔ بعدی (سال + کد واحد + ۰۰۰۱..۱۰۰۰) هنگام ثبت ردیف در سرور صادر
 * و برگش ساخته می‌شود.
 */
export function VoucherLineCheque({ form, index }: Props) {
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
    enabled: pickerOpen,
  });

  const soriBooks = useQuery({
    queryKey: ['cheque-sori-books', accountId],
    queryFn: () => chequeBookApi.soriBooks(accountId || null),
    enabled: pickerOpen,
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

  if (!checkId && !soriCheckBookId) {
    return (
      <Grid size={12}>
        <Button size="small" startIcon={<PaymentsOutlinedIcon />} disabled={!accountId} onClick={() => setPickerOpen(true)}>
          انتخاب برگ چک
        </Button>
        <ChequePicker
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
              `چک صوری ${b.nextNumber ?? ''} (شماره هنگام ثبت قطعی می‌شود) — ${b.bankName ?? ''} ${b.accountNumber ?? ''}`,
              { shouldDirty: true },
            );
            setValue(`lines.${index}.chequeLoaded`, true);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
          onSelect={(c) => {
            setValue(`lines.${index}.checkId`, c.checkId, { shouldDirty: true });
            setValue(`lines.${index}.checkLabel`, `چک ${c.chequeNo} — ${c.bankName ?? ''} ${c.accountNumber ?? ''}`, { shouldDirty: true });
            setValue(`lines.${index}.chequeLoaded`, true);
            setPickerOpen(false);
          }}
        />
      </Grid>
    );
  }

  const locked = summary.data?.isPrinted === true;

  return (
    <>
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
  open, search, onSearch, loading, items, soriBooks, onClose, onSelect, onSelectSori,
}: {
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
      <DialogTitle>انتخاب برگ چک</DialogTitle>
      <DialogContent>
        <TextField size="small" fullWidth label="جستجوی شمارهٔ چک" value={search} onChange={(e) => onSearch(e.target.value)} sx={{ mt: 1, mb: 1 }} />
        <Typography variant="caption" color="text.secondary">
          برگ‌های ابطال‌نشده و استفاده‌نشدهٔ دسته‌چک‌های حساب‌های بانکی متصل به همین معین.
        </Typography>
        <List dense sx={{ maxHeight: 360, overflow: 'auto' }}>
          {soriBooks.length > 0 && <ListSubheader>چک صوری (اعلامیه)</ListSubheader>}
          {soriBooks.map((b) => (
            <ListItemButton key={b.checkBookId} disabled={!b.nextNumber} onClick={() => onSelectSori(b)}>
              <ListItemText
                primary={b.nextNumber ? `چک صوری — شمارهٔ بعدی ${toPersianDigits(b.nextNumber)}` : 'چک صوری — شماره‌ها تمام شده'}
                secondary={`${b.bankName ?? ''} — حساب ${toPersianDigits(b.accountNumber ?? '')} — ${toPersianDigits(b.fromNumber)} تا ${toPersianDigits(b.toNumber)}`}
              />
            </ListItemButton>
          ))}
          {soriBooks.length > 0 && <ListSubheader>برگ چک واقعی</ListSubheader>}
          {loading && <Typography sx={{ p: 2 }}>در حال دریافت…</Typography>}
          {!loading && items.length === 0 && (
            <Typography sx={{ p: 2 }} color="text.secondary">
              برگ چک آزادی برای حساب‌های بانکی این معین نیست.
            </Typography>
          )}
          {items.map((c) => (
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
