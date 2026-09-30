import { useMutation } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from "react-hook-form";
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { FormDialog } from '../../components/FormDialog';
import { ErrorBanner } from '../../components/ErrorBanner';
import { toLatinDigits } from '../../lib/format/numbers';
import {
  FS_FRAMEWORK_OPTIONS,
  FS_STATEMENT_TYPE_NOTE,
  FS_STATEMENT_TYPE_OPTIONS,
  type FsFrameworkValue,
  type FsTemplateDto,
} from "../../types/fsTemplate";
import { NoteLinkFields } from "./NoteLinkFields";
import { fsTemplatesApi } from './api';
import { newTemplateSchema, type NewTemplateFormValues } from './schema';

interface Props {
  defaultFramework: FsFrameworkValue;
  /** قالب‌های غیریادداشت همین مجموعه — برای انتخاب صورت والدِ یادداشت. */
  statementTemplates: FsTemplateDto[];
  onClose: () => void;
  onCreated: (versionId: string) => void;
}

/** قالب صورت جدید — سرور هم‌زمان نسخهٔ پیش‌نویس ۱ (خالی) می‌سازد و به ویرایش آن می‌رویم. */
export function NewFsTemplateDialog({ defaultFramework, statementTemplates, onClose, onCreated }: Props) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewTemplateFormValues>({
    resolver: zodResolver(newTemplateSchema),
    defaultValues: { framework: defaultFramework, code: '', titleFa: '', titleEn: '', statementType: 1, orderNo: 100, shared: false, noteParentTemplateCode: "", noteParentRowCode: "", noteTotalRowCode: "" },
  });

  const statementType = useWatch({ control, name: "statementType" });
  const framework = useWatch({ control, name: "framework" });

  const mutation = useMutation({
    mutationFn: (v: NewTemplateFormValues) =>
      fsTemplatesApi.create({
        framework: v.framework as FsFrameworkValue,
        code: v.code.trim(),
        titleFa: v.titleFa.trim(),
        titleEn: v.titleEn.trim() || null,
        statementType: v.statementType,
        orderNo: v.orderNo,
        shared: v.shared,
        noteParentTemplateCode: v.noteParentTemplateCode || null,
        noteParentRowCode: v.noteParentRowCode.trim() || null,
        noteTotalRowCode: v.noteTotalRowCode.trim() || null,
      }),
    onSuccess: (res) => onCreated(res.versionId),
  });

  return (
    <FormDialog
      open
      onClose={onClose}
      icon={<NoteAddOutlinedIcon />}
      title="قالب صورت جدید"
      subtitle="کد قالب بعداً قابل تغییر نیست."
      maxWidth="sm"
      onSubmit={handleSubmit((v) => mutation.mutate(v))}
      actions={
        <>
          <Button variant="text" onClick={onClose} disabled={mutation.isPending}>
            انصراف
          </Button>
          <Button type="submit" variant="contained" startIcon={<SaveOutlinedIcon />} disabled={mutation.isPending}>
            {mutation.isPending ? 'در حال ذخیره...' : 'ساخت'}
          </Button>
        </>
      }
    >
      {mutation.isError && <ErrorBanner error={mutation.error} />}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Controller
            control={control}
            name="framework"
            render={({ field }) => (
              <TextField select fullWidth label="مجموعه" value={field.value} onChange={(e) => field.onChange(Number(e.target.value))}>
                {FS_FRAMEWORK_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Controller
            control={control}
            name="statementType"
            render={({ field }) => (
              <TextField select fullWidth label="نوع صورت" value={field.value} onChange={(e) => field.onChange(Number(e.target.value))}>
                {FS_STATEMENT_TYPE_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 8 }}>
          <TextField
            {...register('code')}
            label="کد قالب"
            placeholder="PENSION.NET_ASSETS"
            fullWidth
            required
            slotProps={{ htmlInput: { dir: 'ltr', maxLength: 50 } }}
            error={!!errors.code}
            helperText={errors.code?.message}
          />
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
          <TextField {...register('titleFa')} label="عنوان فارسی" fullWidth required error={!!errors.titleFa} helperText={errors.titleFa?.message} />
        </Grid>
        <Grid size={12}>
          <TextField {...register('titleEn')} label="عنوان انگلیسی" fullWidth slotProps={{ htmlInput: { dir: 'ltr' } }} />
        </Grid>
        {statementType === FS_STATEMENT_TYPE_NOTE && (
          <NoteLinkFields
            control={control}
            register={register}
            errors={errors}
            statementTemplates={statementTemplates.filter((t) => t.framework === framework)}
          />
        )}
        <Grid size={12}>
          <Controller
            control={control}
            name="shared"
            render={({ field }) => (
              <FormControlLabel
                control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                label="قالب مشترک همهٔ واحدها (فقط ستاد مرکزی)"
              />
            )}
          />
          <Typography variant="caption" color="text.secondary" component="p">
            بدون این گزینه، قالب اختصاصی واحد جاری است و برای این واحد و زیرمجموعه‌هایش بر قالب مشترکِ هم‌کد مقدم می‌شود.
          </Typography>
        </Grid>
      </Grid>
    </FormDialog>
  );
}
