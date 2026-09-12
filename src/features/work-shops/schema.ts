import { z } from 'zod';
import type { WorkShopWritePayload } from './api';
import type { WorkShopDto } from '../../types/workShop';

/** UX-presentation validation only, mirroring `CreateWorkShopCommandValidator`. */
export const workShopFormSchema = z.object({
  accountCodeId: z.string().min(1, 'انتخاب حساب معین الزامی است'),
  accountCodeLabel: z.string().nullable().optional(),
  branchId: z.string().nullable(),
  branchLabel: z.string().nullable().optional(),
  workShopName: z.string().trim().min(1, 'نام کارگاه الزامی است').max(100, 'حداکثر ۱۰۰ کاراکتر است'),
  workShopCode: z.string().trim().min(1, 'کد کارگاه الزامی است').max(10, 'حداکثر ۱۰ کاراکتر است'),
  isActive: z.boolean(),
});

export type WorkShopFormValues = z.infer<typeof workShopFormSchema>;

export const emptyWorkShopFormValues: WorkShopFormValues = {
  accountCodeId: '',
  accountCodeLabel: null,
  branchId: null,
  branchLabel: null,
  workShopName: '',
  workShopCode: '',
  isActive: true,
};

export function workShopDtoToFormValues(
  dto: WorkShopDto,
  accountCodeLabel: string | null,
  branchLabel: string | null,
): WorkShopFormValues {
  return {
    accountCodeId: dto.accountCodeId,
    accountCodeLabel,
    branchId: dto.branchId,
    branchLabel,
    workShopName: dto.workShopName ?? '',
    workShopCode: dto.workShopCode ?? '',
    isActive: dto.isActive,
  };
}

/** `checkFile` deliberately NOT exposed — no upload UI was specced; always `null`. */
export function workShopFormValuesToPayload(values: WorkShopFormValues): WorkShopWritePayload {
  return {
    accountCodeId: values.accountCodeId,
    branchId: values.branchId,
    workShopName: values.workShopName.trim(),
    workShopCode: values.workShopCode.trim(),
    isActive: values.isActive,
    checkFile: null,
  };
}
