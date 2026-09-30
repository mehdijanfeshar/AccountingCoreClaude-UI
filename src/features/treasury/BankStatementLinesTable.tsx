import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import LinkOffOutlinedIcon from '@mui/icons-material/LinkOffOutlined';
import AddLinkOutlinedIcon from '@mui/icons-material/AddLinkOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { MonoCode } from '../../components/MonoCode';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { formatThousands } from '../../lib/format/numbers';
import {
  BANK_STATEMENT_LINE_RESOLUTION_TYPE,
  getBankStatementLineMatchStateColor,
  getBankStatementLineMatchStateLabel,
  isBankStatementLineMatched,
  isBankStatementLineResolved,
  isBankStatementLineUnmatched,
} from './bankStatementState';
import type { BankStatementLineDto } from '../../types/treasury';

function renderMatchInfo(row: BankStatementLineDto) {
  if (isBankStatementLineMatched(row.matchState)) {
    return (
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          سند:
        </Typography>
        <MonoCode value={row.matchedVoucherNumber} />
      </Stack>
    );
  }
  if (isBankStatementLineResolved(row.matchState)) {
    if (row.resolutionType === BANK_STATEMENT_LINE_RESOLUTION_TYPE.bankFeeVoucher) {
      return (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            سند کارمزد:
          </Typography>
          <MonoCode value={row.resolutionVoucherNumber} />
        </Stack>
      );
    }
    if (row.resolutionType === BANK_STATEMENT_LINE_RESOLUTION_TYPE.linkedReceipt) {
      return (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            دریافت:
          </Typography>
          <MonoCode value={row.resolutionReceiptCode} />
        </Stack>
      );
    }
    return (
      <Typography variant="caption" color="text.secondary">
        یادداشت: {row.resolutionNote || '—'}
      </Typography>
    );
  }
  return '—';
}

export interface BankStatementLinesTableActions {
  onManualMatch: (line: BankStatementLineDto) => void;
  onBankFeeVoucher: (line: BankStatementLineDto) => void;
  onLinkReceipt: (line: BankStatementLineDto) => void;
  onIgnore: (line: BankStatementLineDto) => void;
  onUnmatch: (line: BankStatementLineDto) => void;
  onUnresolve: (line: BankStatementLineDto) => void;
  onEdit: (line: BankStatementLineDto) => void;
  onDelete: (line: BankStatementLineDto) => void;
}

interface BankStatementLinesTableProps extends BankStatementLinesTableActions {
  rows: BankStatementLineDto[];
  isLoading: boolean;
  /** فقط در وضعیت باز — ویرایش/حذف ردیف مجاز است. */
  statementOpen: boolean;
}

/** جدول ردیف‌های صورت‌حساب + اقدام هر ردیف بسته به `matchState` — خزانه‌داری بخش ۴-د. */
export function BankStatementLinesTable({
  rows,
  isLoading,
  statementOpen,
  onManualMatch,
  onBankFeeVoucher,
  onLinkReceipt,
  onIgnore,
  onUnmatch,
  onUnresolve,
  onEdit,
  onDelete,
}: BankStatementLinesTableProps) {
  const columns: DataTableColumn<BankStatementLineDto>[] = [
    { key: 'lineDate', header: 'تاریخ', render: (row) => formatLegacyJalaliDate(row.lineDate) },
    { key: 'bankReference', header: 'مرجع بانک', render: (row) => row.bankReference ?? '—' },
    { key: 'description', header: 'شرح', render: (row) => row.description ?? '—' },
    { key: 'withdrawal', header: 'برداشت (ریال)', align: 'end', render: (row) => (row.withdrawal ? formatThousands(row.withdrawal) : '—') },
    { key: 'deposit', header: 'واریز (ریال)', align: 'end', render: (row) => (row.deposit ? formatThousands(row.deposit) : '—') },
    {
      key: 'matchState',
      header: 'وضعیت تطبیق',
      render: (row) => (
        <Chip size="small" color={getBankStatementLineMatchStateColor(row.matchState)} label={getBankStatementLineMatchStateLabel(row.matchState)} />
      ),
    },
    { key: 'matchInfo', header: 'اطلاعات تطبیق/رفع', render: renderMatchInfo },
    {
      key: 'actions',
      header: 'اقدام',
      render: (row) => (
        <Stack direction="row" spacing={0.25} sx={{ flexWrap: 'wrap' }}>
          {isBankStatementLineUnmatched(row.matchState) && (
            <>
              <Tooltip title="تطبیق دستی">
                <IconButton size="small" aria-label="تطبیق دستی" onClick={() => onManualMatch(row)}>
                  <LinkOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {row.withdrawal > 0 && (
                <Tooltip title="ایجاد سند کارمزد">
                  <IconButton size="small" aria-label="ایجاد سند کارمزد" onClick={() => onBankFeeVoucher(row)}>
                    <ReceiptLongOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {row.deposit > 0 && (
                <Tooltip title="اتصال به دریافت">
                  <IconButton size="small" aria-label="اتصال به دریافت" onClick={() => onLinkReceipt(row)}>
                    <AddLinkOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="نادیده گرفتن">
                <IconButton size="small" color="warning" aria-label="نادیده گرفتن" onClick={() => onIgnore(row)}>
                  <BlockOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
          {isBankStatementLineMatched(row.matchState) && (
            <Tooltip title="لغو تطبیق">
              <IconButton size="small" color="warning" aria-label="لغو تطبیق" onClick={() => onUnmatch(row)}>
                <LinkOffOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {isBankStatementLineResolved(row.matchState) && (
            <Tooltip title="برگرداندن">
              <IconButton size="small" color="warning" aria-label="برگرداندن" onClick={() => onUnresolve(row)}>
                <UndoOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {statementOpen && (
            <>
              <Tooltip title="ویرایش">
                <IconButton size="small" aria-label="ویرایش" onClick={() => onEdit(row)}>
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="حذف">
                <IconButton size="small" color="error" aria-label="حذف" onClick={() => onDelete(row)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Stack>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.id}
      isLoading={isLoading}
      emptyMessage="هنوز ردیفی در این صورت‌حساب نیست."
    />
  );
}
