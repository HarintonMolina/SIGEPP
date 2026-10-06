import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Link, useLocation } from 'react-router-dom';
import { ToastProvider } from './Toast';
import { useToast } from '../hooks/useToast';
import { Providers } from '../app/Providers';
import { createRuntime } from '../app/runtime';

afterEach(() => vi.useRealTimers());

function Notice({ tone = 'exito' }: { tone?: 'exito' | 'error' | 'informacion' }) {
  const { notify } = useToast();
  return <button onClick={() => notify({ title: 'Registro recibido', description: 'Puedes iniciar sesión', tone })}>Notificar</button>;
}

describe('Toast', () => {
  it('Escape sigue cerrando un aviso independiente con foco en su disparador', async () => {
    const user = userEvent.setup();
    render(<ToastProvider><Notice /></ToastProvider>);
    const trigger = screen.getByRole('button', { name: 'Notificar' });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Cerrar aviso' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('Escape sigue cerrando el aviso cuando el foco está dentro de él', async () => {
    const user = userEvent.setup();
    render(<ToastProvider><Notice /></ToastProvider>);
    await user.click(screen.getByRole('button', { name: 'Notificar' }));
    act(() => screen.getByRole('button', { name: 'Cerrar aviso' }).focus());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Cerrar aviso' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: /avisos/i })).toContainElement(document.activeElement as HTMLElement);
  });

  it.each([['exito', 'polite'], ['informacion', 'polite'], ['error', 'assertive']] as const)('anuncia %s con prioridad %s usando Radix real', async (tone, priority) => {
    render(<ToastProvider><Notice tone={tone} /></ToastProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'Notificar' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Registro recibido'));
    expect(screen.getByRole('status')).toHaveTextContent('Puedes iniciar sesión');
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', priority);
  });

  it('permite cierre explícito por teclado sin robar el foco al anunciar', async () => {
    const user = userEvent.setup();
    render(<ToastProvider><Notice /></ToastProvider>);
    const trigger = screen.getByRole('button', { name: 'Notificar' });
    await user.click(trigger);
    expect(trigger).toHaveFocus();
    screen.getByRole('button', { name: 'Cerrar aviso' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('button', { name: 'Cerrar aviso' })).not.toBeInTheDocument();
  });

  it.each([['exito', 5000], ['error', 10000]] as const)('mantiene %s hasta su duración y luego lo retira', (tone, duration) => {
    vi.useFakeTimers();
    render(<ToastProvider><Notice tone={tone} /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Notificar' }));
    act(() => vi.advanceTimersByTime(duration - 1));
    expect(screen.getByRole('button', { name: 'Cerrar aviso' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('button', { name: 'Cerrar aviso' })).not.toBeInTheDocument();
  });

  it('pausa al interactuar y reanuda con el tiempo restante', () => {
    vi.useFakeTimers();
    render(<ToastProvider><Notice /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Notificar' }));
    act(() => vi.advanceTimersByTime(2000));
    const close = screen.getByRole('button', { name: 'Cerrar aviso' });
    act(() => close.focus());
    act(() => vi.advanceTimersByTime(10000));
    expect(close).toBeInTheDocument();
    act(() => screen.getByRole('button', { name: 'Notificar' }).focus());
    act(() => vi.advanceTimersByTime(2999));
    expect(close).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(close).not.toBeInTheDocument();
  });

  it('permite avisos repetidos y conserva los previos al cambiar hijos', async () => {
    function View() {
      const [page, setPage] = useState(false);
      return <ToastProvider><button onClick={() => setPage(true)}>Cambiar</button>{page ? <p>Login</p> : <Notice />}</ToastProvider>;
    }
    render(<View />);
    await userEvent.click(screen.getByRole('button', { name: 'Notificar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Notificar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar' }));
    expect(screen.getAllByRole('button', { name: 'Cerrar aviso' })).toHaveLength(2);
  });

  it('Providers instala un único viewport global y preserva avisos al navegar', async () => {
    const runtime = createRuntime({ env: { apiUrl: 'http://localhost:4000/api/v1', institutionalDomains: ['uni.edu.ni'] }, storage: sessionStorage, fetchImpl: async () => new Response(null, { status: 401 }) });
    function Route() {
      const { pathname } = useLocation();
      return pathname === '/registro' ? <><Notice /><Link to="/login">Ir al login</Link></> : <p>Login</p>;
    }
    render(<Providers runtime={runtime}><MemoryRouter initialEntries={['/registro']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Route /></MemoryRouter></Providers>);
    await userEvent.click(screen.getByRole('button', { name: 'Notificar' }));
    await userEvent.click(screen.getByRole('link', { name: 'Ir al login' }));
    expect(screen.getByText('Login')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cerrar aviso' })).toBeInTheDocument();
    expect(screen.getAllByRole('region', { name: /avisos/i })).toHaveLength(1);
  });
});
