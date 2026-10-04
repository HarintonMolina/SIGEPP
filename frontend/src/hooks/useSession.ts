import { createContext, useContext, useSyncExternalStore } from 'react';
import type { SessionService, SessionSnapshot } from '../features/auth/session.types';

export const SessionContext = createContext<SessionService | null>(null);

export function useSession(): { snapshot: SessionSnapshot; service: SessionService } {
  const service = useContext(SessionContext);
  if (!service) throw new Error('useSession requiere AuthProvider.');
  const snapshot = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
  return { snapshot, service };
}
