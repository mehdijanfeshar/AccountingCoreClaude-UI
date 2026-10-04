import { useSyncExternalStore } from 'react';

/**
 * ط-۹ — اجرای تهیه «در پس‌زمینه» (سند منبع §۱۲-۳: «امکان ترک صفحه و دریافت اعلان»): درخواست تهیه در همین
 * مرورگر ادامه می‌یابد و کاربر آزادانه در برنامه می‌گردد؛ با پایان، اعلان می‌آید. فهرست کارهای در جریان در حافظهٔ
 * همین برگه است (با بستن برگه، درخواست در سرور تمام می‌شود ولی اعلان نمی‌آید — اجرا در فهرست اجراها دیده می‌شود).
 */
interface Job {
  id: number;
  label: string;
}

let jobs: Job[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function startBackgroundRun<T>(label: string, work: () => Promise<T>, onDone: (result: T) => void, onError: (error: unknown) => void): void {
  const job = { id: nextId++, label };
  jobs = [...jobs, job];
  emit();
  work()
    .then(onDone, onError)
    .finally(() => {
      jobs = jobs.filter((j) => j.id !== job.id);
      emit();
    });
}

export function useBackgroundRuns(): Job[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => jobs,
  );
}
