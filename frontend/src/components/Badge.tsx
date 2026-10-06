import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';

export interface BadgeProps {
  tone: 'exito' | 'advertencia' | 'error' | 'informacion';
  label: string;
}

const icons = { exito: CircleCheck, advertencia: TriangleAlert, error: CircleAlert, informacion: Info };
const tones = {
  exito: 'ui-badge--exito',
  advertencia: 'ui-badge--advertencia',
  error: 'ui-badge--error',
  informacion: 'ui-badge--informacion',
};

export function Badge({ tone, label }: BadgeProps) {
  const Icon = icons[tone];
  return <span className={`ui-badge ${tones[tone]}`}><Icon className="ui-icon" aria-hidden="true" /><span>{label}</span></span>;
}
