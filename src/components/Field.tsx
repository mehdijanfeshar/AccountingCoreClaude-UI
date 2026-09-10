import type { ReactNode } from 'react';

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

/**
 * Minimal labeled-field wrapper for future forms (voucher entry, chart of
 * accounts editing). Deliberately plain/dependency-free for this scaffold —
 * the final UI kit choice is an open decision (see task Follow-up items).
 */
export function Field({ label, htmlFor, error, required, children }: FieldProps) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
