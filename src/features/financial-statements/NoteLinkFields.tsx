import { Controller, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { FormSectionLabel } from '../../components/FormSectionLabel';
import type { FsTemplateDto } from '../../types/fsTemplate';
import type { NewTemplateFormValues } from './schema';

interface Props {
  control: Control<NewTemplateFormValues>;
  register: UseFormRegister<NewTemplateFormValues>;
  errors: FieldErrors<NewTemplateFormValues>;
  statementTemplates: FsTemplateDto[];
}

/**
 * ارتباط یادداشت با ردیف صورت (بخش ۴۵-ج): صورت والد، کد ردیف آن، و ردیف جمع یادداشت برای کنترل
 * «جمع یادداشت = ردیف صورت». شمارهٔ یادداشت در هر اجرا خودکار داده می‌شود.
 */
export function NoteLinkFields({ control, register, errors, statementTemplates }: Props) {
  return (
    <>
      <Grid size={12}>
        <FormSectionLabel label="ارتباط با صورت" caption="شمارهٔ یادداشت هنگام تهیهٔ صورت‌ها به ترتیب ارائه خودکار داده می‌شود." />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <Controller
          control={control}
          name="noteParentTemplateCode"
          render={({ field }) => (
            <TextField select fullWidth label="صورت والد" value={field.value} onChange={field.onChange}>
              <MenuItem value="">— بدون ارتباط (در انتها شماره می‌گیرد) —</MenuItem>
              {statementTemplates.map((t) => (
                <MenuItem key={t.id} value={t.code}>
                  {t.titleFa} ({t.code})
                </MenuItem>
              ))}
            </TextField>
          )}
        />
      </Grid>
      <Grid size={{ xs: 6, sm: 3 }}>
        <TextField
          {...register('noteParentRowCode')}
          label="کد ردیف صورت"
          placeholder="A01"
          fullWidth
          slotProps={{ htmlInput: { dir: 'ltr', maxLength: 20 } }}
          error={!!errors.noteParentRowCode}
          helperText={errors.noteParentRowCode?.message}
        />
      </Grid>
      <Grid size={{ xs: 6, sm: 3 }}>
        <TextField
          {...register('noteTotalRowCode')}
          label="ردیف جمع یادداشت"
          placeholder="خالی = آخرین ردیف"
          fullWidth
          slotProps={{ htmlInput: { dir: 'ltr', maxLength: 20 } }}
          error={!!errors.noteTotalRowCode}
          helperText={errors.noteTotalRowCode?.message}
        />
      </Grid>
    </>
  );
}
