import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import type { FieldProps } from './field.types';

export type InputProps = FieldProps & InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, help, error, id, className = '', 'aria-describedby': describedBy, ...props }, ref,
) {
  const uniqueId = useId();
  const controlId = id ?? `${uniqueId}-input`;
  const helpId = `${uniqueId}-help`;
  const errorId = `${uniqueId}-error`;
  const description = [describedBy, help && helpId, error && errorId].filter(Boolean).join(' ') || undefined;
  return <div className="ui-field">
    <label htmlFor={controlId} className="ui-field-label">{label}</label>
    <input {...props} ref={ref} id={controlId} className={`ui-control ${className}`} aria-describedby={description} aria-invalid={error ? true : props['aria-invalid']} />
    {help && <p id={helpId} className="ui-field-help">{help}</p>}
    {error && <p id={errorId} className="ui-field-error">{error}</p>}
  </div>;
});
