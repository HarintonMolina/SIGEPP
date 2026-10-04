import { useId } from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: { label: string; href: string };
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  const titleId = useId();
  return <section className="ui-state" aria-labelledby={titleId}>
    <Inbox className="ui-icon" aria-hidden="true" />
    <h2 id={titleId} className="ui-state-title">{title}</h2>
    <p>{description}</p>
    {action && <a className="ui-button ui-button--secundario" href={action.href}>{action.label}</a>}
  </section>;
}
