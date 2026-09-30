import { z } from 'zod';
import type { FsRowFormat, FsTemplateRowDto, FsTemplateRowInput, FsRowTypeValue } from '../../types/fsTemplate';
import { FS_ROW_TYPE } from '../../types/fsTemplate';

const ROW_CODE = /^[A-Za-z][A-Za-z0-9_]{0,19}$/;
const TEMPLATE_CODE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$/;
const RESERVED = ['SUM', 'ABS', 'ROUND', 'IF', 'PRIOR', 'STMT', 'NOTE'];

export const newTemplateSchema = z.object({
  framework: z.number().int().min(1).max(4),
  code: z
    .string()
    .trim()
    .min(1, 'کد قالب لازم است.')
    .max(50)
    .regex(TEMPLATE_CODE, 'کد لاتین با بخش‌های جداشده با نقطه، مثل PENSION.NET_ASSETS'),
  titleFa: z.string().trim().min(1, 'عنوان فارسی لازم است.').max(200),
  titleEn: z.string().trim().max(200),
  statementType: z.number().int().min(1).max(10),
  orderNo: z.number().int().min(0).max(99999),
  shared: z.boolean(),
  noteParentTemplateCode: z.string(),
  noteParentRowCode: z.string().trim().regex(/^([A-Za-z][A-Za-z0-9_]{0,19})?$/, 'کد ردیف لاتین، مثل A01'),
  noteTotalRowCode: z.string().trim().regex(/^([A-Za-z][A-Za-z0-9_]{0,19})?$/, 'کد ردیف لاتین، مثل C99'),
}).superRefine((v, ctx) => {
  if (v.noteParentTemplateCode && !v.noteParentRowCode.trim()) {
    ctx.addIssue({ code: 'custom', path: ['noteParentRowCode'], message: 'کد ردیف صورت لازم است.' });
  }
});

export type NewTemplateFormValues = z.infer<typeof newTemplateSchema>;

/**
 * فرم ردیف. نحو دقیق انتخاب‌گر/فرمول را فقط سرور بررسی می‌کند (پیام فارسی برمی‌گرداند)؛ اینجا فقط
 * «لازم بودن» فیلدِ هر نوع ردیف.
 */
export const rowFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(ROW_CODE, 'حرف لاتین + تا ۱۹ حرف/رقم/زیرخط (مثل A01).')
      .refine((v) => !RESERVED.includes(v.toUpperCase()), 'نام تابع نمی‌تواند کد ردیف باشد.'),
    rowType: z.number().int().min(1).max(6),
    titleFa: z.string().max(500),
    titleEn: z.string().max(500),
    parentCode: z.string(),
    noteRef: z.string().max(20),
    normalBalance: z.number().int().nullable(),
    selector: z.string().max(1000),
    valueType: z.number().int().nullable(),
    formula: z.string().max(1000),
    indent: z.number().int().min(0).max(5),
    bold: z.boolean(),
    topBorder: z.number().int().min(0).max(2),
    bottomBorder: z.number().int().min(0).max(2),
    hideIfZero: z.boolean(),
    innerColumn: z.boolean(),
    isDrillable: z.boolean(),
    allowManualAdjust: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const needsBalance = v.rowType === FS_ROW_TYPE.Account || v.rowType === FS_ROW_TYPE.Formula || v.rowType === FS_ROW_TYPE.External;
    if (needsBalance && v.normalBalance === null) {
      ctx.addIssue({ code: 'custom', path: ['normalBalance'], message: 'ماهیت لازم است.' });
    }
    if (v.rowType === FS_ROW_TYPE.Account) {
      if (!v.selector.trim()) ctx.addIssue({ code: 'custom', path: ['selector'], message: 'انتخاب‌گر حساب لازم است.' });
      if (v.valueType === null) ctx.addIssue({ code: 'custom', path: ['valueType'], message: 'نوع مقدار لازم است.' });
    }
    if (v.rowType === FS_ROW_TYPE.Formula && !v.formula.trim()) {
      ctx.addIssue({ code: 'custom', path: ['formula'], message: 'فرمول لازم است.' });
    }
    if (v.parentCode && v.parentCode === v.code) {
      ctx.addIssue({ code: 'custom', path: ['parentCode'], message: 'ردیف نمی‌تواند والد خودش باشد.' });
    }
  });

export type RowFormValues = z.infer<typeof rowFormSchema>;

export function buildRowFormValues(row: FsTemplateRowDto | null, suggestedCode = ''): RowFormValues {
  return {
    code: row?.code ?? suggestedCode,
    rowType: row?.rowType ?? FS_ROW_TYPE.Account,
    titleFa: row?.titleFa ?? '',
    titleEn: row?.titleEn ?? '',
    parentCode: row?.parentCode ?? '',
    noteRef: row?.noteRef ?? '',
    normalBalance: row ? row.normalBalance : 1,
    selector: row?.selector ?? '',
    valueType: row ? row.valueType : 1,
    formula: row?.formula ?? '',
    indent: row?.format.indent ?? 1,
    bold: row?.format.bold ?? false,
    topBorder: row?.format.topBorder ?? 0,
    bottomBorder: row?.format.bottomBorder ?? 0,
    hideIfZero: row?.format.hideIfZero ?? false,
    innerColumn: row?.format.innerColumn ?? false,
    isDrillable: row?.isDrillable ?? true,
    allowManualAdjust: row?.allowManualAdjust ?? false,
  };
}

const blankToNull = (s: string) => (s.trim() ? s.trim() : null);

export function toRowInput(v: RowFormValues, orderNo: number | null): FsTemplateRowInput {
  const rowType = v.rowType as FsRowTypeValue;
  const hasValue = rowType === FS_ROW_TYPE.Account || rowType === FS_ROW_TYPE.Formula || rowType === FS_ROW_TYPE.External;
  const format: FsRowFormat = {
    indent: v.indent,
    bold: v.bold,
    italic: false,
    topBorder: v.topBorder,
    bottomBorder: v.bottomBorder,
    hideIfZero: v.hideIfZero,
    pageBreakBefore: false,
    innerColumn: v.innerColumn,
  };
  return {
    code: v.code.trim(),
    rowType,
    titleFa: blankToNull(v.titleFa),
    titleEn: blankToNull(v.titleEn),
    parentCode: blankToNull(v.parentCode),
    noteRef: blankToNull(v.noteRef),
    normalBalance: hasValue ? v.normalBalance : null,
    selector: rowType === FS_ROW_TYPE.Account ? blankToNull(v.selector) : null,
    valueType: rowType === FS_ROW_TYPE.Account ? v.valueType : null,
    formula: rowType === FS_ROW_TYPE.Formula ? blankToNull(v.formula) : null,
    format,
    isDrillable: v.isDrillable,
    allowManualAdjust: v.allowManualAdjust,
    orderNo,
  };
}
