import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { ApiError } from '../../api/errors';
import { useRuntime } from '../../hooks/useRuntime';
import { useSession } from '../../hooks/useSession';
import { usuarioResponseSchema, type Usuario } from '../auth/contracts';

export function usePerfil(): UseQueryResult<Usuario, ApiError> {
  const { http } = useRuntime(); const { snapshot } = useSession();
  return useQuery({
    queryKey: ['privada', snapshot.generation, snapshot.usuario?.id ?? null, 'perfil'],
    enabled: snapshot.status === 'autenticada',
    async queryFn({ signal }) {
      const data = await http.request<unknown>('/auth/yo', { signal });
      const result = usuarioResponseSchema.safeParse(data);
      if (!result.success) throw new ApiError({ kind: 'invalid-response', codigo: 'RESPUESTA_INVALIDA', mensaje: 'El servidor devolvió una respuesta de perfil no válida.' });
      return result.data.usuario;
    },
    retry: false,
  });
}
