import { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import { identityComplete, type IdentityRequirement } from './lineExtras';
import { IdentityFieldsBlock, type IdentityValue } from './IdentityFieldsBlock';

interface Props {
  open: boolean;
  groups: IdentityRequirement[];
  year: string;
  value: Record<string, IdentityValue>;
  onSave: (value: Record<string, IdentityValue>) => void;
  onClose: () => void;
}

const EMPTY: IdentityValue = { headId: '', values: {} };

/**
 * پنجرهٔ «اطلاعات ویژگی» ردیف سند — همان رفتار برنامهٔ مرجع (add-voucher/identity): با ورود
 * تفصیلی/معینِ ویژگی‌دار خودکار باز می‌شود؛ «ثبت» فقط وقتی همهٔ ویژگی‌ها کامل و درست باشند مقادیر را
 * روی ردیف می‌گذارد، «انصراف» چیزی را تغییر نمی‌دهد (ردیف ناقص می‌ماند و هنگام ذخیرهٔ سند گزارش می‌شود).
 */
export function VoucherIdentityDialog({ open, groups, year, value, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<Record<string, IdentityValue>>(value);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(value);
      setTried(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function patch(groupId: string, p: Partial<IdentityValue>) {
    setDraft((prev) => ({ ...prev, [groupId]: { ...(prev[groupId] ?? EMPTY), ...p } }));
  }

  function save() {
    setTried(true);
    if (!groups.every((g) => identityComplete(g, draft[g.groupId]))) return;
    onSave(draft);
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>اطلاعات ویژگی</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} divider={<Divider flexItem />}>
          {groups.map((g) => (
            <IdentityFieldsBlock
              key={g.groupId}
              group={g}
              year={year}
              value={draft[g.groupId] ?? EMPTY}
              showRequired={tried}
              onChange={(p) => patch(g.groupId, p)}
            />
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>انصراف</Button>
        <Button variant="contained" onClick={save}>ثبت</Button>
      </DialogActions>
    </Dialog>
  );
}
