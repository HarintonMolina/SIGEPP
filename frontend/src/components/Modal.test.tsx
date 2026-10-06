import { createRef, useState } from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import { Modal } from './Modal';
import { Select } from './Select';
import { ToastProvider } from './Toast';
import { useToast } from '../hooks/useToast';

describe('Modal', () => {
  it('cierra con el primer Escape tras crear un aviso interno y devuelve el foco una sola vez', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    function View() {
      const [open, setOpen] = useState(false);
      const { notify } = useToast();
      return <Modal open={open} onOpenChange={(next) => { onOpenChange(next); setOpen(next); }} title="Menú" description="Elige una acción" trigger={<Button>Abrir menú</Button>}>
        <button onClick={() => notify({ title: 'Acción recibida', tone: 'informacion' })}>Mostrar aviso dentro del diálogo</button>
      </Modal>;
    }
    render(<ToastProvider><View /></ToastProvider>);
    const trigger = screen.getByRole('button', { name: 'Abrir menú' });
    await user.click(trigger);
    const internal = screen.getByRole('button', { name: 'Mostrar aviso dentro del diálogo' });
    await user.click(internal);
    expect(internal).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Cerrar aviso', hidden: true })).toBeInTheDocument();
    onOpenChange.mockClear();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('Escape respeta un Select anidado y después cierra el Modal con el aviso todavía activo', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const scrollDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
    Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: () => {} });
    function View() {
      const [open, setOpen] = useState(false);
      const [value, setValue] = useState('uno');
      const { notify } = useToast();
      return <Modal open={open} onOpenChange={(next) => { onOpenChange(next); setOpen(next); }} title="Menú" description="Elige una acción" trigger={<Button>Abrir menú</Button>}>
        <button onClick={() => notify({ title: 'Acción recibida', tone: 'informacion' })}>Notificar</button>
        <Select label="Rol" value={value} options={[{ value: 'uno', label: 'Primero' }, { value: 'dos', label: 'Segundo' }]} onValueChange={setValue} />
      </Modal>;
    }
    try {
      render(<ToastProvider><View /></ToastProvider>);
      const trigger = screen.getByRole('button', { name: 'Abrir menú' });
      await user.click(trigger);
      await user.click(screen.getByRole('button', { name: 'Notificar' }));
      const select = screen.getByRole('combobox', { name: 'Rol' });
      act(() => select.focus());
      await user.keyboard('{Enter}');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      onOpenChange.mockClear();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Menú' })).toBeVisible();
      expect(select).toHaveFocus();
      expect(onOpenChange).not.toHaveBeenCalled();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
      expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    } finally {
      if (scrollDescriptor) Object.defineProperty(Element.prototype, 'scrollIntoView', scrollDescriptor);
      else Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    }
  });

  it('el primer Escape cierra solo el Modal anidado aunque genere un aviso posterior', async () => {
    const user = userEvent.setup();
    const outerChanges = vi.fn();
    const innerChanges = vi.fn();
    function View() {
      const [outerOpen, setOuterOpen] = useState(false);
      const [innerOpen, setInnerOpen] = useState(false);
      const { notify } = useToast();
      return <Modal open={outerOpen} onOpenChange={(next) => { outerChanges(next); setOuterOpen(next); }} title="Exterior" description="Acciones" trigger={<Button>Abrir exterior</Button>}>
        <Modal open={innerOpen} onOpenChange={(next) => { innerChanges(next); setInnerOpen(next); }} title="Interior" description="Confirmación" trigger={<Button>Abrir interior</Button>}>
          <button onClick={() => notify({ title: 'Acción recibida', tone: 'informacion' })}>Notificar</button>
        </Modal>
      </Modal>;
    }
    render(<ToastProvider><View /></ToastProvider>);
    await user.click(screen.getByRole('button', { name: 'Abrir exterior' }));
    const innerTrigger = screen.getByRole('button', { name: 'Abrir interior' });
    await user.click(innerTrigger);
    await user.click(screen.getByRole('button', { name: 'Notificar' }));
    outerChanges.mockClear();
    innerChanges.mockClear();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Interior' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Exterior' })).toBeVisible();
    expect(innerTrigger).toHaveFocus();
    expect(outerChanges).not.toHaveBeenCalled();
    expect(innerChanges).toHaveBeenCalledExactlyOnceWith(false);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir exterior' })).toHaveFocus();
    expect(outerChanges).toHaveBeenCalledExactlyOnceWith(false);
    expect(innerChanges).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('conserva ref, nombre, descripción y foco al abrir, tabular y cerrar con Escape', async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLButtonElement>();
    function View() {
      const [open, setOpen] = useState(false);
      return <><button>Fuera</button><Modal open={open} onOpenChange={setOpen} title="Menú" description="Elige una acción" trigger={<Button ref={ref}>Abrir menú</Button>}><button>Primera acción</button><button>Última acción</button></Modal></>;
    }
    render(<View />);
    const trigger = screen.getByRole('button', { name: 'Abrir menú' });
    expect(ref.current).toBe(trigger);
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Menú' });
    expect(dialog).toBeVisible();
    expect(dialog).toHaveAccessibleDescription('Elige una acción');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    const buttons = within(dialog).getAllByRole('button');
    buttons.at(-1)!.focus();
    await user.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('permite cerrar explícitamente un diálogo abierto sin trigger', async () => {
    function View() {
      const [open, setOpen] = useState(true);
      return <Modal open={open} onOpenChange={setOpen} title="Confirmación" description="Revisa los datos"><p>Contenido</p></Modal>;
    }
    render(<View />);
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar diálogo' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
