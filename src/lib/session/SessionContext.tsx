import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getRequestedUnitCode, setRequestedUnitCode } from './unitScopeStore';

/**
 * "تنظیمات اولیه" pattern carried over from the old Angular app: the user picks a financial year
 * and an organizational unit once, and the rest of the app reads it from here instead of asking
 * again per page.
 *
 * ⚠️ **Changed in phase 37.** The unit used to be a display-only label, because the backend
 * derived it from the token by exact equality and the standing frontend rule was "never send
 * vahedCode". That rule is gone: the backend now accepts an `X-Vahed-Code` header and validates
 * it against the caller's own subtree (`IUnitScopeResolver`), so a user may act as any unit they
 * are entitled to. What has NOT changed is who decides — the server rejects a unit the user may
 * not act as with 403. Setting a value here *asks*; it does not grant.
 *
 * `financialYear` remains a real query parameter (e.g. `GET /api/voucher-heads?year=...`).
 */

const STORAGE_KEY = 'accounting.session';

interface SessionState {
  financialYear: string;
  /** The chosen unit's code — sent on every request by the axios interceptor. */
  unitCode: string;
  /** Display name for the chosen unit. Never sent anywhere. */
  unitName: string;
}

interface SessionContextValue extends SessionState {
  /** Alias kept for the report export header, which labels the sheet with the unit name. */
  unitLabel: string;
  setFinancialYear: (year: string) => void;
  setUnit: (unit: { unitCode: string; unitName: string }) => void;
  isConfigured: boolean;
}

const defaultState: SessionState = { financialYear: '', unitCode: '', unitName: '' };

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
  const [state, setState] = useState<SessionState>(() => {
    const initial = readInitialState();

    // Keep the out-of-React store (which the axios interceptor reads) in step with the restored
    // state on the very first render, before any request can be issued.
    if (initial.unitCode !== getRequestedUnitCode()) {
      setRequestedUnitCode(initial.unitCode || null);
    }

    return initial;
  });

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
      unitLabel: state.unitName,
      setFinancialYear: (financialYear: string) => setState((s) => ({ ...s, financialYear })),
      setUnit: ({ unitCode, unitName }) => {
        // Write the interceptor's store FIRST: React state updates asynchronously, and a request
        // fired in between must not go out under the previous unit.
        setRequestedUnitCode(unitCode || null);
        setState((s) => ({ ...s, unitCode, unitName }));
      },
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
