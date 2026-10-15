import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import DeleteSweepOutlinedIcon from '@mui/icons-material/DeleteSweepOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import NetworkCheckOutlinedIcon from '@mui/icons-material/NetworkCheckOutlined';
import TravelExploreOutlinedIcon from '@mui/icons-material/TravelExploreOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import { legacyImportApi, type LegacyConnectionsInput, type LegacySourceDto } from './api';
import { XmlServerPicker, type XmlServer } from './XmlServerPicker';

/** اتصال یک واحد: آدرس سرور + رمز؛ نام کاربر هر سال = ACC + کد واحد (از ورود) + دو رقم آخر سال، مثلاً ACC951600. */
interface Connection {
  dataSource: string;
  title: string;
  schemaBase: string;
  password: string;
  /** رمز قبلاً ذخیره شده است (به مرورگر برنمی‌گردد). */
  hasPassword: boolean;
  /** رمز خوانده‌شده از فایل XML، رمزگذاری‌شده با کلید سرور. */
  credentialToken: string | null;
}

const fa = (v: number | string) => toPersianDigits(String(v));
const schemaOf = (base: string, year: number) => `${base.trim().toUpperCase()}${String(year % 100).padStart(2, '0')}`;
const validYear = (y: string) => /^1[34]\d\d$/.test(y);

/**
 * اتصال به سیستم قدیم برای واحد جاری. دو روش جدا که هر دو همان سه فیلد را پر می‌کنند: ورود دستی، یا خواندن از فایل
 * XML سرورها (رمز روی سرور رمزگشایی می‌شود و به مرورگر نمی‌آید). سپس سال‌ها: «یافتن خودکار» یا افزودن دستی.
 * «بررسی اتصال» در هر دو روش یکسان است و «ذخیره» فقط پس از بررسی بدون خطا فعال می‌شود.
 */
