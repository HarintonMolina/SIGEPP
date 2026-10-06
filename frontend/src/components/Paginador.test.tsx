import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Paginador } from './Paginador';

describe('Paginador', () => {
  it('no emite cero ni total+1 y permanece controlado', async () => {
    const onPageChange = vi.fn();
    const { rerender } = render(<Paginador pagina={1} totalPaginas={3} onPageChange={onPageChange} />);
    expect(screen.getByRole('navigation', { name: 'Paginación' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(onPageChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(onPageChange).toHaveBeenLastCalledWith(2);
    expect(screen.getByText('Página 1 de 3')).toBeVisible();
    rerender(<Paginador pagina={3} totalPaginas={3} onPageChange={onPageChange} />);
    onPageChange.mockClear();
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(onPageChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(onPageChange).toHaveBeenLastCalledWith(2);
  });

  it('con cero resultados muestra Sin páginas y deshabilita ambas acciones', async () => {
    const onPageChange = vi.fn();
    render(<Paginador pagina={1} totalPaginas={0} onPageChange={onPageChange} />);
    expect(screen.getByText('Sin páginas')).toBeVisible();
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled();
      await userEvent.click(button);
    }
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it.each([[0, 'Página 1 de 3', 'Anterior', 'Siguiente', 2], [99, 'Página 3 de 3', 'Siguiente', 'Anterior', 2]] as const)('normaliza página %i solo al presentar, sin llamar al padre', async (pagina, label, disabled, enabled, next) => {
    const onPageChange = vi.fn();
    render(<Paginador pagina={pagina} totalPaginas={3} onPageChange={onPageChange} />);
    expect(screen.getByText(label)).toBeVisible();
    expect(screen.getByRole('button', { name: disabled })).toBeDisabled();
    expect(onPageChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: enabled }));
    expect(onPageChange).toHaveBeenCalledExactlyOnceWith(next);
  });
});
