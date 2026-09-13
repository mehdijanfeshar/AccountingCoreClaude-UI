import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import UpdateOutlinedIcon from '@mui/icons-material/UpdateOutlined';
import { formatPersianDateTime } from '../lib/format/dates';

interface RecordMetaFooterProps {
  createdDate?: string | null;
  updatedDate?: string | null;
  addUserId?: string | null;
  changeUserId?: string | null;
}

/**
 * Small muted audit trail rendered at the bottom of an edit-mode form — when the record was
 * created and last changed. Every base-info Legacy entity carries the same
 * createdDate/updatedDate/addUserId/changeUserId columns, so this is shared verbatim rather than
 * re-built per feature. Renders nothing for a new (not-yet-created) record.
 */
export function RecordMetaFooter({ createdDate, updatedDate, addUserId, changeUserId }: RecordMetaFooterProps) {
  if (!createdDate && !updatedDate) return null;

  return (
    <>
      <Divider sx={{ my: 3 }} />
      <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
        {createdDate && (
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', color: 'text.secondary' }}>
            <HistoryOutlinedIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption">
              ایجاد: {formatPersianDateTime(createdDate)}
              {addUserId ? ` — کاربر ${addUserId}` : ''}
            </Typography>
          </Stack>
        )}
        {updatedDate && (
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', color: 'text.secondary' }}>
            <UpdateOutlinedIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption">
              آخرین ویرایش: {formatPersianDateTime(updatedDate)}
              {changeUserId ? ` — کاربر ${changeUserId}` : ''}
            </Typography>
          </Stack>
        )}
      </Stack>
    </>
  );
}
