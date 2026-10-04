import { CircleAlert } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps { message: string; onRetry?: () => void }

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return <div className="ui-state">
    <div role="alert" className="ui-state-error"><CircleAlert className="ui-icon" aria-hidden="true" /><p>{message}</p></div>
    {onRetry && <Button variant="secundario" onClick={onRetry}>Reintentar</Button>}
  </div>;
}
