import { useMutation } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { FormDialog } from '../../components/FormDialog';
import { ErrorBanner } from '../../components/ErrorBanner';
import { toLatinDigits } from '../../lib/format/numbers';
import { FS_STATEMENT_TYPE_NOTE, type FsTemplateDto } from '../../types/fsTemplate';
import { fsTemplatesApi } from './api';
import { NoteLinkFields } from './NoteLinkFields';
import { newTemplateSchema, type NewTemplateFormValues } from './schema';

interface Props {
  template: FsTemplateDto;
  statementTemplates: FsTemplateDto[];
  onClose: () => void;
  onSaved: () => void;
}

/**
 * ویرایش مشخصات قالب: عنوان‌ها، ترتیب، و برای یادداشت ارتباط با ردیف صورت. کد، مجموعه، نوع و مالک
 * تغییرناپذیرند (از همان schema فرم «قالب جدید» استفاده می‌شود و آن فیلدها فقط نمایشی‌اند).
 */
export function EditFsTemplateDialog({ template, statementTemplates, onClose, onSaved }: Props) {
  const isNote = template.statementType === FS_STATEMENT_TYPE_NOTE;

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewTemplateFormValues>({
    resolver: zodResolver(newTemplateSchema),
    defaultValues: {
      framework: template.framework,
      code: template.code,
      titleFa: template.titleFa,
      titleEn: template.titleEn ?? '',
      statementType: template.statementType,
      orderNo: template.orderNo,
      shared: template.ownerVahedCode === null,
      noteParentTemplateCode: template.noteParentTemplateCode ?? '',
      noteParentRowCode: template.noteParentRowCode ?? '',
      noteTotalRowCode: template.noteTotalRowCode ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (v: NewTemplateFormValues) =>
      fsTemplatesApi.update(template.id, {
        titleFa: v.titleFa.trim(),
        titleEn: v.titleEn.trim() || null,
        orderNo: v.orderNo,
        noteParentTemplateCode: isNote ? v.noteParentTemplateCode || null : null,
        noteParentRowCode: isNote ? v.noteParentRowCode.trim() || null : null,
        noteTotalRowCode: isNote ? v.noteTotalRowCode.trim() || null : null,
      }),
    onSuccess: () => onSaved(),
  });

  return (
    <FormDialog
      open
      onClose={onClose}
      icon={<EditNoteOutlinedIcon />}
      title={`ویرایش ${isNote ? 'یادداشت' : 'قالب'}`}
      subtitle={template.code}
      maxWidth="sm"
      onSubmit={handleSubmit((v) => mutation.mutate(v))}
      actions={
        <>
          <Button variant="text" onClick={onClose} disabled={mutation.isPending}>
            انصراف
          </Button>
          <Button type="submit" variant="contained" startIcon={<SaveOutlinedIcon />} disabled={mutation.isPending}>
            {mutation.isPending ? 'در حال ذخیره...' : 'ذخیره'}
          </Button>
        </>
      }
    >
      {mutation.isError && <ErrorBanner error={mutation.error} />}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 8 }}>
          <TextField {...register('titleFa')} label="عنوان فارسی" fullWidth required error={!!errors.titleFa} helperText={errors.titleFa?.message} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            {...register('orderNo', { setValueAs: (v) => Number(toLatinDigits(String(v ?? '0'))) || 0 })}
            label="ترتیب"
            fullWidth
            error={!!errors.orderNo}
            helperText={errors.orderNo?.message}
          />
        </Grid>
        <Grid size={12}>
          <TextField {...register('titleEn')} label="عنوان انگلیسی" fullWidth slotProps={{ htmlInput: { dir: 'ltr' } }} />
        </Grid>
        {isNote && (
          <NoteLinkFields
            control={control}
            register={register}
            errors={errors}
            statementTemplates={statementTemplates.filter((t) => t.framework === template.framework)}
          />
        )}
      </Grid>
    </FormDialog>
  );
}
