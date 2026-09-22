import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../lib/session/SessionContext';
import { meApi } from '../../lib/api/meApi';
import { yearsApi } from '../../lib/api/yearsApi';

/**
 * Seeds the session from the server's own defaults on first visit — the year flagged
 * `isCurrent` and the unit flagged `isDefault` (the caller's own). The old Angular app did the
 * same in `app.component.ts` on bootstrap.
 *
 * Only fetches what is actually missing, and never overwrites a choice the user has already
 * made. Failures are deliberately silent: the header simply keeps showing "—" and the user can
 * open the picker, which surfaces the real error properly.
 */
export function useSessionDefaults(): void {
  const { financialYear, unitCode, setFinancialYear, setUnit } = useSession();

  const needsYear = financialYear.trim().length === 0;
  const needsUnit = unitCode.trim().length === 0;

  const yearsQuery = useQuery({
    queryKey: ['years'],
    queryFn: () => yearsApi.getAll(),
    enabled: needsYear,
    retry: false,
  });

  const unitsQuery = useQuery({
    queryKey: ['accessible-units'],
    queryFn: () => meApi.getAccessibleUnits(),
    enabled: needsUnit,
    retry: false,
  });

  useEffect(() => {
    if (!needsYear || !yearsQuery.data) return;

    // Fall back to the newest year (the list is ordered newest-first server-side) when no row is
    // flagged current — better than leaving the app unusable over a missing flag.
    const current = yearsQuery.data.find((y) => y.isCurrent === true) ?? yearsQuery.data[0];
    if (current) setFinancialYear(String(current.workingYear));
  }, [needsYear, yearsQuery.data, setFinancialYear]);

  useEffect(() => {
    if (!needsUnit || !unitsQuery.data) return;

    // `isDefault` is computed server-side and marks exactly the caller's own unit. Never derive
    // this client-side by comparing codes.
    const own = unitsQuery.data.find((u) => u.isDefault);
    if (own) setUnit({ unitCode: own.vahedCode, unitName: own.vahedName });
  }, [needsUnit, unitsQuery.data, setUnit]);
}
