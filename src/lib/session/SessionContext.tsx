import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * "تنظیمات اولیه" pattern carried over from the old Angular app: the user
 * picks a financial year (and, there, an organizational unit) once, and the
 * rest of the app reads it from here instead of asking again per page.
 *
 * ⚠️ Difference from the old app: `unitLabel` here is DISPLAY-ONLY. The new
 * backend derives the organizational unit (`VahedCode`) server-side from the
 * authenticated user's token (`VahedScopeBehavior`, phase 19) — it must
 * NEVER be sent as a request parameter. `financialYear`, on the other hand,
 * is a real query parameter (e.g. `GET /api/voucher-heads?year=...`).
 */

const STORAGE_KEY = 'accounting.session';

interface SessionState {
  financialYear: string;
  /** Informational only — never sent to the API. */
  unitLabel: string;
}

interface SessionContextValue extends SessionState {
  setFinancialYear: (year: string) => void;
  setUnitLabel: (label: string) => void;
  isConfigured: boolean;
}

const defaultState: SessionState = { financialYear: '', unitLabel: '' };

function readInitialState(): SessionState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as Partial<SessionState>;
    return { ...defaultState, ...parsed };
  } catch {
    return defaultState;
  }
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(readInitialState);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore storage failures
    }
  }, [state]);

  const value = useMemo<SessionContextValue>(
    () => ({
      ...state,
      setFinancialYear: (financialYear: string) => setState((s) => ({ ...s, financialYear })),
      setUnitLabel: (unitLabel: string) => setState((s) => ({ ...s, unitLabel })),
      isConfigured: state.financialYear.trim().length > 0,
    }),
    [state],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
