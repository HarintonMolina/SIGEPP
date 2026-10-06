import { forwardRef, useId, useState, type FocusEventHandler } from 'react';
import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { FieldProps } from './field.types';

export interface SelectProps extends FieldProps {
  name?: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onValueChange: (value: string) => void;
  onBlur?: FocusEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  { label, help, error, id, name, value, options, onValueChange, onBlur, disabled, required }, ref,
) {
  const [open, setOpen] = useState(false);
  const uniqueId = useId();
  const controlId = id ?? `${uniqueId}-select`;
  const labelId = `${uniqueId}-label`;
  const helpId = `${uniqueId}-help`;
  const errorId = `${uniqueId}-error`;
  const description = [help && helpId, error && errorId].filter(Boolean).join(' ') || undefined;
  return <div className="ui-field">
    <label id={labelId} htmlFor={controlId} className="ui-field-label">{label}</label>
    <RadixSelect.Root open={open} onOpenChange={setOpen} name={name} value={value} onValueChange={onValueChange} disabled={disabled} required={required}>
      <RadixSelect.Trigger ref={ref} id={controlId} onBlur={onBlur} aria-labelledby={labelId} aria-describedby={description} aria-invalid={error ? true : undefined} className="ui-control ui-select-trigger">
        <RadixSelect.Value placeholder="Selecciona una opción" />
        <RadixSelect.Icon asChild><ChevronDown className="ui-icon" aria-hidden="true" /></RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          onKeyDown={(event) => {
            // A newer Toast can handle Escape in capture without consuming it.
            // Radix still owns normal dismissal and restores focus on unmount.
            if (event.key !== 'Escape' || event.defaultPrevented || !event.currentTarget.contains(event.target as Node)) return;
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }}
          position="popper" sideOffset={4} className="ui-select-content">
          <RadixSelect.ScrollUpButton className="ui-select-scroll"><ChevronUp className="ui-icon" aria-hidden="true" /></RadixSelect.ScrollUpButton>
          <RadixSelect.Viewport>
            {options.map((option) => <RadixSelect.Item key={option.value} value={option.value} className="ui-select-option">
              <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
              <RadixSelect.ItemIndicator><Check className="ui-icon" aria-hidden="true" /></RadixSelect.ItemIndicator>
            </RadixSelect.Item>)}
          </RadixSelect.Viewport>
          <RadixSelect.ScrollDownButton className="ui-select-scroll"><ChevronDown className="ui-icon" aria-hidden="true" /></RadixSelect.ScrollDownButton>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
    {help && <p id={helpId} className="ui-field-help">{help}</p>}
    {error && <p id={errorId} className="ui-field-error">{error}</p>}
  </div>;
});
