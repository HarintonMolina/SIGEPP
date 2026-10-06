import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { useSession } from '../../hooks/useSession';
import { getSafeReturnTo } from '../../routes/return-to';
import { isCurrentAuthOperation, useLogin, useLogout } from './auth-hooks';
import { loginFormSchema } from './schemas';
import { splitFormErrors } from './form-errors';
import type { LoginInput } from './contracts';

const fields = ['correo', 'contrasena'] as const;
export default function LoginPage() {
  const { snapshot, service } = useSession();
  const login = useLogin(); const logout = useLogout();
  const navigate = useNavigate(); const location = useLocation();
  const state: unknown = location.state;
  const prefill = typeof state === 'object' && state !== null && 'correo' in state && typeof state.correo === 'string' ? state.correo : '';
  const returnTo = typeof state === 'object' && state !== null && 'returnTo' in state ? state.returnTo : new URLSearchParams(location.search).get('returnTo');
  const { register, handleSubmit, setError, setFocus, formState: { errors, isSubmitting } } = useForm<LoginInput>({ resolver: zodResolver(loginFormSchema), defaultValues: { correo: prefill, contrasena: '' } });
  const [general, setGeneral] = useState<string[]>([]);
  const summary = useRef<HTMLDivElement>(null); const submitting = useRef(false);
  const focusAfterSubmit = useRef<{ field: typeof fields[number]; operation: unknown } | null>(null);
  useEffect(() => {
    if (isSubmitting || !focusAfterSubmit.current) return;
    const { field, operation } = focusAfterSubmit.current; focusAfterSubmit.current = null;
    if (isCurrentAuthOperation(service, operation)) setFocus(field);
  }, [isSubmitting, service, setFocus]);
  const submit = async (values: LoginInput) => {
    setGeneral([]);
    await login.mutateAsync(values, {
      onSuccess(_data, _input, operation) {
        if (!isCurrentAuthOperation(service, operation)) return;
        const current = service.getSnapshot();
        if (current.status === 'autenticada') navigate(getSafeReturnTo(returnTo, current.usuario.rol), { replace: true });
      },
      onError(error, _input, operation) {
        if (!isCurrentAuthOperation(service, operation, error)) return;
        const split = splitFormErrors(error, fields); setGeneral(split.general);
        const first = fields.find((field) => split.fields[field]);
        for (const field of fields) if (split.fields[field]) setError(field, { type: 'server', message: split.fields[field] });
        if (first) focusAfterSubmit.current = { field: first, operation };
        if (!first) summary.current?.focus();
      },
    }).catch(() => undefined);
  };
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (submitting.current) return;
    submitting.current = true; void handleSubmit(submit)(event).finally(() => { submitting.current = false; });
  }
  return <section className="grid gap-6">
    <div><h1 className="text-2xl font-semibold">Iniciar sesión</h1><p className="mt-2 text-muted">Accede a SIGEPP con tu cuenta.</p></div>
    {snapshot.logoutPending && <aside className="grid gap-3 rounded-card border border-warning p-4" aria-label="Cierre de sesión pendiente">
      <p>El cierre de sesión remoto está pendiente. Reintenta para completar el cierre.</p>
      {!snapshot.logoutPersistenceAvailable && <p>No se pudo persistir el cierre pendiente en el almacenamiento de esta pestaña.</p>}
      {snapshot.error && <p role="alert">{snapshot.error.message}</p>}
      <Button variant="secundario" loading={logout.isPending} onClick={() => logout.mutate()}>Reintentar cierre de sesión</Button>
    </aside>}
    {snapshot.status === 'errorRecuperable' && <aside className="grid gap-3"><p role="alert">{snapshot.error?.message ?? 'No pudimos restaurar tu sesión.'}</p><Button variant="secundario" onClick={() => { void service.retryRestore(); }}>Reintentar restauración</Button></aside>}
    <form noValidate onSubmit={onSubmit} className="grid gap-4">
      <div ref={summary} tabIndex={-1}>{general.length > 0 && <div role="alert">{general.map((message, index) => <p key={index}>{message}</p>)}</div>}</div>
      <Input label="Correo" type="email" autoComplete="email" required {...register('correo')} error={errors.correo?.message} disabled={isSubmitting} />
      <Input label="Contraseña" type="password" autoComplete="current-password" required {...register('contrasena')} error={errors.contrasena?.message} disabled={isSubmitting} />
      <Button type="submit" loading={isSubmitting || login.isPending}>Iniciar sesión</Button>
    </form>
    <p>¿Aún no tienes una cuenta? <Link className="text-primary underline" to="/registro">Crear cuenta</Link></p>
  </section>;
}
