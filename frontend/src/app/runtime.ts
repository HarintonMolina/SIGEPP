import { createHttpClient, type HttpClient } from '../api/client';
import { createQueryClient } from '../api/query-client';
import { createTransport } from '../api/transport';
import { env, type FrontendEnv } from '../config/env';
import { createAuthApi, type AuthApi } from '../features/auth/auth-api';
import { createLogoutStore } from '../features/auth/logout-store';
import { createSessionService } from '../features/auth/session';
import type { SessionService } from '../features/auth/session.types';
import type { QueryClient } from '@tanstack/react-query';

export type AppRuntime = {
  authApi: AuthApi;
  session: SessionService;
  http: HttpClient;
  queryClient: QueryClient;
};

export function createRuntime(options: {
  env: FrontendEnv;
  fetchImpl?: typeof fetch;
  storage?: Parameters<typeof createLogoutStore>[0];
}): AppRuntime {
  const queryClient = createQueryClient();
  const transport = createTransport(options.env, options.fetchImpl);
  const authApi = createAuthApi(transport);
  const session = createSessionService({
    // LogoutStore reads the sessionStorage property inside try/catch too: its getter can throw.
    api: authApi, logoutStore: createLogoutStore(options.storage),
    onInvalidate: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
    },
  });
  return { authApi, session, http: createHttpClient(transport, session), queryClient };
}

export const runtime = createRuntime({ env });
