import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import GridOnOutlinedIcon from "@mui/icons-material/GridOnOutlined";
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ErrorBanner } from '../../components/ErrorBanner';
import { MonoCode } from '../../components/MonoCode';
import { Pagination } from '../../components/Pagination';
import { toPersianDigits } from '../../lib/format/numbers';
import { FS_VALUE_TYPE_OPTIONS, labelOf } from '../../types/fsTemplate';
import type { FsDrillAccountDto, FsDrillUnitDto, FsDrillVoucherLineDto, FsRunRowDto } from '../../types/fsRun';
import { fsDrillApi } from './api';
import { displayAmount, formatAmount } from './FsStatementSheet';

interface Props {
  runId: string;
  row: FsRunRowDto;
  hasPrior: boolean;
  /** واحد جاری اجرا — برای اجرای جداگانه سطح «واحد» فقط همین است. */
  unitDivisor: number;
  unitLabel: string;
  onClose: () => void;
}

type Level =
  | { kind: 'accounts' }
  | { kind: 'units'; acc?: FsDrillAccountDto }
  | { kind: 'vouchers'; acc: FsDrillAccountDto; unit?: FsDrillUnitDto };

const PAGE_SIZE = 50;

function formatDate(d: string | null): string {
  if (!d || d.length !== 8) return d ?? '—';
  return toPersianDigits(`${d.slice(0, 4)}/${d.slice(4, 6)}/${d.slice(6, 8)}`);
}

/**
 * Drill-down چهارسطحی بدون ترک صفحه (بخش ۴۵-د، سند منبع §۱۲-۱): ردیف ← معین‌ها ← واحدها ← اسناد، با
 * مسیر برگشت. سه سطح اول از Snapshot اجراست؛ سطح «سند» زنده از اسناد خوانده می‌شود، پس اگر اسناد بعد از
 * اجرا تغییر کرده باشند جمعش با مبلغ صورت فرق می‌کند (هشدار داده می‌شود).
 */
