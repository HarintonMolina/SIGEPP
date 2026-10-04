import { useEffect, type ReactNode } from 'react';
import { SessionContext } from '../../hooks/useSession';
import type { SessionService } from './session.types';

export function AuthProvider({ service, children }: { service: SessionService; children: ReactNode }) {
  useEffect(() => { void service.initialize(); }, [service]);
  return <SessionContext.Provider value={service}>{children}</SessionContext.Provider>;
}
