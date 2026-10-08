import { useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import type { AccountCodeDto } from '../../types/accountCode';
import { ELAM_RABET_LABEL, rabetsApi, type RabetDto } from './api';

interface Props {
  accountById: Map<string, AccountCodeDto>;
  accountText: (a: AccountCodeDto | undefined | null, fallbackId?: string | null) => string;
  /** Shared pieces of the settings page, passed in so this tab looks and behaves like its siblings. */
  AccountPickField: (p: { label: string; value: AccountCodeDto | null; onPick: (a: AccountCodeDto) => void }) => ReactNode;
  DeleteAction: (p: { onClick: () => void }) => ReactNode;
}

/**
 * رابط اعلامیه (TB_RABET): سند هر نوع اعلامیه با ردیفی روی حساب رابط همان نوع تراز می‌شود. اگر برای یک نوع چند
 * حساب باشد، سیستم اولی را به ترتیب کد معین برمی‌دارد (ElamWorkflowRepository)؛ ستون «وضعیت» همین را صریح
 * نشان می‌دهد تا حساب‌های اضافه بی‌صدا بی‌اثر نمانند.
 */
export function ElamRabetsTab({ accountById, accountText, AccountPickField, DeleteAction }: Props) {
  const qc = useQueryClient();
  const types = useQuery({ queryKey: ['rabet-types'], queryFn: rabetsApi.types, staleTime: 5 * 60_000 });
  const list = useQuery({ queryKey: ['rabets'], queryFn: rabetsApi.list });
  const [typeId, setTypeId] = useState('');
  const [account, setAccount] = useState<AccountCodeDto | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: () => rabetsApi.create(typeId, account!.id),
    onSuccess: async () => {
      setAccount(null);
      await qc.invalidateQueries({ queryKey: ['rabets'] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => rabetsApi.remove(id),
    onSuccess: async () => {
      setDeleteId(null);
      await qc.invalidateQueries({ queryKey: ['rabets'] });
    },
  });

  const typeList = types.data ?? [];
  const label = (code: string | null, title: string | null) => ELAM_RABET_LABEL[code ?? ''] ?? title ?? code ?? '—';
  const typeLabel = (id: string | null) => {
    const t = typeList.find((x) => x.id === id);
    return t ? label(t.code, t.title) : '—';
  };
  const rows = list.data ?? [];
  const codeOf = (r: RabetDto) => (r.accountCodeId ? accountById.get(r.accountCodeId)?.accCode ?? '' : '');
  // The one the system actually uses per type: the first by account code (ElamWorkflowRepository).
  const usedIds = new Set(
    typeList.flatMap((t) => {
      const first = rows
        .filter((r) => r.rabetTypeId === t.id && r.accountCodeId)
        .sort((a, b) => codeOf(a).localeCompare(codeOf(b)))[0];
      return first ? [first.id] : [];
    }),
  );
  const missing = typeList.filter((t) => !rows.some((r) => r.rabetTypeId === t.id));

  const columns: DataTableColumn<RabetDto>[] = [
    { key: 'type', header: 'نوع اعلامیه', width: 220, render: (r) => typeLabel(r.rabetTypeId) },
    { key: 'account', header: 'حساب رابط', render: (r) => accountText(r.accountCodeId ? accountById.get(r.accountCodeId) : null, r.accountCodeId) },
    {
      key: 'used',
      header: 'وضعیت',
      width: 160,
      render: (r) =>
        usedIds.has(r.id) ? <Chip size="small" color="success" label="در حال استفاده" /> : <Chip size="small" label="استفاده نمی‌شود" />,
    },
    { key: 'actions', header: '', width: 64, render: (r) => <DeleteAction onClick={() => setDeleteId(r.id)} /> },
  ];

  function submit(e: FormEvent) {
    e.preventDefault();
    if (typeId && account) add.mutate();
  }

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '75ch' }}>
        سند هر اعلامیه با ردیفی روی حساب رابط همان نوع تراز می‌شود. برای هر نوع یک حساب کافی است؛ اگر چند حساب تعریف
        شود، سیستم اولی را به ترتیب کد معین به کار می‌برد.
      </Typography>
      <Paper variant="outlined" component="form" onSubmit={submit} sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' } }}>
          <TextField select size="small" label="نوع اعلامیه" value={typeId} onChange={(e) => setTypeId(e.target.value)} sx={{ minWidth: 220 }}>
            {typeList.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {label(t.code, t.title)}
              </MenuItem>
            ))}
          </TextField>
          <AccountPickField label="حساب رابط" value={account} onPick={setAccount} />
          <Button type="submit" variant="contained" startIcon={<AddOutlinedIcon />} disabled={!typeId || !account || add.isPending}>
            افزودن
          </Button>
        </Stack>
        {add.isError && (
          <Box sx={{ mt: 2 }}>
            <ErrorBanner error={add.error} />
          </Box>
        )}
      </Paper>
      {missing.length > 0 && (
        <Alert severity="warning">
          برای {missing.map((t) => `«${label(t.code, t.title)}»`).join(' و ')} حساب رابطی تعریف نشده است؛ صدور سند این نوع اعلامیه خطا می‌دهد.
        </Alert>
      )}
      {(list.isError || types.isError) && <ErrorBanner error={list.error ?? types.error} />}
      <DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} isLoading={list.isLoading} emptyMessage="هنوز حساب رابط اعلامیه‌ای تعریف نشده است." />
      <ConfirmDialog
        open={!!deleteId}
        title="حذف حساب رابط اعلامیه"
        description="اگر این تنها حساب رابط این نوع باشد، صدور سند آن نوع اعلامیه تا تعریف حساب جدید خطا می‌دهد."
        confirmLabel="حذف"
        confirmColor="error"
        pending={remove.isPending}
        onConfirm={() => deleteId && remove.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
      {remove.isError && <ErrorBanner error={remove.error} />}
    </Stack>
  );
}
