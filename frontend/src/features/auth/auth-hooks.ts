import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import type { ApiError } from '../../api/errors';
import { ApiError as AuthError } from '../../api/errors';
import { useRef } from 'react';
import { useRuntime } from '../../hooks/useRuntime';
import type { LoginInput, RegistroInput, Usuario } from './contracts';
import type { SessionService } from './session.types';

type AuthOperation = { session: SessionService; generation: number };
const stale = () => new AuthError({ kind: 'stale-session', codigo: 'SESION_OBSOLETA', mensaje: 'La sesión cambió. Vuelve a iniciar la operación.' });

// The mutation context belongs to one invocation, even if a caller reuses its input object.
export function isCurrentAuthOperation(session: SessionService, operation: unknown, error?: ApiError | null): boolean {
  return error?.kind !== 'stale-session' && typeof operation === 'object' && operation !== null
    && 'session' in operation && operation.session === session
    && 'generation' in operation && operation.generation === session.getSnapshot().generation;
}

export function useLogin(): UseMutationResult<void, ApiError, LoginInput> {
  const { session } = useRuntime();
  const pending = useRef(new WeakMap<LoginInput, AuthOperation[]>());
  return useMutation<void, ApiError, LoginInput, unknown>({
    onMutate(input) {
      const operation = { session, generation: session.getSnapshot().generation };
      const queue = pending.current.get(input) ?? [];
      queue.push(operation); pending.current.set(input, queue);
      return operation;
    },
    async mutationFn(input) {
      const operation = pending.current.get(input)!.shift()!;
      const login = session.login(input);
      operation.generation = session.getSnapshot().generation;
      try { await login; } catch (error) {
        if (!isCurrentAuthOperation(session, operation)) throw stale();
        throw error;
      }
      if (!isCurrentAuthOperation(session, operation)) throw stale();
    },
    retry: false,
  });
}

export function useRegistro(): UseMutationResult<Usuario, ApiError, RegistroInput> {
  const { session, authApi } = useRuntime();
  const pending = useRef(new WeakMap<RegistroInput, AuthOperation[]>());
  return useMutation<Usuario, ApiError, RegistroInput, unknown>({
    onMutate(input) {
      const operation = { session, generation: session.getSnapshot().generation };
      const queue = pending.current.get(input) ?? [];
      queue.push(operation); pending.current.set(input, queue);
      return operation;
    },
    async mutationFn(input) {
      const operation = pending.current.get(input)!.shift()!;
      try {
        const usuario = await authApi.registro(input);
        if (!isCurrentAuthOperation(session, operation)) throw stale();
        return usuario;
      } catch (error) {
        if (!isCurrentAuthOperation(session, operation)) throw stale();
        throw error;
      }
    },
    retry: false,
  });
}

export function useLogout(): UseMutationResult<void, ApiError, void> {
  const { session } = useRuntime();
  return useMutation({ mutationFn: () => session.logout(), retry: false });
}
