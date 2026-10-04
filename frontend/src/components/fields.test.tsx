import { createRef, useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Textarea } from './Textarea';

describe('campos institucionales', () => {
  it('asocia Correo, ayuda y error; conserva descripciones externas', async () => {
    const ref = createRef<HTMLInputElement>();
    render(<><p id="externo">Información adicional</p><Input ref={ref} id="correo" name="correo" label="Correo" help="Correo de contacto" error="Revisa el correo" required aria-describedby="externo" /></>);
    const input = screen.getByLabelText('Correo');
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('name', 'correo');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Información adicional Correo de contacto Revisa el correo');
    ref.current?.focus();
    expect(input).toHaveFocus();
    await userEvent.type(input, 'persona@empresa.com');
    expect(input).toHaveValue('persona@empresa.com');
  });

  it.each([Input, Textarea])('evita colisiones de ids entre campos repetidos (%s)', (Field) => {
    render(<><Field label="Nombre" help="Ayuda" error="Error" /><Field label="Nombre" help="Ayuda" error="Error" /></>);
    const controls = screen.getAllByLabelText('Nombre');
    expect(controls[0].id).not.toBe(controls[1].id);
    const descriptions = controls.flatMap((control) => control.getAttribute('aria-describedby')!.split(' '));
    expect(new Set(descriptions).size).toBe(4);
    for (const id of descriptions) expect(document.getElementById(id)).toBeInTheDocument();
  });

  it('Textarea conserva el label largo, contenido editable y foco por ref', async () => {
    const label = 'A'.repeat(120);
    const ref = createRef<HTMLTextAreaElement>();
    render(<Textarea ref={ref} label={label} help="Explica tu solicitud" error="Falta información" name="solicitud" required />);
    const input = screen.getByRole('textbox', { name: label });
    expect(input).toHaveAccessibleDescription('Explica tu solicitud Falta información');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    ref.current?.focus();
    expect(input).toHaveFocus();
    await userEvent.type(input, 'Primera línea{Enter}Segunda línea');
    expect(input).toHaveValue('Primera línea\nSegunda línea');
  });

  it('retira el error y su asociación cuando el campo vuelve a ser válido', () => {
    const { rerender } = render(<Input label="Correo" help="Ayuda" error="Error" />);
    const input = screen.getByLabelText('Correo');
    rerender(<Input label="Correo" help="Ayuda" />);
    expect(input).not.toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Ayuda');
    expect(screen.queryByText('Error')).not.toBeInTheDocument();
  });

  it('Select controlado abre, recorre y selecciona con teclado una sola vez', async () => {
    // jsdom no implementa scrollIntoView; el foco y la selección siguen siendo reales.
    const scrollDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
    Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: () => {} });
    const onValueChange = vi.fn();
    const onBlur = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    const label = 'Rol '.padEnd(120, 'a');
    const longOption = 'Nombre '.padEnd(120, 'b');
    function Form() {
      const [value, setValue] = useState('uno');
      return <form><Select ref={ref} id="rol" name="rol" label={label} help="Elige una opción" error="Revisa la opción" required value={value} options={[{ value: 'uno', label: 'Primero' }, { value: 'dos', label: longOption }]} onValueChange={(next) => { onValueChange(next); setValue(next); }} onBlur={onBlur} /><button type="button">Siguiente</button></form>;
    }
    try {
      render(<Form />);
      const trigger = screen.getByRole('combobox', { name: label });
      expect(screen.getByLabelText(label)).toBe(trigger);
      expect(trigger).toHaveAttribute('aria-invalid', 'true');
      expect(trigger).toHaveAttribute('aria-required', 'true');
      expect(trigger).toHaveAccessibleDescription('Elige una opción Revisa la opción');
      act(() => ref.current?.focus());
      expect(trigger).toHaveFocus();
      await userEvent.keyboard('{Enter}');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(screen.getByRole('option', { name: longOption })).toBeInTheDocument();
      await userEvent.keyboard('{ArrowDown}{Enter}');
      expect(onValueChange).toHaveBeenCalledExactlyOnceWith('dos');
      expect(trigger).toHaveTextContent(longOption);
      expect(new FormData(trigger.closest('form')!).get('rol')).toBe('dos');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      await userEvent.tab();
      expect(onBlur).toHaveBeenCalled();
    } finally {
      if (scrollDescriptor) Object.defineProperty(Element.prototype, 'scrollIntoView', scrollDescriptor);
      else Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    }
  });

  it('Select deshabilitado no abre ni emite cambios', async () => {
    // Radix consulta pointer capture incluso al recibir pointerdown deshabilitado.
    const pointerDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'hasPointerCapture');
    Object.defineProperty(Element.prototype, 'hasPointerCapture', { configurable: true, value: () => false });
    try {
      const onValueChange = vi.fn();
      render(<Select label="Rol" value="uno" disabled options={[{ value: 'uno', label: 'Primero' }]} onValueChange={onValueChange} />);
      await userEvent.click(screen.getByRole('combobox', { name: 'Rol' }));
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(onValueChange).not.toHaveBeenCalled();
    } finally {
      if (pointerDescriptor) Object.defineProperty(Element.prototype, 'hasPointerCapture', pointerDescriptor);
      else Reflect.deleteProperty(Element.prototype, 'hasPointerCapture');
    }
  });
});

describe('Button', () => {
  it('impide doble click y anuncia la carga sin perder el nombre', async () => {
    const onClick = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    const { rerender } = render(<Button ref={ref} loading onClick={onClick}>Guardar</Button>);
    const button = screen.getByRole('button', { name: 'Guardar' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(/cargando/i);
    await userEvent.dblClick(button);
    expect(onClick).not.toHaveBeenCalled();
    rerender(<Button ref={ref} onClick={onClick}>Guardar</Button>);
    ref.current?.focus();
    expect(button).toHaveFocus();
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('solo envía el formulario cuando se solicita submit explícitamente', async () => {
    const onSubmit = vi.fn((event) => event.preventDefault());
    const longName = 'G'.repeat(120);
    render(<form onSubmit={onSubmit}><Button>{longName}</Button><Button type="submit" variant="primario">Enviar</Button></form>);
    await userEvent.click(screen.getByRole('button', { name: longName }));
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
