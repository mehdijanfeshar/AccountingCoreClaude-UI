import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import { FormDialog } from '../../components/FormDialog';
import { quickVoucherApi } from './api';
import { orderedParameters, type Answer } from './assistantState';
import { defaultFixedKeys } from './QuickVouchersPanel';
import type { TemplateSummaryDto } from './types';

interface Props {
  open: boolean;
  template: TemplateSummaryDto;
  answers: Record<string, Answer>;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * «ذخیره به‌عنوان سند پرتکرار» بعد از ثبت سند الگو: کاربر انتخاب می‌کند کدام جواب‌ها ثابت بمانند (پیش‌فرض همه
 * جز مبلغ و تاریخ). تاریخ هیچ‌وقت ثابت نمی‌شود — سند پرتکرار همیشه به تاریخ روز ثبت می‌شود.
 */
export function SaveQuickVoucherDialog({ open, template, answers, onClose, onSaved }: Props) {
  const queryClient = useQueryClient();
  const params = orderedParameters(template).filter((p) => p.type !== 4 && answers[p.key]);
  const firstDetail = params.find((p) => p.type === 2);
  const [title, setTitle] = useState(
    firstDetail ? `${template.title} — ${answers[firstDetail.key].label}` : template.title,
  );
  const [fixed, setFixed] = useState<Set<string>>(() => new Set(defaultFixedKeys(template, answers)));
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setErrors([]);
    try {
      const values: Record<string, string | null> = {};
      for (const key of fixed) values[key] = answers[key]?.value ?? null;
      const result = await quickVoucherApi.create({ templateId: template.id, title: title.trim(), values });
      if (!result.success) {
        setErrors(result.errors);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['assistant-quick'] });
      onSaved();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'ذخیره انجام نشد.']);
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="ذخیره به‌عنوان سند پرتکرار"
      subtitle="دفعهٔ بعد فقط موارد تیک‌نخورده (معمولاً مبلغ) پرسیده می‌شود و سند به تاریخ همان روز ثبت می‌شود."
      icon={<BoltOutlinedIcon fontSize="small" />}
      maxWidth="sm"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      actions={
        <>
          <Button onClick={onClose} color="inherit">انصراف</Button>
          <Button type="submit" variant="contained" disabled={saving || !title.trim()}>
            {saving ? 'در حال ذخیره…' : 'ذخیره'}
          </Button>
        </>
      }
    >
      <Stack spacing={2}>
        <TextField label="نام سند پرتکرار" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth autoFocus
          slotProps={{ htmlInput: { maxLength: 200 } }} />
        <div>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>کدام موارد ثابت بمانند؟</Typography>
          {params.map((p) => (
            <FormControlLabel
              key={p.key}
              sx={{ display: 'flex' }}
              control={
                <Checkbox
                  checked={fixed.has(p.key)}
                  onChange={(e) => setFixed((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(p.key); else next.delete(p.key);
                    return next;
                  })}
                />
              }
              label={`${p.title}: ${answers[p.key].label}`}
            />
          ))}
        </div>
        {errors.length > 0 && <Alert severity="error">{errors.map((m, i) => <div key={i}>{m}</div>)}</Alert>}
      </Stack>
    </FormDialog>
  );
}
