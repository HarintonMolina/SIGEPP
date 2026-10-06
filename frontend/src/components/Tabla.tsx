import { useSyncExternalStore, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import { ErrorState } from './ErrorState';
import { LoadingState } from './LoadingState';

export type Column<T> = { id: string; header: string; render(row: T): ReactNode; sortable?: boolean };
export type SortState = { columnId: string; direction: 'asc' | 'desc' };
export interface TablaProps<T> {
  caption: string;
  rows: T[];
  columns: Column<T>[];
  getRowId(row: T): string;
  sort?: SortState;
  onSortChange?(sort: SortState): void;
  loading?: boolean;
  error?: string;
  onRetry?(): void;
  empty: ReactNode;
}

const breakpoint = '(min-width: 640px)';
function subscribe(listener: () => void) {
  if (!window.matchMedia) return () => {};
  const query = window.matchMedia(breakpoint);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}
function desktopSnapshot() { return window.matchMedia?.(breakpoint).matches ?? true; }

export function Tabla<T>({ caption, rows, columns, getRowId, sort, onSortChange, loading, error, onRetry, empty }: TablaProps<T>) {
  // Only the active representation mounts consumer content, preserving its IDs and label relations.
  const desktop = useSyncExternalStore(subscribe, desktopSnapshot, () => true);
  if (loading) return <LoadingState label={`Cargando ${caption}…`} />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (rows.length === 0) return <>{empty}</>;

  const sortColumn = columns.find((column) => column.id === sort?.columnId);
  const changeSort = (column: Column<T>) => onSortChange?.({ columnId: column.id, direction: sort?.columnId === column.id && sort.direction === 'asc' ? 'desc' : 'asc' });
  const sortButton = (column: Column<T>) => {
    const active = sort?.columnId === column.id;
    const direction = active ? (sort.direction === 'asc' ? 'ascendente' : 'descendente') : undefined;
    const Icon = active ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return <Button variant="fantasma" onClick={() => changeSort(column)} aria-label={`${column.header}${direction ? `, orden ${direction}` : ''}. Ordenar ${active && sort.direction === 'asc' ? 'descendente' : 'ascendente'}`}>
      {column.header}<Icon className="ui-icon" aria-hidden="true" />
    </Button>;
  };

  return <div className="min-w-0">
    <div className="hidden sm:block">
      <table className="w-full table-fixed border-collapse bg-surface">
        {desktop && <>
          <caption className="p-3 text-left text-lg font-semibold">{caption}</caption>
          <thead><tr>{columns.map((column) => <th key={column.id} scope="col" className="border-b border-border p-3 text-left"
            aria-sort={column.sortable ? (sort?.columnId === column.id ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}>
            {column.sortable && onSortChange ? sortButton(column) : column.header}
          </th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={getRowId(row)}>{columns.map((column) => <td key={column.id} className="border-b border-border p-3 align-top">{column.render(row)}</td>)}</tr>)}</tbody>
        </>}
      </table>
    </div>
    <div className="sm:hidden">
      {!desktop && <>
        <h2 className="mb-3 text-lg font-semibold">{caption}</h2>
        {onSortChange && <div className="mb-3 flex flex-wrap gap-2">{columns.filter((column) => column.sortable).map((column) => <div key={column.id}>{sortButton(column)}</div>)}</div>}
        <ul aria-label={caption} className="grid list-none gap-3 p-0">{rows.map((row) => <li key={getRowId(row)}>
          <Card><dl className="grid gap-3">{columns.map((column) => <div key={column.id} className="min-w-0"><dt className="font-semibold">{column.header}</dt><dd>{column.render(row)}</dd></div>)}</dl></Card>
        </li>)}</ul>
      </>}
    </div>
    {sort && sortColumn && <p role="status" className="sr-only">Ordenado por {sortColumn.header}, {sort.direction === 'asc' ? 'ascendente' : 'descendente'}</p>}
  </div>;
}
