/**
 * Field positions on a printed cheque. Defaults are the reference `Template.html` (170×85 mm sheet,
 * scaled to the cheque type's own size at print time). A cheque type can override any field through
 * its `TB_CHECK_TYPE.CHEQUE_<KEY>_LEFT/TOP/WIDTH/FONT` columns — millimetres, font = size in pt —
 * edited in «تنظیمات محیطی چک» → «جای فیلدها». An overridden value is used as-is (not scaled).
 */

export const BASE_W = 170;
export const BASE_H = 85;

export type ChequeFieldKey = 'NDATE' | 'ADATE' | 'AAMOUNT' | 'NAMOUNT' | 'DESCRIBE1' | 'DESCRIBE2';

export interface ChequeFieldBox {
  left: number;
  top: number;
  width: number;
  /** pt */
  fontSize: number;
}

/** DTO field name prefix on `ChequeTypeDto` (e.g. `chequeNdateLeft`). */
export const CHEQUE_FIELDS: { key: ChequeFieldKey; label: string; dto: string; defaults: ChequeFieldBox }[] = [
  { key: 'NDATE', label: 'تاریخ عددی', dto: 'chequeNdate', defaults: { left: 110, top: 10.5, width: 33, fontSize: 12 } },
  { key: 'ADATE', label: 'تاریخ به حروف', dto: 'chequeAdate', defaults: { left: 39.5, top: 17.7, width: 97, fontSize: 10 } },
  { key: 'AAMOUNT', label: 'مبلغ به حروف', dto: 'chequeAamount', defaults: { left: 16.2, top: 28.4, width: 111, fontSize: 10 } },
  { key: 'DESCRIBE1', label: 'در وجه', dto: 'chequeDescribe1', defaults: { left: 89.7, top: 38.3, width: 63.6, fontSize: 10 } },
  { key: 'NAMOUNT', label: 'مبلغ عددی', dto: 'chequeNamount', defaults: { left: 5, top: 56.3, width: 71.5, fontSize: 10 } },
  { key: 'DESCRIBE2', label: 'بابت', dto: 'chequeDescribe2', defaults: { left: 98, top: 60, width: 62, fontSize: 9 } },
];

export interface ChequeFieldLayout {
  key: string;
  left: number | null;
  top: number | null;
  width: number | null;
  font: string | null;
}

/** Parses the stored font value ("12", "12pt") into a pt size; anything else ⇒ null. */
export function parseFontSize(font: string | null | undefined): number | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(pt)?\s*$/i.exec(font ?? '');
  return m ? Number(m[1]) : null;
}

/**
 * Final box (mm) for one field on a sheet of `w`×`h` mm: stored override where present, otherwise the
 * reference default scaled to the sheet size.
 */
export function resolveField(
  key: ChequeFieldKey,
  overrides: ChequeFieldLayout[] | null | undefined,
  w: number,
  h: number,
): ChequeFieldBox {
  const def = CHEQUE_FIELDS.find((f) => f.key === key)!.defaults;
  const o = overrides?.find((f) => f.key === key);
  const sx = w / BASE_W;
  const sy = h / BASE_H;
  return {
    left: o?.left ?? def.left * sx,
    top: o?.top ?? def.top * sy,
    width: o?.width ?? def.width * sx,
    fontSize: parseFontSize(o?.font) ?? def.fontSize,
  };
}