export function FsDrillDrawer({ runId, row, hasPrior, unitDivisor, unitLabel, onClose }: Props) {
  const [level, setLevel] = useState<Level>({ kind: 'accounts' });
  const [column, setColumn] = useState<'CUR' | 'PRV'>('CUR');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const fmt = (v: number | null) => formatAmount(displayAmount(row, v), unitDivisor);
  const fmtRial = (v: number) => formatAmount(v, 1);

  const accountsQuery = useQuery({
    queryKey: ['fs-drill-accounts', runId, row.id],
    queryFn: () => fsDrillApi.accounts(runId, row.id),
    enabled: level.kind === 'accounts',
  });

  const unitsAcc = level.kind === 'units' ? level.acc?.accCode : undefined;
  const unitsQuery = useQuery({
    queryKey: ['fs-drill-units', runId, row.id, unitsAcc ?? ''],
    queryFn: () => fsDrillApi.units(runId, row.id, unitsAcc),
    enabled: level.kind === 'units',
  });

  const vouchersKey = level.kind === 'vouchers' ? [level.acc.accCode, level.unit?.vahedCode ?? ''] : [];
  const vouchersQuery = useQuery({
    queryKey: ['fs-drill-vouchers', runId, row.id, ...vouchersKey, column, page, pageSize],
    queryFn: () =>
      level.kind === 'vouchers'
        ? fsDrillApi.vouchers(runId, row.id, {
            acc: level.acc.accCode,
            unit: level.unit?.vahedCode,
            column,
            page,
            pageSize,
          })
        : Promise.reject(new Error('no level')),
    enabled: level.kind === 'vouchers',
  });

  // خروجی Excel سطح جاری (معین‌ها، واحدها، و اگر معین انتخاب شده همهٔ اسنادش).
  const [excelBusy, setExcelBusy] = useState(false);
  const [excelError, setExcelError] = useState<unknown>(null);
  const downloadExcel = async () => {
    const acc = level.kind === "accounts" ? undefined : level.acc?.accCode;
    const unit = level.kind === "vouchers" ? level.unit?.vahedCode : undefined;
    setExcelBusy(true);
    setExcelError(null);
    try {
      await fsDrillApi.downloadDrillExcel(runId, row.id, { acc, unit, column }, `FS-Drill-${row.code}.xlsx`);
    } catch (e) {
      setExcelError(e);
    } finally {
      setExcelBusy(false);
    }
  };

  const go = (next: Level) => {
    setPage(1);
    setLevel(next);
  };

  const total = (items: { amountCur: number | null }[]) => items.reduce((s, i) => s + (i.amountCur ?? 0), 0);

  const accountColumns: DataTableColumn<FsDrillAccountDto>[] = [
    { key: 'code', header: 'کد معین', width: 90, render: (a) => <MonoCode value={a.accCode} /> },
    { key: 'name', header: 'نام', render: (a) => a.accName ?? '—' },
    { key: 'cur', header: 'جاری', align: 'end', render: (a) => fmt(a.amountCur) },
    ...(hasPrior ? [{ key: 'prv', header: 'سال قبل', align: 'end' as const, render: (a: FsDrillAccountDto) => fmt(a.amountPrv) }] : []),
    {
      key: 'share',
      header: 'سهم',
      align: 'end',
      width: 70,
      render: (a) => {
        const t = total(accountsQuery.data ?? []);
        return t ? `${toPersianDigits(((100 * (a.amountCur ?? 0)) / t).toFixed(0))}٪` : '—';
      },
    },
  ];

  const unitColumns: DataTableColumn<FsDrillUnitDto>[] = [
    { key: 'code', header: 'کد واحد', width: 80, render: (u) => <MonoCode value={u.vahedCode} /> },
    { key: 'name', header: 'واحد', render: (u) => u.vahedName ?? '—' },
    { key: 'cur', header: 'جاری', align: 'end', render: (u) => fmt(u.amountCur) },
    ...(hasPrior ? [{ key: 'prv', header: 'سال قبل', align: 'end' as const, render: (u: FsDrillUnitDto) => fmt(u.amountPrv) }] : []),
  ];

  const voucherColumns: DataTableColumn<FsDrillVoucherLineDto>[] = [
    { key: 'date', header: 'تاریخ', width: 90, render: (v) => formatDate(v.dateDoc) },
    { key: 'doc', header: 'سند', width: 70, render: (v) => toPersianDigits(v.docNum ?? '—') },
    { key: 'unit', header: 'واحد', width: 60, render: (v) => <MonoCode value={v.vahedCode} /> },
    {
      key: 'desc',
      header: 'شرح',
      render: (v) => (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          {v.isOpening && <Chip size="small" label="افتتاحیه" variant="outlined" />}
          <Typography variant="body2">{v.lineDesc || v.headDesc || '—'}</Typography>
        </Stack>
      ),
    },
    { key: 'dr', header: 'بدهکار', align: 'end', render: (v) => fmtRial(v.debtor) },
    { key: 'cr', header: 'بستانکار', align: 'end', render: (v) => fmtRial(v.creditor) },
    {
      key: 'open',
      header: '',
      width: 40,
      render: (v) => (
        <Tooltip title="نمایش سند (در صورت دسترسی به واحد سند)">
          <IconButton size="small" component="a" href={`/operation/vouchers/${v.voucherHeadId}/view`} target="_blank" rel="noopener">
            <OpenInNewOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  const cur = displayAmount(row, row.amountCur);
  const prv = displayAmount(row, row.amountPrv);

  return (
    <Drawer anchor="left" open onClose={onClose} slotProps={{ paper: { sx: { width: { xs: '100%', md: 820 }, p: 2.5 } } }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box>
          <Typography variant="overline" color="text.secondary">
            ریز ردیف {row.code}
          </Typography>
          <Typography variant="h6">{row.titleFa}</Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="بستن">
          <CloseIcon />
        </IconButton>
      </Stack>

      <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        <Paper variant="outlined" sx={{ p: 1.5, minWidth: 150, borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary">
            جاری ({unitLabel})
          </Typography>
          <Typography variant="h6" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatAmount(cur, unitDivisor)}
          </Typography>
        </Paper>
        {hasPrior && (
          <>
            <Paper variant="outlined" sx={{ p: 1.5, minWidth: 150, borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary">
                سال قبل
              </Typography>
              <Typography variant="h6" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatAmount(prv, unitDivisor)}
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.5, minWidth: 150, borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary">
                تغییر
              </Typography>
              <Typography variant="h6" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {cur !== null && prv !== null ? formatAmount(cur - prv, unitDivisor) : '—'}
              </Typography>
            </Paper>
          </>
        )}
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        انتخاب‌گر: <MonoCode value={row.selector} /> · {labelOf(FS_VALUE_TYPE_OPTIONS, row.valueType)}
      </Typography>

      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}>
      <Breadcrumbs>
        <Link component="button" underline="hover" onClick={() => go({ kind: 'accounts' })}>
          معین‌ها
        </Link>
        {level.kind !== 'accounts' && (
          <Link
            component="button"
            underline="hover"
            onClick={() => go({ kind: 'units', acc: level.acc })}
          >
            {level.acc ? `واحدها — ${level.acc.accCode}` : 'واحدها (کل ردیف)'}
          </Link>
        )}
        {level.kind === 'vouchers' && <Typography color="text.primary">اسناد{level.unit ? ` — ${level.unit.vahedName ?? level.unit.vahedCode}` : ''}</Typography>}
      </Breadcrumbs>
        <Tooltip title={level.kind === "accounts" ? "معین‌ها و واحدهای این ردیف" : level.kind === "units" && !level.acc ? "معین‌ها و واحدها" : "معین‌ها، واحدها و همهٔ اسناد این معین"}>
          <span>
            <Button size="small" variant="outlined" startIcon={<GridOnOutlinedIcon />} disabled={excelBusy} onClick={downloadExcel}>
              {excelBusy ? "…" : "Excel"}
            </Button>
          </span>
        </Tooltip>
      </Stack>
      {excelError ? <ErrorBanner error={excelError} /> : null}

      {level.kind === 'accounts' && (
        <>
          {accountsQuery.isError && <ErrorBanner error={accountsQuery.error} />}
          <Stack direction="row" sx={{ justifyContent: 'flex-end', mb: 1 }}>
            <Button size="small" onClick={() => go({ kind: 'units' })}>
              به تفکیک واحد (کل ردیف)
            </Button>
          </Stack>
          <DataTable
            columns={accountColumns}
            rows={accountsQuery.data ?? []}
            getRowKey={(a) => a.accCode}
            isLoading={accountsQuery.isLoading}
            emptyMessage="در این ردیف هیچ معینی مانده نداشت."
          />
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
            {(accountsQuery.data ?? []).map((a) => (
              <Chip key={a.accCode} size="small" label={`اسناد ${a.accCode}`} onClick={() => go({ kind: 'units', acc: a })} />
            ))}
          </Stack>
        </>
      )}

      {level.kind === 'units' && (
        <>
          {unitsQuery.isError && <ErrorBanner error={unitsQuery.error} />}
          <DataTable
            columns={unitColumns}
            rows={unitsQuery.data ?? []}
            getRowKey={(u) => u.vahedCode}
            isLoading={unitsQuery.isLoading}
            emptyMessage="سهمی ثبت نشده است."
          />
          {level.acc ? (
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
              <Chip size="small" color="primary" label="اسناد همهٔ واحدها" onClick={() => go({ kind: 'vouchers', acc: level.acc! })} />
              {(unitsQuery.data ?? []).map((u) => (
                <Chip
                  key={u.vahedCode}
                  size="small"
                  label={`اسناد ${u.vahedName ?? u.vahedCode}`}
                  onClick={() => go({ kind: 'vouchers', acc: level.acc!, unit: u })}
                />
              ))}
            </Stack>
          ) : (
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              برای دیدن اسناد، اول از «معین‌ها» یک معین را انتخاب کنید.
            </Typography>
          )}
        </>
      )}

      {level.kind === 'vouchers' && (
        <>
          <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="body2">
              معین <MonoCode value={level.acc.accCode} /> {level.acc.accName}
            </Typography>
            {hasPrior && (
              <ToggleButtonGroup
                size="small"
                exclusive
                value={column}
                onChange={(_, v: 'CUR' | 'PRV' | null) => {
                  if (v) {
                    setColumn(v);
                    setPage(1);
                  }
                }}
              >
                <ToggleButton value="CUR">جاری</ToggleButton>
                <ToggleButton value="PRV">سال قبل</ToggleButton>
              </ToggleButtonGroup>
            )}
          </Stack>
          {vouchersQuery.isError && <ErrorBanner error={vouchersQuery.error} />}
          <DataTable
            pageable={false}
            columns={voucherColumns}
            rows={vouchersQuery.data?.items ?? []}
            getRowKey={(v) => `${v.voucherHeadId}-${v.docNum}-${v.debtor}-${v.creditor}-${v.lineDesc}`}
            isLoading={vouchersQuery.isLoading}
            skeletonRows={10}
            emptyMessage="سندی پیدا نشد."
          />
          {vouchersQuery.data && (
            <>
              <Pagination
                pageNumber={vouchersQuery.data.pageNumber}
                pageSize={pageSize}
                totalCount={vouchersQuery.data.totalCount}
                onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
              <Stack direction="row" spacing={2} sx={{ mt: 1, justifyContent: 'flex-end' }}>
                <Typography variant="body2">جمع بدهکار: {fmtRial(vouchersQuery.data.sumDebtor)}</Typography>
                <Typography variant="body2">جمع بستانکار: {fmtRial(vouchersQuery.data.sumCreditor)}</Typography>
              </Stack>
              {(() => {
                const live = vouchersQuery.data.sumDebtor - vouchersQuery.data.sumCreditor;
                const snap = column === 'CUR' ? level.acc.amountCur : level.acc.amountPrv;
                // فقط برای مانده/گردش خالص معنا دارد؛ «گردش بدهکار/بستانکار» تنها یک طرف را می‌شمارد.
                const comparable = row.valueType === 1 || row.valueType === 2 || row.valueType === 3;
                return comparable && !level.unit && snap !== null && Math.round(live) !== Math.round(snap) ? (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    جمع اسناد امروز ({fmtRial(live)} ریال، بدهکار − بستانکار) با مبلغ همین معین در صورت ({fmtRial(snap)} ریال) فرق دارد؛
                    احتمالاً اسناد پس از تهیهٔ صورت تغییر کرده‌اند. برای عدد تازه، صورت را دوباره تهیه کنید.
                  </Alert>
                ) : null;
              })()}
            </>
          )}
        </>
      )}
    </Drawer>
  );
}
