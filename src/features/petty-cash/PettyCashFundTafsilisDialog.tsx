import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { ErrorBanner } from '../../components/ErrorBanner';
import { TafsiliLevelFields, type TafsiliLinkValue } from '../../components/dynamic-tafsili/TafsiliLevelFields';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { pettyCashFundTafsilisApi } from './api';
import type { PettyCashFundDto } from '../../types/pettyCash';

interface PettyCashFundTafsilisDialogProps {
  fund: PettyCashFundDto | null;
  open: boolean;
  onClose: () => void;
}

/**
 * تفصیلی(های) حساب معین تنخواه (`TB_PC_FUND_LINK_TAFSILI`) — بخش ۳-ب
 * (`docs/tankhah-khazaneh-module.md` §۹). جایگزینی کامل با `POST funds/{fundId}/tafsilis`، همان
 * الگوی `TafsiliLevelFields` که `RevolvingFundFormPage`/`ExpenseFormPage` استفاده می‌کنند — با این
 * تفاوت که اینجا یک endpoint مستقل است (نه بخشی از بدنهٔ ساخت/ویرایش تنخواه)، چون
 * `PettyCashFundFormDialog` هیچ فیلد تفصیلی‌ای ندارد.
 */
export function PettyCashFundTafsilisDialog({ fund, open, onClose }: PettyCashFundTafsilisDialogProps) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [links, setLinks] = useState<TafsiliLinkValue[]>([]);

  const tafsilisQuery = useQuery({
    queryKey: ['petty-cash-fund-tafsilis', fund?.id],
    queryFn: () => pettyCashFundTafsilisApi.list(fund!.id),
    enabled: open && fund !== null,
  });

  useEffect(() => {
    if (!open) return;
    if (!tafsilisQuery.data) return;
    setLinks(
      tafsilisQuery.data.map((row) => ({
        levelId: row.levelId,
        tafsiliId: row.tafsiliId,
        label: `${row.tafsiliCode ?? ''} - ${row.tafsiliTitle ?? ''}`,
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tafsilisQuery.data]);

  useEffect(() => {
    if (!open) setLinks([]);
  }, [open]);

  const saveMutation = useMutation({
    mutationFn: () =>
      pettyCashFundTafsilisApi.upsert(
        fund!.id,
        links.map((link) => ({ tafsiliId: link.tafsiliId, levelId: link.levelId })),
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['petty-cash-fund-tafsilis', fund?.id] }),
        queryClient.invalidateQueries({ queryKey: ['petty-cash-settlement'] }),
      ]);
      notify('تفصیلی‌های حساب معین تنخواه ذخیره شد.');
      onClose();
    },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>تفصیلی‌های حساب معین {fund?.name ? `«${fund.name}»` : ''}</DialogTitle>
      <DialogContent>
        {saveMutation.error !== undefined && saveMutation.error !== null && <ErrorBanner error={saveMutation.error} />}
        {tafsilisQuery.isError && <ErrorBanner error={tafsilisQuery.error} />}

        {!fund?.accountCodeId && (
          <Typography variant="body2" color="text.secondary">
            ابتدا از «ویرایش تنخواه» یک حساب معین برای این تنخواه تعریف کنید.
          </Typography>
        )}

        {fund?.accountCodeId && !tafsilisQuery.isLoading && (
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <TafsiliLevelFields accountCodeId={fund.accountCodeId} value={links} onChange={setLinks} />
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={saveMutation.isPending}>
          انصراف
        </Button>
        <Button
          variant="contained"
          disabled={saveMutation.isPending || !fund?.accountCodeId}
          startIcon={saveMutation.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? 'در حال ذخیره…' : 'ذخیره'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
