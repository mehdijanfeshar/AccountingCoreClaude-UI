import { useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';

export interface XmlServer {
  title: string;
  /** آدرس به شکل host:port/service (اگر از tns درنیامد، خود tns). */
  dataSource: string;
  host: string;
  service: string;
  /** نام کاربر و رمز رمزگذاری‌شدهٔ فایل؛ فقط سرور می‌تواند رمزگشایی کند. */
  encryptedUserName: string | null;
  encryptedPassword: string | null;
}

const attr = (tns: string, key: string) => new RegExp(`\\(\\s*${key}\\s*=\\s*([^)\\s]+)\\s*\\)`, 'i').exec(tns)?.[1] ?? '';

/**
 * خواندن فایل XML سرورهای سیستم قدیم (`<OracleConnections><Connection tns=… title=… service=… />`) در خود مرورگر —
 * کل فایل به سرور فرستاده نمی‌شود؛ فقط نام کاربر/رمز رمزگذاری‌شدهٔ همان سرورِ انتخاب‌شده برای رمزگشایی روی سرور.
 */
export function parseServersXml(text: string): XmlServer[] {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) throw new Error('فایل XML معتبر نیست.');
  return Array.from(doc.getElementsByTagName('Connection')).map((c) => {
    const tns = c.getAttribute('tns') ?? '';
    const host = attr(tns, 'HOST');
    const port = attr(tns, 'PORT') || '1521';
    const service = attr(tns, 'SERVICE_NAME') || c.getAttribute('service') || '';
    return {
      title: (c.getAttribute('title') ?? '').trim() || host,
      dataSource: host && service ? `${host}:${port}/${service}` : tns.trim(),
      host,
      service,
      encryptedUserName: c.getAttribute('UserName') || null,
      encryptedPassword: c.getAttribute('Password') || null,
    };
  });
}

/** انتخاب یک سرور از فایل XML؛ اگر فایل فقط یک سرور داشته باشد همان انتخاب می‌شود. */
export function XmlServerPicker({ onPick }: { onPick: (server: XmlServer) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [servers, setServers] = useState<XmlServer[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState('');

  const load = async (file: File) => {
    setError(null);
    setFileName(file.name);
    try {
      const list = parseServersXml(await file.text());
      if (list.length === 0) throw new Error('در این فایل هیچ سروری (Connection) نیست.');
      setServers(list);
      setSelected(list.length === 1 ? '0' : '');
    } catch (e) {
      setServers(null);
      setError(e instanceof Error ? e.message : 'خواندن فایل ممکن نشد.');
    }
  };

  return (
    <Box>
      <input
        ref={inputRef}
        type="file"
        accept=".xml,text/xml,application/xml"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void load(f);
          e.target.value = '';
        }}
      />
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Button variant="outlined" startIcon={<UploadFileOutlinedIcon />} onClick={() => inputRef.current?.click()}>
          انتخاب فایل XML سرورها
        </Button>
        <Typography variant="body2" color="text.secondary">
          {fileName || 'فایلی انتخاب نشده'}
        </Typography>
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {error}
        </Alert>
      )}
      {servers && (
        <>
          <Typography variant="body2" sx={{ mt: 2, mb: 0.5 }}>
            {servers.length > 1 ? `این فایل ${servers.length} سرور دارد؛ سرور این واحد را انتخاب کنید:` : 'سرور این فایل:'}
          </Typography>
          <RadioGroup value={selected} onChange={(e) => setSelected(e.target.value)} sx={{ maxHeight: 280, overflow: 'auto', flexWrap: 'nowrap' }}>
            {servers.map((s, i) => (
              <FormControlLabel
                key={i}
                value={String(i)}
                control={<Radio size="small" />}
                label={
                  <span>
                    <b>{s.title}</b>{' '}
                    <Typography component="span" variant="caption" color="text.secondary" dir="ltr">
                      {s.dataSource}
                    </Typography>
                  </span>
                }
              />
            ))}
          </RadioGroup>
          <Button
            variant="contained"
            startIcon={<CheckOutlinedIcon />}
            disabled={selected === ''}
            onClick={() => onPick(servers[Number(selected)])}
            sx={{ mt: 1.5 }}
          >
            استفاده از این سرور
          </Button>
        </>
      )}
    </Box>
  );
}
