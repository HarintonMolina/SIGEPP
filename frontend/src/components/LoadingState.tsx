import { LoaderCircle } from 'lucide-react';

export interface LoadingStateProps { label: string }

export function LoadingState({ label }: LoadingStateProps) {
  return <div className="ui-state" role="status"><LoaderCircle className="ui-icon ui-spinner" aria-hidden="true" /><p>{label}</p></div>;
}
