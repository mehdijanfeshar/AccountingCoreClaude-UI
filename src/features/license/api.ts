import { apiClient } from '../../lib/api/client';

export type LicenseStateName = 'Valid' | 'Grace' | 'ReadOnly';

export interface LicenseStatusDto {
  /** false ⇒ لایسنس در این نصب اعمال نمی‌شود (توسعه). */
  enforced: boolean;
  state: LicenseStateName;
  customer: string | null;
  /** yyyy-MM-dd میلادی */
  expiresAt: string | null;
  daysLeft: number | null;
  graceDaysLeft: number | null;
  message: string | null;
  /** لایسنس به‌تفکیک واحد است. */
  perUnit: boolean;
  /** وضعیت همهٔ واحدها — فقط برای کاربر واردشده و فقط در حالت به‌تفکیک واحد. */
  units: { code: string; state: LicenseStateName; expiresAt: string | null; daysLeft: number | null; graceDaysLeft: number | null }[];
}

export const licenseApi = {
  status(): Promise<LicenseStatusDto> {
    return apiClient.get<LicenseStatusDto>('/license/status').then((res) => res.data);
  },
  /** Content-Type دستی ست نمی‌شود — مرورگر boundary فرم‌دیتا را می‌سازد. */
  upload(file: File): Promise<LicenseStatusDto> {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post<LicenseStatusDto>('/license/upload', formData).then((res) => res.data);
  },
};

export const LICENSE_STATUS_KEY = ['license-status'] as const;
