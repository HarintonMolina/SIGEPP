import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tabla, type Column } from './Tabla';
import { EmptyState } from './EmptyState';

const rows = [{ id: 'b', nombre: 'Beatriz' }, { id: 'a', nombre: 'Ana' }];
const columns: Column<(typeof rows)[number]>[] = [{ id: 'nombre', header: 'Nombre', render: (row) => row.nombre, sortable: true }];
const empty = <EmptyState title="Sin resultados" description="No hay registros" />;
let desktop = true;
let listeners: Set<() => void>;
beforeEach(() => {
  desktop = true;
  listeners = new Set();
  vi.stubGlobal('matchMedia', (media: string) => ({ media, get matches() { return desktop; }, addEventListener: (_: string, callback: () => void) => listeners.add(callback), removeEventListener: (_: string, callback: () => void) => listeners.delete(callback) }));
});
afterEach(() => vi.unstubAllGlobals());

describe('Tabla', () => {
  it('expone caption y encabezados scope col; comunica orden y emite sin reordenar filas', async () => {
    const onSortChange = vi.fn();
    const props = { caption: 'Estudiantes', rows, columns, getRowId: (row: (typeof rows)[number]) => row.id, empty, onSortChange };
    const { rerender } = render(<Tabla {...props} sort={{ columnId: 'nombre', direction: 'asc' }} />);
    const table = screen.getByRole('table', { name: 'Estudiantes' });
    expect(within(table).getByRole('columnheader')).toHaveAttribute('scope', 'col');
    expect(within(table).getByRole('columnheader')).toHaveAttribute('aria-sort', 'ascending');
    await userEvent.click(within(table).getByRole('button', { name: /nombre/i }));
    expect(onSortChange).toHaveBeenLastCalledWith({ columnId: 'nombre', direction: 'desc' });
    expect(within(table).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Beatriz', 'Ana']);
    rerender(<Tabla {...props} sort={{ columnId: 'nombre', direction: 'desc' }} />);
    expect(within(table).getByRole('columnheader')).toHaveAttribute('aria-sort', 'descending');
    await userEvent.click(within(table).getByRole('button', { name: /nombre/i }));
    expect(onSortChange).toHaveBeenLastCalledWith({ columnId: 'nombre', direction: 'asc' });
  });

  it('inicia ascendente otra columna y no ofrece ordenar sin callback', async () => {
    const onSortChange = vi.fn();
    const props = { caption: 'Estudiantes', rows, columns, getRowId: (row: (typeof rows)[number]) => row.id, empty };
    const { rerender } = render(<Tabla {...props} sort={{ columnId: 'otra', direction: 'desc' }} onSortChange={onSortChange} />);
    await userEvent.click(screen.getByRole('button', { name: /nombre/i }));
    expect(onSortChange).toHaveBeenCalledWith({ columnId: 'nombre', direction: 'asc' });
    rerender(<Tabla {...props} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('muestra vacío sin filas de datos falsas', () => {
    render(<Tabla caption="Estudiantes" rows={[]} columns={columns} getRowId={(row) => row.id} empty={empty} />);
    expect(screen.getByRole('heading', { name: 'Sin resultados' })).toBeVisible();
    expect(screen.queryByRole('cell')).not.toBeInTheDocument();
  });

  it('presenta carga/error con reintento sin datos obsoletos', async () => {
    const onRetry = vi.fn();
    const props = { caption: 'Estudiantes', rows, columns, getRowId: (row: (typeof rows)[number]) => row.id, empty };
    const { rerender } = render(<Tabla {...props} loading />);
    expect(screen.getByRole('status')).toHaveTextContent(/cargando/i);
    expect(screen.queryByRole('cell')).not.toBeInTheDocument();
    rerender(<Tabla {...props} error="Falló la consulta" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Falló la consulta');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('cell')).not.toBeInTheDocument();
  });

  it('cambia a tarjetas etiquetadas y conserva IDs/relaciones únicos al redimensionar', async () => {
    const onSortChange = vi.fn();
    const linked: Column<(typeof rows)[number]>[] = [{ id: 'nombre', header: 'Nombre', sortable: true, render: (row) => <><label htmlFor={`nombre-${row.id}`}>Editar {row.nombre}</label><input id={`nombre-${row.id}`} defaultValue={row.nombre} /></> }];
    const { container, unmount } = render(<Tabla caption="Estudiantes" rows={rows} columns={linked} getRowId={(row) => row.id} empty={empty} onSortChange={onSortChange} sort={{ columnId: 'nombre', direction: 'asc' }} />);
    expect(container.querySelectorAll('#nombre-b')).toHaveLength(1);
    act(() => { desktop = false; listeners.forEach((listener) => listener()); });
    expect(container.querySelectorAll('#nombre-b')).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: 'Editar Beatriz' })).toHaveValue('Beatriz');
    const list = screen.getByRole('list', { name: 'Estudiantes' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getAllByText('Nombre')).toHaveLength(2);
    expect(container.querySelector('table')?.parentElement).toHaveClass('hidden', 'sm:block');
    expect(list.parentElement).toHaveClass('sm:hidden');
    expect(screen.getByRole('button', { name: /nombre.*ascendente/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /nombre.*ascendente/i }));
    expect(onSortChange).toHaveBeenCalledWith({ columnId: 'nombre', direction: 'desc' });
    act(() => { desktop = true; listeners.forEach((listener) => listener()); });
    expect(container.querySelectorAll('#nombre-b')).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: 'Editar Beatriz' })).toHaveValue('Beatriz');
    expect(screen.queryByRole('list', { name: 'Estudiantes' })).not.toBeInTheDocument();
    unmount();
    expect(listeners.size).toBe(0);
  });
});
