import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { LoaderCircle } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primario' | 'secundario' | 'peligro' | 'fantasma';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primario', loading = false, disabled, type = 'button', className = '', children, ...props }, ref,
) {
  return <>
    <button {...props} ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || props['aria-busy']} className={`ui-button ui-button--${variant} ${className}`}>
      {loading && <LoaderCircle className="ui-icon ui-spinner" aria-hidden="true" />}
      <span>{children}</span>
    </button>
    {loading && <span role="status" className="sr-only">Cargando…</span>}
  </>;
});
