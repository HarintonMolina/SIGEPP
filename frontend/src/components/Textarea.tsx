import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
import type { FieldProps } from './field.types';

export type TextareaProps = FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, help, error, id, className = '', 'aria-describedby': describedBy, ...props }, ref,
) {
  const uniqueId = useId();
  const controlId = id ?? `${uniqueId}-textarea`;
  const helpId = `${uniqueId}-help`;
  const errorId = `${uniqueId}-error`;
  const description = [describedBy, help && helpId, error && errorId].filter(Boolean).join(' ') || undefined;
  return <div className="ui-field">
    <label htmlFor={controlId} className="ui-field-label">{label}</label>
    <textarea {...props} ref={ref} id={controlId} className={`ui-control ui-textarea ${className}`} aria-describedby={description} aria-invalid={error ? true : props['aria-invalid']} />
    {help && <p id={helpId} className="ui-field-help">{help}</p>}
    {error && <p id={errorId} className="ui-field-error">{error}</p>}
  </div>;
});
