import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
import { canAccess, getHomePath, type RouteId } from './catalog';
import { getKnownPrivateReturnTo, getSafeReturnTo } from './return-to';
import { ErrorPage } from './ErrorPage';
import { isKnownRole } from './permissions';

export function SessionRecovery() {
  const { snapshot, service } = useSession();
  return <main className="mx-auto grid max-w-[48rem] gap-4 p-6">
    <h1 className="text-xl font-semibold">No pudimos restaurar tu sesión</h1>
    <ErrorState message={snapshot.error?.message ?? 'Revisa tu conexión e inténtalo de nuevo.'} onRetry={() => { void service.retryRestore(); }} />
    <Link className="inline-flex items-center text-primary underline" to="/login">Iniciar sesión</Link>
  </main>;
}

export function ProtectedRoute({ routeId }: { routeId: RouteId }) {
  const { snapshot } = useSession();
  const location = useLocation();
  const returnTo = getKnownPrivateReturnTo(location.pathname + location.search);
  if (!returnTo) return <ErrorPage code={404} />;
  if (snapshot.status === 'restaurando') return <LoadingState label="Restaurando sesión…" />;
  if (snapshot.status === 'errorRecuperable') return <SessionRecovery />;
  if (snapshot.status !== 'autenticada') return <Navigate to="/login" replace state={{ returnTo }} />;
  if (!canAccess(routeId, snapshot.usuario.rol)) return <ErrorPage code={403} />;
  return <Outlet />;
}

export function SessionDestination({ root = false }: { root?: boolean }) {
  const { snapshot } = useSession();
  const location = useLocation();
  if (snapshot.status === 'restaurando') return <LoadingState label="Restaurando sesión…" />;
  if (snapshot.status === 'autenticada') {
    if (!isKnownRole(snapshot.usuario.rol)) return <ErrorPage code={403} />;
    const state: unknown = location.state;
    const returnTo = typeof state === 'object' && state !== null && 'returnTo' in state
      ? state.returnTo : new URLSearchParams(location.search).get('returnTo');
    return <Navigate to={root ? getHomePath(snapshot.usuario.rol) : getSafeReturnTo(returnTo, snapshot.usuario.rol)} replace />;
  }
  if (root && snapshot.status === 'errorRecuperable') return <SessionRecovery />;
  return root ? <Navigate to="/login" replace /> : <Outlet />;
}