export function ConnectionsEditor({ unit }: { unit: string }) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const saved = useQuery({ queryKey: ['legacy-import', 'connections', unit], queryFn: legacyImportApi.connections });
  const [cn, setCn] = useState<Connection>({
    dataSource: '',
    title: '',
    schemaBase: `ACC${unit}`,
    password: '',
    hasPassword: false,
    credentialToken: null,
  });
  const [years, setYears] = useState<number[]>([]);
  const [newYear, setNewYear] = useState('');
  const [pickerKey, setPickerKey] = useState(0);
  const [mode, setMode] = useState<'manual' | 'xml'>('manual');
  const [dirty, setDirty] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [results, setResults] = useState<LegacySourceDto[] | null>(null);
  const [checkedFor, setCheckedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!saved.data || dirty) return;
    const s = saved.data.server;
    setCn({
      dataSource: s?.dataSource ?? '',
      title: s?.title ?? '',
      schemaBase: `ACC${unit}`,
      password: '',
      hasPassword: s?.hasPassword ?? false,
      credentialToken: null,
    });
    setYears(saved.data.years.map((y) => y.year).sort());
  }, [saved.data, dirty, unit]);

  const server = (c: Connection): LegacyConnectionsInput['server'] => ({
    dataSource: c.dataSource.trim(),
    title: c.title.trim() || null,
    userName: null,
    password: c.password || null,
    credentialToken: c.credentialToken,
    schemaBase: c.schemaBase.trim() || null,
  });
  const input: LegacyConnectionsInput = useMemo(
    () => ({
      server: server(cn),
      years: years.map((y) => ({ year: y, schema: schemaOf(cn.schemaBase, y), userName: null, password: null })),
    }),
    [cn, years],
  );
  const signature = JSON.stringify(input);

  const touch = () => {
    setDirty(true);
    setResults(null);
  };
  const patch = (p: Partial<Connection>) => {
    touch();
    setCn((c) => ({ ...c, ...p }));
  };

  const discover = useMutation({
    mutationFn: (srv: LegacyConnectionsInput['server']) => legacyImportApi.saveConnections({ server: srv, years: [] }, true),
    onSuccess: (res, srv) => {
      const found = res.results.filter((r) => r.connected && r.year > 0);
      if (found.length === 0) {
        setNote({ ok: false, text: `یافتن سال‌ها: ${res.results[0]?.error ?? 'سالی پیدا نشد.'}` });
        return;
      }
      touch();
      setYears(found.map((r) => r.year));
      setResults(found);
      // همهٔ سال‌های یافت‌شده همین حالا آزموده و وصل شده‌اند ⇒ «ذخیره» بی‌درنگ فعال
      const checked = found.map((r) => ({ year: r.year, schema: schemaOf(srv.schemaBase ?? '', r.year), userName: null, password: null }));
      setCheckedFor(JSON.stringify({ server: srv, years: checked }));
      setNote({ ok: true, text: `${fa(found.length)} سال مالی روی سرور پیدا و وصل شد؛ برای نگه‌داشتن «ذخیره» را بزنید.` });
    },
  });

  const readXml = useMutation({
    mutationFn: (s: XmlServer) =>
      legacyImportApi.readXmlServer({
        title: s.title,
        dataSource: s.dataSource,
        encryptedUserName: s.encryptedUserName,
        encryptedPassword: s.encryptedPassword,
      }),
    onSuccess: (res, s) => {
      touch();
      setYears([]); // سرور تازه ⇒ سال‌های سرور قبلی معتبر نیست
      setCheckedFor(null);
      const next: Connection = {
        dataSource: s.dataSource,
        title: s.title,
        schemaBase: `ACC${unit}`,
        password: '',
        hasPassword: false,
        credentialToken: res.decrypted ? res.credentialToken : null,
      };
      setCn(next);
      if (res.decrypted) {
        setNote({ ok: true, text: `سرور «${s.title}» خوانده شد (آدرس سرور و رمز از فایل). در حال یافتن سال‌ها…` });
        discover.mutate(server(next));
      } else {
        setNote({ ok: false, text: res.message ?? 'رمز از فایل خوانده نشد؛ آن را وارد کنید.' });
      }
    },
  });

  const run = useMutation({
    mutationFn: (check: boolean) => legacyImportApi.saveConnections(input, check),
    onSuccess: (res, check) => {
      setResults(res.results);
      const allOk = res.results.length > 0 && res.results.every((r) => r.connected);
      setCheckedFor(allOk ? signature : null);
      if (!check && res.saved) {
        setDirty(false);
        notify({ message: 'اتصال‌ها بررسی و ذخیره شد.', severity: 'success' });
        void queryClient.invalidateQueries({ queryKey: ['legacy-import'] });
      } else if (!check) {
        notify({ message: 'اتصال برخی سال‌ها خطا داشت؛ ذخیره نشد.', severity: 'error' });
      }
    },
  });

  /** همه‌چیز خالی برای تعریف اتصال تازه؛ اتصال ذخیره‌شده تا «ذخیره» دست نمی‌خورد. */
  const reset = () => {
    touch();
    setPickerKey((k) => k + 1);
    setCn({ dataSource: '', title: '', schemaBase: `ACC${unit}`, password: '', hasPassword: false, credentialToken: null });
    setYears([]);
    setNewYear('');
    setCheckedFor(null);
    setNote(null);
  };

  const addYear = () => {
    const y = Number(newYear);
    if (!validYear(newYear) || years.includes(y)) return;
    touch();
    setYears((ys) => [...ys, y].sort());
    setNewYear('');
  };

  const fromXml = !!cn.credentialToken;
  const hasPassword = fromXml || !!cn.password || cn.hasPassword;
  const connectionMissing = !cn.dataSource.trim()
    ? mode === 'xml'
      ? 'سرور را از فایل XML انتخاب کنید.'
      : 'آدرس سرور را وارد کنید.'
    : !/^[A-Za-z][A-Za-z0-9_$#]*$/.test(cn.schemaBase.trim())
      ? 'کد واحد معتبر نیست.'
      : !hasPassword
        ? 'رمز را وارد کنید.'
        : null;
  const checkMissing = connectionMissing ?? (years.length === 0 ? 'سال‌ها را با «یافتن خودکار سال‌ها» یا «افزودن» وارد کنید.' : null);
  const busy = run.isPending || discover.isPending || readXml.isPending;
  const canSave = checkedFor === signature && !busy;
  const resultFor = (y: number) => results?.find((r) => r.year === y);
  const savedYears = new Set(saved.data?.years.map((y) => y.year) ?? []);
  const yearDownload = useMutation({ mutationFn: (y: number) => legacyImportApi.downloadUnitWorkbook(y) });

  return (
    <>
      {saved.isError && <ErrorBanner error={saved.error} />}

      {/* ---------- اتصال ---------- */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1.5, alignItems: { sm: 'center' } }}>
        <Typography variant="subtitle2">اتصال به سیستم قدیم این واحد:</Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={mode}
          onChange={(_e, v: 'manual' | 'xml' | null) => {
            if (!v) return;
            setMode(v);
            reset();
          }}
        >
          <ToggleButton value="manual">ورود دستی</ToggleButton>
          <ToggleButton value="xml">خواندن از فایل XML</ToggleButton>
        </ToggleButtonGroup>
        <Tooltip title="خالی‌کردن فیلدها و سال‌ها برای تعریف اتصال تازه؛ اتصال ذخیره‌شده تا «ذخیره» عوض نمی‌شود.">
          <Button size="small" startIcon={<AddOutlinedIcon />} onClick={reset} disabled={busy}>
            اتصال جدید
          </Button>
        </Tooltip>
        {dirty && (
          <Button
            size="small"
            color="inherit"
            disabled={busy}
            onClick={() => {
              setDirty(false); // اتصال ذخیره‌شده دوباره بارگذاری می‌شود
              setResults(null);
              setNote(null);
            }}
          >
            بازگشت به اتصال ذخیره‌شده
          </Button>
        )}
      </Stack>

      {mode === 'xml' && (
        <Paper variant="outlined" sx={{ p: 2, mb: 1.5 }}>
          <XmlServerPicker key={pickerKey} onPick={(s) => readXml.mutate(s)} />
          {readXml.isPending && <Typography variant="caption">در حال خواندن رمز…</Typography>}
          {readXml.isError && <ErrorBanner error={readXml.error} />}
        </Paper>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 1.5 }}>
        <TextField
          size="small"
          label={cn.title && mode === 'xml' ? `آدرس سرور — ${cn.title}` : 'آدرس سرور (TNS یا host:port/service)'}
          placeholder="db3rh:1521/setadidevdb.tamin.org"
          value={cn.dataSource}
          disabled={mode === 'xml'}
          onChange={(e) => patch({ dataSource: e.target.value, title: '' })}
          sx={{ flex: 2 }}
          slotProps={{ htmlInput: { dir: 'ltr' } }}
        />
        <TextField
          size="small"
          label="نام کاربر (خودکار، از کد واحد)"
          value={`${cn.schemaBase} + دو رقم سال`}
          disabled
          sx={{ flex: 1 }}
          slotProps={{ htmlInput: { dir: 'ltr' } }}
        />
        <TextField
          size="small"
          type="password"
          autoComplete="new-password"
          label="رمز"
          placeholder={fromXml ? 'از فایل XML خوانده شد' : cn.hasPassword ? 'ذخیره‌شده' : ''}
          value={cn.password}
          disabled={fromXml}
          onChange={(e) => patch({ password: e.target.value })}
          sx={{ flex: 1 }}
          slotProps={{ htmlInput: { dir: 'ltr' }, inputLabel: { shrink: fromXml || cn.hasPassword || !!cn.password } }}
        />
      </Stack>

      {note && (
        <Alert severity={note.ok ? 'success' : 'warning'} sx={{ mb: 1.5 }} onClose={() => setNote(null)}>
          {note.text}
        </Alert>
      )}

      {/* ---------- سال‌ها ---------- */}
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        سال‌های مالی
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        نام کاربر هر سال = ACC + کد واحد + دو رقم آخر سال (مثلاً سال ۱۴۰۰ ←{' '}
        <span dir="ltr">{schemaOf(cn.schemaBase, 1400)}</span>).
      </Typography>
      <TableContainer sx={{ mb: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 48 }} />
              <TableCell sx={{ width: 110 }}>سال مالی</TableCell>
              <TableCell sx={{ width: 170 }}>نام کاربر</TableCell>
              <TableCell>وضعیت</TableCell>
              <TableCell sx={{ width: 150 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {years.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} sx={{ color: 'text.secondary' }}>
                  سالی وارد نشده — «یافتن خودکار سال‌ها» را بزنید یا سال را دستی اضافه کنید.
                </TableCell>
              </TableRow>
            )}
            {years.map((y) => {
              const res = resultFor(y);
              return (
                <TableRow key={y}>
                  <TableCell sx={{ px: 0.5 }}>
                    <Tooltip title="حذف این سال">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          touch();
                          setYears((ys) => ys.filter((x) => x !== y));
                        }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                  <TableCell>{fa(y)}</TableCell>
                  <TableCell dir="ltr" sx={{ textAlign: 'right' }}>
                    {schemaOf(cn.schemaBase, y)}
                  </TableCell>
                  <TableCell>
                    {res &&
                      (res.connected ? (
                        <Chip size="small" color="success" label={`متصل — ${fa(res.vouchers)} سند`} />
                      ) : (
                        <Tooltip title={res.error ?? ''}>
                          <Chip size="small" color="error" label={res.error ?? 'خطا'} sx={{ maxWidth: 360 }} />
                        </Tooltip>
                      ))}
                  </TableCell>
                  <TableCell>
                    <Tooltip title={savedYears.has(y) && !dirty ? 'کاربرگ کدینگ فقط همین سال (برای مشاهده)' : 'اول اتصال‌ها را ذخیره کنید.'}>
                      <span>
                        <Button
                          size="small"
                          startIcon={<FileDownloadOutlinedIcon />}
                          sx={{ whiteSpace: 'nowrap' }}
                          disabled={!savedYears.has(y) || dirty || yearDownload.isPending}
                          onClick={() => yearDownload.mutate(y)}
                        >
                          {yearDownload.isPending && yearDownload.variables === y ? 'در حال ساخت…' : 'اکسل این سال'}
                        </Button>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
        <TextField
          size="small"
          placeholder="سال"
          value={newYear}
          onChange={(e) => setNewYear(toLatinDigits(e.target.value).replace(/\D/g, '').slice(0, 4))}
          onKeyDown={(e) => e.key === 'Enter' && addYear()}
          sx={{ width: 100 }}
          slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric' } }}
        />
        <Button startIcon={<AddOutlinedIcon />} disabled={!validYear(newYear) || years.includes(Number(newYear))} onClick={addYear}>
          افزودن
        </Button>
        <Button
          color="error"
          startIcon={<DeleteSweepOutlinedIcon />}
          disabled={years.length === 0}
          onClick={() => {
            touch();
            setYears([]);
          }}
        >
          حذف همهٔ سال‌ها
        </Button>
      </Stack>

      {run.isError && <ErrorBanner error={run.error} />}
      {discover.isError && <ErrorBanner error={discover.error} />}
      {yearDownload.isError && <ErrorBanner error={yearDownload.error} />}
      {results && results.some((r) => !r.connected) && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          اتصال برخی سال‌ها خطا دارد؛ تا رفع نشود ذخیره ممکن نیست.
        </Alert>
      )}

      <Stack direction="row" spacing={1.5} sx={{ mt: 2, flexWrap: 'wrap', rowGap: 1 }}>
        <Tooltip title={connectionMissing ?? 'سال‌هایی که این واحد روی سرور دارد پیدا و آزموده می‌شوند.'}>
          <span>
            <Button
              variant="outlined"
              startIcon={<TravelExploreOutlinedIcon />}
              disabled={!!connectionMissing || busy}
              onClick={() => {
                setNote(null);
                discover.mutate(server(cn));
              }}
            >
              {discover.isPending ? 'در حال یافتن سال‌ها…' : 'یافتن خودکار سال‌ها'}
            </Button>
          </span>
        </Tooltip>
        <Tooltip title={checkMissing ?? ''}>
          <span>
            <Button
              variant="outlined"
              startIcon={<NetworkCheckOutlinedIcon />}
              disabled={!!checkMissing || busy}
              onClick={() => run.mutate(true)}
            >
              {run.isPending && run.variables === true ? 'در حال بررسی…' : 'بررسی اتصال'}
            </Button>
          </span>
        </Tooltip>
        <Tooltip title={canSave ? '' : 'اول «بررسی اتصال» را بزنید؛ ذخیره فقط بعد از بررسی بدون خطا.'}>
          <span>
            <Button variant="contained" startIcon={<SaveOutlinedIcon />} disabled={!canSave} onClick={() => run.mutate(false)}>
              {run.isPending && run.variables === false ? 'در حال ذخیره…' : 'ذخیره'}
            </Button>
          </span>
        </Tooltip>
      </Stack>
      {checkMissing && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          برای «بررسی اتصال»: {checkMissing}
        </Typography>
      )}
      {dirty && (
        <Typography variant="caption" color="warning.dark" sx={{ display: 'block', mt: 0.75 }}>
          تغییرات (از جمله حذف) تا «ذخیره» ثبت نمی‌شود.
        </Typography>
      )}
    </>
  );
}
