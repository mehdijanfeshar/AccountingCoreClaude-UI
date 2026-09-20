import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import { PageHeader } from '../../components/PageHeader';
import { FormCard } from '../../components/FormCard';
import { FormLoadingSkeleton } from '../../components/FormLoadingSkeleton';
import { RecordMetaFooter } from '../../components/RecordMetaFooter';
import { FormSectionLabel } from '../../components/FormSectionLabel';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { useSession } from '../../lib/session/SessionContext';
import { toLatinDigits } from '../../lib/format/numbers';
import { identityGroupsApi, identityHeadsApi, identitySubGroupsApi } from './api';
import type { IdentitySubGroupDto } from '../../types/identity';
import { IDENTITY_SUB_GROUP_KIND_FIXED, getIdentitySubGroupTypeLabel } from '../../types/legacyEnums';

const GROUP_PAGE_SIZE = 200;
const SUB_GROUP_PAGE_SIZE = 200;

/**
 * Handles both `/base/identity-heads/new` and `/base/identity-heads/:id/edit`.
 *
 * <b>The form is built at runtime from the chosen group.</b> Picking a گروه fetches its **ثابت**
 * subgroups and renders one input per subgroup — exactly the reference app's flow
 * (`groupChange()` → `getFixed?Groupid=` → one `FormControl` per returned item). There is no
 * fixed field list, because the field list *is* data.
 *
 * Deliberately plain RHF-free state: the field set changes with the selected group, so a static
 * zod schema would have to be rebuilt on every change anyway. The values are free text server-side
 * (`FIXITEMS_VALUE` is a nullable VARCHAR2(100)), so the only rules to enforce are "required" and
 * the length cap — both handled inline here.
 *
 * ⚠️ On edit the group is locked: changing it would leave every recorded value pointing at
 * subgroups of the old group. The backend refuses to change it either.
 */
