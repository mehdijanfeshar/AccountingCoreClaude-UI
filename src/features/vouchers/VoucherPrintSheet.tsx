import { Fragment } from 'react';
import Box from '@mui/material/Box';
import { PrintPortal } from '../../components/PrintPortal';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { formatThousands, toPersianDigits } from '../../lib/format/numbers';
import { getDocLifeLabel } from './api';

interface LabeledValue {
  title: string;
  value: string | null;
}

export interface PrintLineExtras {
  tafsilis: { levelName: string | null; code: string | null; name: string | null }[];
  attributes: LabeledValue[];
  identities: { groupTitle: string; fixedValues: LabeledValue[]; values: LabeledValue[] }[];
  receipt: { kind: number; no: string; date: string } | null;
  cheque: { no: string; date: string | null; payTo: string | null; isSori: boolean; bookTitle: string | null } | null;
}

interface Props {
  unitLabel: string;
  head: { docNum: string | null; atfNum: string | null; dateDoc: string | null; year: string | null; docLife: number | null; headDesc: string | null };
  lines: { id: string; accountId: string | null; description: string | null; debtor: number | string | null; creditor: number | string | null }[];
  accountLabel: (accountId: string | null | undefined) => string;
  extras: Map<string, PrintLineExtras>;
}

const money = (v: number | string | null | undefined) => toPersianDigits(formatThousands(Number(v ?? 0)));
const joinValues = (items: LabeledValue[]) => items.map((i) => `${i.title}: ${i.value?.trim() || '—'}`).join('، ');

function extrasText(e: PrintLineExtras | undefined): string[] {
  if (!e) return [];
  const out: string[] = [];
  if (e.tafsilis.length > 0) {
    out.push(
      'تفصیلی: ' +
        e.tafsilis.map((t) => `${t.levelName ? `${t.levelName}: ` : ''}${[t.code, t.name].filter(Boolean).join(' - ') || '—'}`).join('، '),
    );
  }
  if (e.attributes.length > 0) out.push(`شناسه: ${joinValues(e.attributes)}`);
  e.identities.forEach((g) => out.push(`ویژگی «${g.groupTitle}»: ${[joinValues(g.fixedValues), joinValues(g.values)].filter(Boolean).join(' | ')}`));
  if (e.receipt) out.push(`${e.receipt.kind === 2 ? 'حواله' : 'فیش'}: شماره ${e.receipt.no} — تاریخ ${formatLegacyJalaliDate(e.receipt.date)}`);
  if (e.cheque) {
    const c = e.cheque;
    out.push(
      `${c.isSori ? 'چک صوری' : 'چک'}: ` +
        [`شماره ${c.no}`, c.date ? `تاریخ ${formatLegacyJalaliDate(c.date)}` : null, c.payTo ? `در وجه ${c.payTo}` : null, c.bookTitle ? `دسته‌چک ${c.bookTitle}` : null]
          .filter(Boolean)
          .join(' — '),
    );
  }
  return out.map((s) => toPersianDigits(s));
}

/**
 * برگهٔ چاپی سند — فقط در چاپ دیده می‌شود و جای صفحهٔ نمایشی را می‌گیرد (که در چاپ پنهان است).
 * جدا از صفحه است چون چیدمان صفحه (Grid با فاصلهٔ منفی، جدول اسکرول‌دار) روی کاغذ از یک طرف بریده می‌شد.
 * جدول تمام‌عرض A4، سرستون در هر صفحه تکرار می‌شود، و پایین برگه جای امضا دارد.
 */
export function VoucherPrintSheet({ unitLabel, head, lines, accountLabel, extras }: Props) {
  const totalDebtor = lines.reduce((s, l) => s + Number(l.debtor ?? 0), 0);
  const totalCreditor = lines.reduce((s, l) => s + Number(l.creditor ?? 0), 0);

  return (
    <PrintPortal>
      <Box
        className="voucher-print-sheet"
        dir="rtl"
        sx={{
          width: '100%',
          color: '#000',
          fontSize: 11,
          '& table': { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' },
          '& th, & td': { border: '1px solid #555', px: 0.75, py: 0.5, textAlign: 'right', verticalAlign: 'top', wordBreak: 'break-word' },
          '& th': { bgcolor: '#eef1f5', fontWeight: 700 },
          '& td.num, & th.num': { textAlign: 'left', whiteSpace: 'nowrap' },
          '& thead': { display: 'table-header-group' },
          '& tr': { breakInside: 'avoid' },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 1 }}>
          <Box sx={{ fontSize: 11 }}>{unitLabel || ''}</Box>
          <Box sx={{ fontSize: 16, fontWeight: 700 }}>سند حسابداری</Box>
          <Box sx={{ fontSize: 11 }}>وضعیت: {getDocLifeLabel(head.docLife)}</Box>
        </Box>

        <table style={{ marginBottom: 8 }}>
          <tbody>
            <tr>
              <th style={{ width: '12%' }}>شماره سند</th>
              <td>{head.docNum ? toPersianDigits(head.docNum) : '—'}</td>
              <th style={{ width: '12%' }}>تاریخ سند</th>
              <td>{formatLegacyJalaliDate(head.dateDoc)}</td>
              <th style={{ width: '12%' }}>شماره عطف</th>
              <td>{head.atfNum?.trim() ? toPersianDigits(head.atfNum.trim()) : '—'}</td>
              <th style={{ width: '10%' }}>سال مالی</th>
              <td>{head.year ? toPersianDigits(head.year) : '—'}</td>
            </tr>
            <tr>
              <th>شرح سند</th>
              <td colSpan={7}>{head.headDesc || '—'}</td>
            </tr>
          </tbody>
        </table>

        <table>
          <thead>
            <tr>
              <th style={{ width: '6%' }}>ردیف</th>
              <th style={{ width: '30%' }}>حساب معین</th>
              <th>شرح</th>
              <th className="num" style={{ width: '15%' }}>بدهکار</th>
              <th className="num" style={{ width: '15%' }}>بستانکار</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const details = extrasText(extras.get(line.id));
              return (
                <Fragment key={line.id}>
                  <tr>
                    <td>{toPersianDigits(index + 1)}</td>
                    <td>{toPersianDigits(accountLabel(line.accountId))}</td>
                    <td>
                      {line.description || '—'}
                      {details.map((d, i) => (
                        <Box key={i} sx={{ fontSize: 10, color: '#333', mt: 0.25 }}>{d}</Box>
                      ))}
                    </td>
                    <td className="num">{money(line.debtor)}</td>
                    <td className="num">{money(line.creditor)}</td>
                  </tr>
                </Fragment>
              );
            })}
            <tr>
              <th colSpan={3}>جمع ({toPersianDigits(lines.length)} ردیف){totalDebtor === totalCreditor ? '' : ' — سند متوازن نیست'}</th>
              <th className="num">{money(totalDebtor)}</th>
              <th className="num">{money(totalCreditor)}</th>
            </tr>
          </tbody>
        </table>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mt: 5, textAlign: 'center', breakInside: 'avoid' }}>
          {['تنظیم‌کننده', 'رسیدگی‌کننده', 'تأییدکننده'].map((title) => (
            <Box key={title}>
              <Box sx={{ fontWeight: 700, mb: 4 }}>{title}</Box>
              <Box sx={{ borderTop: '1px solid #555', pt: 0.5, fontSize: 10 }}>نام و امضا</Box>
            </Box>
          ))}
        </Box>
      </Box>
    </PrintPortal>
  );
}
