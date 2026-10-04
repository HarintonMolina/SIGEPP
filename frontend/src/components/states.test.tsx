import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Badge } from './Badge';
import { Card } from './Card';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { LoadingState } from './LoadingState';

describe('estados visuales', () => {
  it.each(['exito', 'advertencia', 'error', 'informacion'] as const)('Badge %s muestra texto completo e icono decorativo', (tone) => {
    const label = 'E'.repeat(120);
    const { container } = render(<Badge tone={tone} label={label} />);
    expect(screen.getByText(label)).toBeVisible();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('EmptyState sin acción comunica su título y explicación sin enlace vacío', () => {
    const title = 'T'.repeat(120);
    render(<EmptyState title={title} description="Esta sección aún no está disponible" />);
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByText('Esta sección aún no está disponible')).toBeVisible();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('EmptyState presenta la acción con destino real y nombre completo', () => {
    const label = 'V'.repeat(120);
    render(<EmptyState title="Sin resultados" description="Prueba otra búsqueda" action={{ label, href: '/inicio' }} />);
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', '/inicio');
  });

  it('LoadingState anuncia el label completo sin aplazar la región viva', () => {
    const label = 'C'.repeat(120);
    render(<LoadingState label={label} />);
    expect(screen.getByRole('status')).toHaveTextContent(label);
    expect(screen.getByRole('status')).not.toHaveAttribute('aria-busy', 'true');
  });

  it('ErrorState comunica el mensaje y solo presenta reintento si existe callback', async () => {
    const onRetry = vi.fn();
    const { rerender } = render(<ErrorState message="No se pudo cargar" />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    rerender(<ErrorState message="No se pudo cargar" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('Card conserva atributos HTML y contenido sin introducir interacción', () => {
    render(<Card aria-label="Resumen"><h2>Mi perfil</h2><p>Información personal</p></Card>);
    expect(screen.getByLabelText('Resumen')).toHaveTextContent('Información personal');
    expect(screen.getByRole('heading', { name: 'Mi perfil' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Resumen')).not.toHaveAttribute('tabindex');
  });
});