export function IdentityHeadFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { financialYear } = useSession();

  const [groupId, setGroupId] = useState('');
  const [year, setYear] = useState(financialYear);
  const [values, setValues] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const existingQuery = useQuery({
    queryKey: ['identity-heads', id],
    queryFn: () => identityHeadsApi.getById(id as string),
    enabled: isEdit,
  });

  const groupsQuery = useQuery({
    queryKey: ['identity-groups', 'all'],
    queryFn: () => identityGroupsApi.list({ pageNumber: 1, pageSize: GROUP_PAGE_SIZE }),
  });
  const groups = groupsQuery.data?.items ?? [];

  // The one call this whole form is built on: the ثابت subgroups of the chosen group.
  const subGroupsQuery = useQuery({
    queryKey: ['identity-sub-groups', groupId, 'fixed'],
    queryFn: () =>
      identitySubGroupsApi.list({
        pageNumber: 1,
        pageSize: SUB_GROUP_PAGE_SIZE,
        identityGroupId: groupId,
        kind: IDENTITY_SUB_GROUP_KIND_FIXED,
      }),
    enabled: Boolean(groupId),
  });
  const fixedSubGroups: IdentitySubGroupDto[] = useMemo(
    () => subGroupsQuery.data?.items ?? [],
    [subGroupsQuery.data],
  );

  // Seed from the existing record on edit.
  useEffect(() => {
    if (!existingQuery.data) return;
    setGroupId(existingQuery.data.identityGroupId);
    setYear(existingQuery.data.year ?? '');
    setValues(
      Object.fromEntries(
        existingQuery.data.fixItems.map((item) => [item.identitySubGroupId, item.value ?? '']),
      ),
    );
  }, [existingQuery.data]);

  // When the subgroup set arrives (or changes with the group), make sure every field has an
  // entry without discarding anything the user — or the existing record — already supplied.
  useEffect(() => {
    if (fixedSubGroups.length === 0) return;
    setValues((previous) => {
      const next = { ...previous };
      for (const subGroup of fixedSubGroups) {
        next[subGroup.id] ??= '';
      }
      return next;
    });
  }, [fixedSubGroups]);

  const createMutation = useMutation({
    mutationFn: () =>
      identityHeadsApi.create({
        identityGroupId: groupId,
        year,
        fixItems: fixedSubGroups.map((subGroup) => ({
          identitySubGroupId: subGroup.id,
          value: values[subGroup.id] || null,
        })),
      }),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      identityHeadsApi.update(id as string, {
        fixItems: fixedSubGroups.map((subGroup) => ({
          identitySubGroupId: subGroup.id,
          value: values[subGroup.id] || null,
        })),
      }),
  });

  const pending = isEdit ? updateMutation.isPending : createMutation.isPending;

  const missingGroup = touched && !groupId;
  const missingYear = touched && !year.trim();
  const emptyFields = fixedSubGroups.filter((subGroup) => !(values[subGroup.id] ?? '').trim());
  const hasEmptyField = touched && emptyFields.length > 0;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    setSubmitError(null);

    if (!groupId || !year.trim() || emptyFields.length > 0) {
      return;
    }

    try {
      if (isEdit) {
        await updateMutation.mutateAsync();
      } else {
        await createMutation.mutateAsync();
      }
      await queryClient.invalidateQueries({ queryKey: ['identity-heads'] });
      notify(isEdit ? 'شناسنامه ویرایش شد.' : 'شناسنامه جدید صادر شد.');
      navigate('/base/identity-heads');
    } catch (error) {
      setSubmitError(error);
    }
  }

  if (isEdit && existingQuery.isLoading) {
    return <FormLoadingSkeleton />;
  }

  if (isEdit && existingQuery.isError) {
    return <ErrorBanner error={existingQuery.error} />;
  }

  return (
    <section>
      <PageHeader
        eyebrow="اطلاعات پایه"
        icon={<BadgeOutlinedIcon />}
        title={isEdit ? 'ویرایش شناسنامه' : 'صدور شناسنامه'}
        description="پس از انتخاب گروه، فیلدهای ثابت آن گروه به‌صورت خودکار ساخته می‌شوند."
      />

      {submitError !== null && <ErrorBanner error={submitError} />}

      <FormCard onSubmit={onSubmit} watermarkIcon={<BadgeOutlinedIcon />}>
        <Grid container spacing={3}>
          <Grid size={12}>
            <FormSectionLabel label="اطلاعات اصلی" />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              select
              fullWidth
              label="گروه شناسنامه"
              value={groupId}
              onChange={(event) => {
                setGroupId(event.target.value);
                // Values are keyed by subgroup id, and a different group has different subgroups,
                // so carrying them over would silently attach old values to new fields.
                setValues({});
              }}
              disabled={isEdit}
              error={missingGroup}
              helperText={
                missingGroup
                  ? 'انتخاب گروه الزامی است'
                  : isEdit
                    ? 'گروه شناسنامه پس از صدور قابل تغییر نیست.'
                    : undefined
              }
            >
              {groups.map((group) => (
                <MenuItem key={group.id} value={group.id}>
                  {group.identityGroupsDesc}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              label="سال مالی"
              value={year}
              onChange={(event) => setYear(toLatinDigits(event.target.value))}
              disabled={isEdit}
              error={missingYear}
              helperText={missingYear ? 'سال مالی الزامی است' : undefined}
              slotProps={{
                htmlInput: { maxLength: 4, inputMode: 'numeric' },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <EventOutlinedIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Grid>

          {isEdit && existingQuery.data && (
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField fullWidth label="سریال" value={existingQuery.data.serial} disabled helperText="سمت سرور تعیین می‌شود." />
            </Grid>
          )}

          <Grid size={12}>
            <FormSectionLabel label="مقادیر ثابت" />
          </Grid>

          {!groupId && (
            <Grid size={12}>
              <Alert severity="info">ابتدا یک گروه شناسنامه انتخاب کنید تا فیلدهای آن ساخته شوند.</Alert>
            </Grid>
          )}

          {groupId && subGroupsQuery.isLoading && (
            <Grid size={12}>
              <Alert severity="info">در حال خواندن زیرگروه‌های ثابت…</Alert>
            </Grid>
          )}

          {groupId && subGroupsQuery.isError && (
            <Grid size={12}>
              <ErrorBanner error={subGroupsQuery.error} />
            </Grid>
          )}

          {groupId && !subGroupsQuery.isLoading && !subGroupsQuery.isError && fixedSubGroups.length === 0 && (
            <Grid size={12}>
              <Alert severity="warning">
                این گروه هیچ زیرگروه ثابتی ندارد؛ شناسنامه بدون مقدار صادر می‌شود. برای افزودن زیرگروه به بخش «تعریف ویژگی» بروید.
              </Alert>
            </Grid>
          )}

          {fixedSubGroups.map((subGroup) => {
            const value = values[subGroup.id] ?? '';
            const isMissing = touched && !value.trim();

            return (
              <Grid size={{ xs: 12, md: 4 }} key={subGroup.id}>
                <TextField
                  fullWidth
                  label={subGroup.subgrpsDesc}
                  value={value}
                  onChange={(event) =>
                    setValues((previous) => ({ ...previous, [subGroup.id]: event.target.value }))
                  }
                  error={isMissing}
                  helperText={
                    isMissing
                      ? 'این مقدار الزامی است'
                      : `${getIdentitySubGroupTypeLabel(subGroup.subgrpsType)} — طول ${subGroup.subgrpsLen}`
                  }
                  // 100 is the physical cap of FIXITEMS_VALUE. The subgroup's own SUBGRPS_LEN is
                  // shown as a hint rather than enforced: Legacy does not enforce it either, and
                  // blocking input on an unenforced rule would be inventing one.
                  slotProps={{ htmlInput: { maxLength: 100 } }}
                />
              </Grid>
            );
          })}

          {hasEmptyField && (
            <Grid size={12}>
              <Alert severity="error">همهٔ مقادیر ثابت باید پر شوند.</Alert>
            </Grid>
          )}

          <Grid size={12}>
            <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'flex-end' }}>
              <Button variant="text" onClick={() => navigate('/base/identity-heads')} disabled={pending}>
                انصراف
              </Button>
              <Button type="submit" variant="contained" startIcon={<SaveOutlinedIcon />} disabled={pending}>
                {pending ? 'در حال ذخیره…' : 'ذخیره'}
              </Button>
            </Stack>
          </Grid>
        </Grid>

        {isEdit && existingQuery.data && (
          <RecordMetaFooter
            createdDate={existingQuery.data.createdDate}
            updatedDate={existingQuery.data.updatedDate}
            addUserId={existingQuery.data.addUserId}
            changeUserId={existingQuery.data.changeUserId}
          />
        )}
      </FormCard>
    </section>
  );
}
