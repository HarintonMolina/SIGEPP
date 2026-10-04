import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';

export interface BadgeProps {
  tone: 'exito' | 'advertencia' | 'error' | 'informacion';
  label: string;
}

const icons = { exito: CircleCheck, advertencia: TriangleAlert, error: CircleAlert, informacion: Info };

export function Badge({ tone, label }: BadgeProps) {
  const Icon = icons[tone];
  return <span className={`ui-badge ui-badge--${tone}`}><Icon className="ui-icon" aria-hidden="true" /><span>{label}</span></span>;
}
