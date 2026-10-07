import { Fragment, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import RestartAltOutlinedIcon from '@mui/icons-material/RestartAltOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FormLoadingSkeleton } from '../../components/FormLoadingSkeleton';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { useRoles } from '../../lib/roles';
import { apiClient } from '../../lib/api/client';

/**
 * «دسترسی نقش‌ها» (فاز ۵۴، `api/role-access`، DDL 075) — فقط مدیر ستاد. برای هر نقش (نام عین نقش در Keycloak /
 * سامانهٔ ورود) هر منو: بدون دسترسی، مشاهده، یا ثبت و تغییر. سرور «ثبت و تغییر» را روی همان ماژول‌های پشت منو اعمال
 * می‌کند؛ منو هم از همین فیلتر می‌شود. تا جدول خالی است، رفتار ثابت قبلی برقرار است.
 */

interface MenuDto {
  key: string;
  group: string;
  title: string;
  hasWrite: boolean;
}
interface AbilityDto {
  /** کلید ذخیره (`ability:…`) — همان کلید ماتریس. */
  key: string;
  group: string;
  /** منویی که زیرش نمایش داده می‌شود؛ null = زیر سرگروه. */
  menuKey: string | null;
  title: string;
}
interface RoleDto {
  name: string;
  label: string | null;
  builtIn: boolean;
  configured: boolean;
}
interface RoleAccessDto {
  available: boolean;
  configured: boolean;
  roles: RoleDto[];
  menus: MenuDto[];
  abilities: AbilityDto[];
  matrix: Record<string, Record<string, number>>;
}

const api = {
  get: () => apiClient.get<RoleAccessDto>('/role-access').then((r) => r.data),
  save: (role: string, levels: Record<string, number>) => apiClient.post('/role-access/save', { role, levels }).then(() => undefined),
  seed: () => apiClient.post('/role-access/seed-defaults').then(() => undefined),
  remove: (role: string) => apiClient.post('/role-access/remove', { role }).then(() => undefined),
};

const LEVELS = [
  { value: 0, label: 'بدون دسترسی' },
  { value: 1, label: 'مشاهده' },
  { value: 2, label: 'ثبت و تغییر' },
];

export function RoleAccessPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const roleState = useRoles();
  const query = useQuery({ queryKey: ['role-access'], queryFn: api.get, enabled: roleState.isSetad });

  const [role, setRole] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [newRoleOpen, setNewRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [extraRoles, setExtraRoles] = useState<string[]>([]);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmSeed, setConfirmSeed] = useState(false);

  const data = query.data;
  const roles = useMemo<RoleDto[]>(
    () => [
      ...(data?.roles ?? []),
      ...extraRoles
        .filter((n) => !data?.roles.some((r) => r.name === n))
        .map((n) => ({ name: n, label: null, builtIn: false, configured: false })),
    ],
    [data, extraRoles],
  );

  useEffect(() => {
    if (!role && roles.length > 0) setRole(roles[0].name);
  }, [role, roles]);

  useEffect(() => {
    if (!data || !role) return;
    const fromServer = data.matrix[role];
    setDraft(fromServer ? { ...fromServer } : Object.fromEntries(data.menus.map((m) => [m.key, 0])));
  }, [data, role]);

  const groups = useMemo(() => {
    const map = new Map<string, MenuDto[]>();
    for (const m of data?.menus ?? []) map.set(m.group, [...(map.get(m.group) ?? []), m]);
    return [...map.entries()];
  }, [data]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['role-access'] });
    await queryClient.invalidateQueries({ queryKey: ['me'] });
  };

  const save = useMutation({
    mutationFn: () => api.save(role!, draft),
    onSuccess: async () => {
      await refresh();
      notify('دسترسی نقش ذخیره شد.');
    },
  });
  const seed = useMutation({
    mutationFn: api.seed,
    onSuccess: async () => {
      setConfirmSeed(false);
      await refresh();
      notify('دسترسی نقش‌های ثابت با رفتار فعلی پر شد.');
    },
  });
  const remove = useMutation({
    mutationFn: () => api.remove(role!),
    onSuccess: async () => {
      setConfirmRemove(false);
      setExtraRoles((r) => r.filter((n) => n !== role));
      setRole(null);
      await refresh();
      notify('دسترسی‌های نقش برداشته شد.');
    },
  });

  if (!roleState.loaded) return <FormLoadingSkeleton />;
  if (!roleState.isSetad) {
    return <Alert severity="warning">این صفحه فقط برای «مدیر ستاد» است.</Alert>;
  }
  if (query.isLoading) return <FormLoadingSkeleton />;
  if (query.isError || !data) return <ErrorBanner error={query.error} />;

  const current = roles.find((r) => r.name === role) ?? null;
  const setGroup = (menus: MenuDto[], level: number) =>
    setDraft((d) => ({ ...d, ...Object.fromEntries(menus.map((m) => [m.key, m.hasWrite ? level : Math.min(level, 1)])) }));

  return (
    <section>
      <PageHeader
        eyebrow="اطلاعات پایه"
        icon={<AdminPanelSettingsOutlinedIcon />}
        title="دسترسی نقش‌ها"
        description="برای هر نقش تعیین کنید کدام منوها را ببیند و در کدام ثبت و تغییر کند. «مدیر ستاد» همیشه دسترسی کامل دارد."
        actions={
          <Button variant="outlined" startIcon={<AddOutlinedIcon />} onClick={() => setNewRoleOpen(true)} disabled={!data.available}>
            نقش تازه
          </Button>
        }
      />

      {!data.available && (
        <Alert severity="error" sx={{ mb: 2 }}>
          جدول دسترسی نقش‌ها هنوز ساخته نشده است (اسکریپت <code>075_role_menu_access.sql</code>). تا آن موقع رفتار ثابت فعلی برقرار است.
        </Alert>
      )}
      {data.available && !data.configured && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" startIcon={<RestartAltOutlinedIcon />} onClick={() => setConfirmSeed(true)}>
              پر کردن با پیش‌فرض فعلی
            </Button>
          }
        >
          هنوز پیکربندی نشده و رفتار ثابت فعلی برقرار است. اول با «پر کردن با پیش‌فرض فعلی» شروع کنید؛ از آن به بعد منوها و
          اجازهٔ ثبت از همین صفحه پیروی می‌کنند.
        </Alert>
      )}

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mb: 2 }}>
        {roles.map((r) => (
          <Chip
            key={r.name}
            label={r.label ?? r.name}
            color={r.name === role ? 'primary' : 'default'}
            variant={r.name === role ? 'filled' : 'outlined'}
            onClick={() => setRole(r.name)}
          />
        ))}
      </Stack>

      {current && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" sx={{ mb: 1.5, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {current.label ?? current.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ direction: 'ltr', display: 'block' }}>
                {current.name}
              </Typography>
              {!current.configured && data.configured && (
                <Typography variant="caption" color="warning.main">
                  این نقش هنوز ذخیره نشده — {current.builtIn ? 'مقادیر زیر رفتار فعلی‌اند' : 'همه «بدون دسترسی»'}.
                </Typography>
              )}
            </Box>
            <Stack direction="row" spacing={1}>
              {current.configured && (
                <Button color="error" startIcon={<DeleteOutlineIcon />} onClick={() => setConfirmRemove(true)}>
                  برداشتن نقش
                </Button>
              )}
              <Button
                variant="contained"
                startIcon={<SaveOutlinedIcon />}
                disabled={!data.available || save.isPending}
                onClick={() => save.mutate()}
              >
                ذخیره
              </Button>
            </Stack>
          </Stack>
          {save.isError && <ErrorBanner error={save.error} />}

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>منو</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 360 }}>دسترسی</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groups.map(([group, menus]) => (
                <GroupRows
                  key={group}
                  group={group}
                  menus={menus}
                  abilities={data.abilities.filter((a) => a.group === group)}
                  draft={draft}
                  setDraft={setDraft}
                  setGroup={setGroup}
                />
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Dialog open={newRoleOpen} onClose={() => setNewRoleOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>نقش تازه</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            نام نقش را عیناً همان‌طور که در Keycloak (Client Role روی <code>accounting-api</code>) تعریف کرده‌اید بنویسید؛ سپس
            منوهایش را تعیین و ذخیره کنید.
          </Typography>
          <TextField
            fullWidth
            autoFocus
            size="small"
            label="نام نقش"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            slotProps={{ htmlInput: { dir: 'ltr', maxLength: 100 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewRoleOpen(false)}>انصراف</Button>
          <Button
            variant="contained"
            disabled={newRoleName.trim() === ''}
            onClick={() => {
              const name = newRoleName.trim();
              setExtraRoles((r) => (r.includes(name) ? r : [...r, name]));
              setRole(name);
              setNewRoleName('');
              setNewRoleOpen(false);
            }}
          >
            افزودن
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmSeed}
        title="پر کردن با پیش‌فرض فعلی"
        description="دسترسی هفت نقش ثابت با رفتار فعلی سیستم پر می‌شود (اگر قبلاً تغییری داده‌اید بازنویسی می‌شود). از این به بعد منوها و اجازهٔ ثبت از این صفحه پیروی می‌کنند."
        confirmLabel="پر کن"
        confirmColor="primary"
        pending={seed.isPending}
        onCancel={() => setConfirmSeed(false)}
        onConfirm={() => seed.mutate()}
      />
      <ConfirmDialog
        open={confirmRemove}
        title="برداشتن نقش"
        description={`همهٔ دسترسی‌های «${current?.label ?? current?.name ?? ''}» از جدول برداشته شود؟ ${current?.builtIn ? 'نقش ثابت پس از این همه‌جا «بدون دسترسی» می‌شود تا دوباره ذخیره شود.' : ''}`}
        pending={remove.isPending}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => remove.mutate()}
      />
    </section>
  );
}

function AbilityRow({
  ability,
  draft,
  setDraft,
}: {
  ability: AbilityDto;
  draft: Record<string, number>;
  setDraft: (fn: (d: Record<string, number>) => Record<string, number>) => void;
}) {
  return (
    <TableRow>
      <TableCell sx={{ pl: 7 }}>
        <Typography variant="body2" color="text.secondary">
          ↳ قابلیت: {ability.title}
        </Typography>
      </TableCell>
      <TableCell>
        <Stack direction="row" sx={{ alignItems: 'center' }}>
          <Switch
            size="small"
            checked={(draft[ability.key] ?? 0) >= 1}
            onChange={(e) => setDraft((d) => ({ ...d, [ability.key]: e.target.checked ? 1 : 0 }))}
          />
          <Typography variant="body2">{(draft[ability.key] ?? 0) >= 1 ? 'دارد' : 'ندارد'}</Typography>
        </Stack>
      </TableCell>
    </TableRow>
  );
}

function GroupRows({
  group,
  menus,
  abilities,
  draft,
  setDraft,
  setGroup,
}: {
  group: string;
  menus: MenuDto[];
  abilities: AbilityDto[];
  draft: Record<string, number>;
  setDraft: (fn: (d: Record<string, number>) => Record<string, number>) => void;
  setGroup: (menus: MenuDto[], level: number) => void;
}) {
  return (
    <>
      <TableRow sx={{ bgcolor: 'action.hover' }}>
        <TableCell sx={{ fontWeight: 700 }}>{group}</TableCell>
        <TableCell>
          <Stack direction="row" spacing={0.5}>
            {LEVELS.map((l) => (
              <Button key={l.value} size="small" onClick={() => setGroup(menus, l.value)}>
                همه: {l.label}
              </Button>
            ))}
          </Stack>
        </TableCell>
      </TableRow>
      {abilities
        .filter((a) => a.menuKey === null)
        .map((a) => (
          <AbilityRow key={a.key} ability={a} draft={draft} setDraft={setDraft} />
        ))}
      {menus.map((m) => (
        <Fragment key={m.key}>
        <TableRow hover>
          <TableCell sx={{ pl: 4 }}>{m.title}</TableCell>
          <TableCell>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={draft[m.key] ?? 0}
              onChange={(_, v: number | null) => v !== null && setDraft((d) => ({ ...d, [m.key]: v }))}
            >
              {LEVELS.map((l) => (
                <ToggleButton key={l.value} value={l.value} disabled={l.value === 2 && !m.hasWrite} sx={{ px: 1.5 }}>
                  {l.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </TableCell>
        </TableRow>
        {abilities
          .filter((a) => a.menuKey === m.key)
          .map((a) => (
            <AbilityRow key={a.key} ability={a} draft={draft} setDraft={setDraft} />
          ))}
        </Fragment>
      ))}
    </>
  );
}
