import { useSession } from '../../hooks/useSession';

export default function InicioPage() {
  const { snapshot } = useSession();
  if (snapshot.status !== 'autenticada') return null;
  const { usuario } = snapshot;
  return <section className="rounded-card border border-border bg-surface p-4 sm:p-6">
    <h2 className="break-words text-xl font-semibold">Bienvenido, {usuario.nombres} {usuario.apellidos}</h2>
    <p className="mt-3 break-words">{usuario.correo}</p>
    <p className="mt-2">Rol: {usuario.rol}</p>
    <p className="mt-2">Estado de cuenta: {usuario.estado}</p>
    <p className="mt-2 text-muted">Usa la navegación para consultar las secciones disponibles.</p>
  </section>;
}
