import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Controller, useForm, useWatch, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Button } from '../../components/Button';
import { env } from '../../config/env';
import { useSession } from '../../hooks/useSession';
import { useToast } from '../../hooks/useToast';
import { isCurrentAuthOperation, useRegistro } from './auth-hooks';
import { createRegistroFormSchema, toRegistroInput, type RegistroFormValues, type RegistroFormParsed } from './schemas';
import { splitFormErrors } from './form-errors';

const schema = createRegistroFormSchema(env.institutionalDomains);
const commonFields = ['nombres', 'apellidos', 'correo', 'telefono'] as const;
const roleOptions = [{ value: 'ESTUDIANTE', label: 'Estudiante' }, { value: 'TUTOR_ACADEMICO', label: 'Tutor académico' }];
const yearOptions = [1, 2, 3, 4, 5].map((year) => ({ value: String(year), label: String(year) }));
const defaults: RegistroFormValues = { rol: 'ESTUDIANTE', nombres: '', apellidos: '', correo: '', contrasena: '', confirmacion: '', telefono: '', carnet: '', carrera: '', anio: '1' };

export default function RegistroPage() {
  const registro = useRegistro(); const { service } = useSession();
  const { notify } = useToast(); const navigate = useNavigate();
  const { register, control, getValues, reset, setValue, handleSubmit, setError, setFocus, formState: { errors, isSubmitting } } = useForm<RegistroFormValues, unknown, RegistroFormParsed>({ resolver: zodResolver(schema), defaultValues: defaults });
  const rol = useWatch({ control, name: 'rol' }); const [general, setGeneral] = useState<string[]>([]);
  const summary = useRef<HTMLDivElement>(null); const submitting = useRef(false);
  const focusAfterSubmit = useRef<{ field: FieldPath<RegistroFormValues>; operation: unknown } | null>(null);
  useEffect(() => {
    if (isSubmitting || !focusAfterSubmit.current) return;
    const { field, operation } = focusAfterSubmit.current; focusAfterSubmit.current = null;
    if (isCurrentAuthOperation(service, operation)) setFocus(field);
  }, [isSubmitting, service, setFocus]);
  const activeFields: FieldPath<RegistroFormValues>[] = [...commonFields, ...(rol === 'ESTUDIANTE' ? ['carnet', 'carrera', 'anio'] as const : ['departamento', 'especialidad'] as const), 'contrasena', 'confirmacion'];
  // Union-specific field errors are read from their path without changing the parsed types.
  const errorFor = (name: FieldPath<RegistroFormValues>) => { const error = Object.entries(errors).find(([key]) => key === name)?.[1]; return error?.message; };
  const submit = async (values: RegistroFormParsed) => {
    setGeneral([]);
    await registro.mutateAsync(toRegistroInput(values), {
      onSuccess(_usuario, input, operation) {
        if (!isCurrentAuthOperation(service, operation)) return;
        setValue('contrasena', ''); setValue('confirmacion', '');
        notify({ tone: 'exito', title: 'Cuenta creada', description: 'Inicia sesión con tu nueva cuenta.' });
        navigate('/login', { replace: true, state: { correo: input.correo } });
      },
      onError(error, _input, operation) {
        if (!isCurrentAuthOperation(service, operation, error)) return;
        const split = splitFormErrors(error, activeFields); setGeneral(split.general);
        const first = activeFields.find((name) => split.fields[name]);
        for (const name of activeFields) if (split.fields[name]) setError(name, { type: 'server', message: split.fields[name] });
        if (first) focusAfterSubmit.current = { field: first, operation };
        if (!first) summary.current?.focus();
      },
    }).catch(() => undefined);
  };
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (submitting.current) return;
    submitting.current = true; void handleSubmit(submit)(event).finally(() => { submitting.current = false; });
  }
  function changeRole(next: string) {
    if (next !== 'ESTUDIANTE' && next !== 'TUTOR_ACADEMICO') return;
    const values = getValues();
    const common = { nombres: values.nombres, apellidos: values.apellidos, correo: values.correo, contrasena: values.contrasena, confirmacion: values.confirmacion, telefono: values.telefono };
    reset(next === 'ESTUDIANTE' ? { ...common, rol: next, carnet: '', carrera: '', anio: '1' } : { ...common, rol: next, departamento: '', especialidad: '' }); setGeneral([]);
  }
  return <section className="grid gap-6">
    <div><h1 className="text-2xl font-semibold">Crear cuenta</h1><p className="mt-2 text-muted">Registro de estudiantes y tutores académicos con correo institucional.</p></div>
    <form noValidate onSubmit={onSubmit} className="grid gap-4">
      <div ref={summary} tabIndex={-1}>{general.length > 0 && <div role="alert">{general.map((message, index) => <p key={index}>{message}</p>)}</div>}</div>
      <Controller name="rol" control={control} render={({ field }) => <Select {...field} label="Rol" value={field.value} onValueChange={changeRole} options={roleOptions} required disabled={isSubmitting} error={errorFor('rol')} />} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Nombres" autoComplete="given-name" required {...register('nombres')} error={errorFor('nombres')} disabled={isSubmitting} />
        <Input label="Apellidos" autoComplete="family-name" required {...register('apellidos')} error={errorFor('apellidos')} disabled={isSubmitting} />
      </div>
      <Input label="Correo" type="email" autoComplete="email" required {...register('correo')} error={errorFor('correo')} disabled={isSubmitting} />
      <Input label="Teléfono (opcional)" type="tel" autoComplete="tel" {...register('telefono')} error={errorFor('telefono')} disabled={isSubmitting} />
      {rol === 'ESTUDIANTE' ? <>
        <Input label="Carnet" required {...register('carnet')} error={errorFor('carnet')} disabled={isSubmitting} />
        <Input label="Carrera" required {...register('carrera')} error={errorFor('carrera')} disabled={isSubmitting} />
        <Controller name="anio" control={control} render={({ field }) => <Select {...field} label="Año" value={String(field.value)} onValueChange={field.onChange} options={yearOptions} required disabled={isSubmitting} error={errorFor('anio')} />} />
      </> : <>
        <Input label="Departamento" required {...register('departamento')} error={errorFor('departamento')} disabled={isSubmitting} />
        <Input label="Especialidad (opcional)" {...register('especialidad')} error={errorFor('especialidad')} disabled={isSubmitting} />
      </>}
      <Input label="Contraseña" type="password" autoComplete="new-password" required help="Entre 8 y 72 caracteres, con al menos una letra y un dígito." {...register('contrasena')} error={errorFor('contrasena')} disabled={isSubmitting} />
      <Input label="Confirmar contraseña" type="password" autoComplete="new-password" required {...register('confirmacion')} error={errorFor('confirmacion')} disabled={isSubmitting} />
      <Button type="submit" loading={isSubmitting || registro.isPending}>Crear cuenta</Button>
    </form>
    <p>¿Ya tienes una cuenta? <Link className="text-primary underline" to="/login">Iniciar sesión</Link></p>
  </section>;
}
