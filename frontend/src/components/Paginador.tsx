import { Button } from './Button';

export interface PaginadorProps { pagina: number; totalPaginas: number; onPageChange(pagina: number): void }

export function Paginador({ pagina, totalPaginas, onPageChange }: PaginadorProps) {
  const total = Number.isFinite(totalPaginas) ? Math.max(0, Math.trunc(totalPaginas)) : 0;
  const current = total === 0 ? 0 : Math.min(total, Math.max(1, Number.isFinite(pagina) ? Math.trunc(pagina) : 1));
  return <nav aria-label="Paginación" className="flex flex-wrap items-center justify-center gap-3">
    <Button variant="secundario" disabled={current <= 1} onClick={() => onPageChange(current - 1)}>Anterior</Button>
    <p role="status" aria-live="polite">{total === 0 ? 'Sin páginas' : `Página ${current} de ${total}`}</p>
    <Button variant="secundario" disabled={current === 0 || current >= total} onClick={() => onPageChange(current + 1)}>Siguiente</Button>
  </nav>;
}
