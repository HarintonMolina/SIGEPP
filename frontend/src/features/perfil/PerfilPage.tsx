import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { useSession } from '../../hooks/useSession';
import { usePerfil } from './usePerfil';

type Detail = readonly [string, string | number | null | undefined];
function Details({ title, values }: { title: string; values: readonly Detail[] }) {
  return <section className="rounded-card border border-border bg-surface p-4 sm:p-6">
    <h2 className="mb-4 text-xl font-semibold">{title}</h2>
    <dl className="grid gap-4 sm:grid-cols-2">{values.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-sm text-muted">{label}</dt><dd className="mt-1 break-words">{value === null || value === undefined || value === '' ? 'No disponible' : value}</dd></div>)}</dl>
  </section>;
}
export default function PerfilPage() {
  const { snapshot } = useSession(); const perfil = usePerfil();
  if (snapshot.status !== 'autenticada') return null;
  if (perfil.isPending) return <LoadingState label="Cargando perfil…" />;
  if (perfil.isError) return perfil.error.kind === 'stale-session' ? null : <ErrorState message={perfil.error.message} onRetry={() => { void perfil.refetch(); }} />;
  const usuario = perfil.data;
  return <div className="grid gap-6">
    <Details title="Datos personales" values={[
      ['Nombres', usuario.nombres], ['Apellidos', usuario.apellidos], ['Correo', usuario.correo],
      ['Rol', usuario.rol], ['Estado', usuario.estado], ['Teléfono', usuario.telefono], ['Fecha de registro', usuario.creadoEn],
    ]} />
    <Details title="Perfil de estudiante" values={[
      ['Carnet', usuario.estudiante?.carnet], ['Carrera', usuario.estudiante?.carrera], ['Año', usuario.estudiante?.anio],
      ['Porcentaje de avance', usuario.estudiante ? `${usuario.estudiante.porcentajeAvance}%` : null],
      ['Avance verificado', usuario.estudiante ? (usuario.estudiante.avanceVerificado ? 'Sí' : 'No') : null],
    ]} />
    <Details title="Perfil de tutor académico" values={[
      ['Departamento', usuario.docente?.departamento], ['Especialidad', usuario.docente?.especialidad],
    ]} />
    <Details title="Perfil de tutor empresarial" values={[
      ['Cargo', usuario.tutorEmpresarial?.cargo], ['Organización vinculada', usuario.tutorEmpresarial?.organizacionId],
    ]} />
    <Details title="Perfil de organización" values={[
      ['Razón social', usuario.organizacion?.razonSocial], ['Estado de verificación', usuario.organizacion?.estadoVerificacion],
    ]} />
  </div>;
}
