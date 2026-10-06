import { Link } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { getHomePath } from './catalog';
import { isKnownRole } from './permissions';
import { Button } from '../components/Button';

export function ErrorPage({ code }: { code: 403 | 404 | 'load' }) {
  const { snapshot } = useSession();
  const authenticated = snapshot.status === 'autenticada' && isKnownRole(snapshot.usuario.rol);
  const home = authenticated ? getHomePath(snapshot.usuario.rol) : '/login';
  const titles = { 403: '403 — Acceso denegado', 404: '404 — Página no encontrada', load: 'No pudimos cargar esta página' };
  const descriptions = {
    403: 'Tu rol no tiene acceso a esta sección.',
    404: 'La dirección solicitada no corresponde a una página disponible.',
    load: 'Hubo un problema al abrir la página. Puedes volver al inicio o intentar recargarla.',
  };
  return <main className="mx-auto flex min-h-screen max-w-[48rem] flex-col items-start justify-center gap-4 p-6">
    <h1 className="text-2xl font-bold">{titles[code]}</h1>
    <p>{descriptions[code]}</p>
    <Link className="inline-flex items-center text-primary underline" to={home}>{authenticated ? 'Volver al inicio' : 'Iniciar sesión'}</Link>
    {code === 'load' && <Button variant="secundario" onClick={() => window.location.reload()}>Recargar página</Button>}
  </main>;
}
