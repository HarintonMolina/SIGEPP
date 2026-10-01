import type { Prisma, Rol } from '@prisma/client';
import { registrarAuditoria } from '../../lib/auditoria.js';
import { errores } from '../../lib/errores.js';
import { notificar } from '../../lib/notificaciones.js';
import { saltar } from '../../lib/paginacion.js';
import { obtenerPeriodoActivo } from '../../lib/periodo.js';
import { prisma } from '../../lib/prisma.js';
import { tieneConvenioVigente } from '../organizaciones/organizaciones.service.js';
import type {
  ActualizarPlazaInput,
  CrearPlazaInput,
  ListarMisPlazasQuery,
  ListarPlazasPublicasQuery,
  ListarPlazasQuery,
} from './plazas.schema.js';

interface Actor {
  id: string;
  rol: Rol;
}

const esSupervisor = (rol: Rol) => rol === 'COORDINADOR' || rol === 'ADMIN';

const plazaSelect = {
  id: true,
  titulo: true,
  descripcion: true,
  area: true,
  modalidad: true,
  ubicacion: true,
  cupos: true,
  cuposOcupados: true,
  horario: true,
  competencias: true,
  estado: true,
  motivoRechazo: true,
  publicadaEn: true,
  creadaEn: true,
  actualizadaEn: true,
  organizacion: {
    select: { id: true, razonSocial: true, sector: true, sitioWeb: true, direccion: true },
  },
  periodo: { select: { id: true, nombre: true } },
  aprobadaPor: { select: { id: true, nombres: true, apellidos: true } },
  _count: { select: { postulaciones: true } },
} satisfies Prisma.PlazaSelect;

type PlazaDb = Prisma.PlazaGetPayload<{ select: typeof plazaSelect }>;

const serializar = ({ _count, ...plaza }: PlazaDb) => ({
  ...plaza,
  cuposDisponibles: plaza.cupos - plaza.cuposOcupados,
  totalPostulaciones: _count.postulaciones,
});

const ORDEN: Record<ListarPlazasQuery['orden'], Prisma.PlazaOrderByWithRelationInput[]> = {
  recientes: [{ publicadaEn: { sort: 'desc', nulls: 'last' } }, { creadaEn: 'desc' }],
  titulo: [{ titulo: 'asc' }],
  cupos: [{ cupos: 'desc' }, { creadaEn: 'desc' }],
};

const filtroTexto = (q?: string): Prisma.PlazaWhereInput =>
  q
    ? {
        OR: [
          { titulo: { contains: q, mode: 'insensitive' } },
          { descripcion: { contains: q, mode: 'insensitive' } },
          { area: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {};

/** Organización representada por el actor; falla si el usuario no tiene una asociada. */
const organizacionDelRepresentante = async (usuarioId: string) => {
  const org = await prisma.organizacion.findUnique({ where: { representanteId: usuarioId } });
  if (!org) throw errores.prohibido('Tu usuario no está asociado a ninguna organización');
  return org;
};

const exigirConvenio = (org: { estadoVerificacion: string; convenioVigenteHasta: Date | null }) => {
  if (!tieneConvenioVigente(org)) {
    throw errores.reglaNegocio('La organización no puede publicar plazas', [
      'RN-12: se requiere estado verificado y convenio vigente',
    ]);
  }
};

/** RF-10 y RN-04: los estudiantes y demás roles solo ven plazas aprobadas del período activo. */
export const listar = async (filtros: ListarPlazasQuery, actor: Actor) => {
  const periodo = await obtenerPeriodoActivo();
  if (!periodo) return { data: [], total: 0 };

  const supervisor = esSupervisor(actor.rol);
  const where: Prisma.PlazaWhereInput = {
    periodoId: periodo.id,
    ...(supervisor ? filtros.estado && { estado: filtros.estado } : { estado: 'APROBADA' }),
    ...(filtros.area && { area: { equals: filtros.area, mode: 'insensitive' } }),
    ...(filtros.modalidad && { modalidad: filtros.modalidad }),
    ...(filtros.ubicacion && { ubicacion: { equals: filtros.ubicacion, mode: 'insensitive' } }),
    ...(filtros.organizacionId && { organizacionId: filtros.organizacionId }),
    ...filtroTexto(filtros.q),
  };

  const [plazas, total] = await prisma.$transaction([
    prisma.plaza.findMany({
      where,
      select: plazaSelect,
      orderBy: ORDEN[filtros.orden],
      skip: saltar(filtros.page, filtros.limit),
      take: filtros.limit,
    }),
    prisma.plaza.count({ where }),
  ]);
  return { data: plazas.map(serializar), total };
};

/** Valores disponibles para el panel de filtros de la bolsa de plazas. */
export const opcionesFiltro = async () => {
  const periodo = await obtenerPeriodoActivo();
  if (!periodo) return { areas: [], ubicaciones: [], organizaciones: [] };

  const where: Prisma.PlazaWhereInput = { periodoId: periodo.id, estado: 'APROBADA' };
  const [areas, ubicaciones, organizaciones] = await Promise.all([
    prisma.plaza.findMany({
      where,
      distinct: ['area'],
      select: { area: true },
      orderBy: { area: 'asc' },
    }),
    prisma.plaza.findMany({
      where,
      distinct: ['ubicacion'],
      select: { ubicacion: true },
      orderBy: { ubicacion: 'asc' },
    }),
    prisma.organizacion.findMany({
      where: { plazas: { some: where } },
      select: { id: true, razonSocial: true },
      orderBy: { razonSocial: 'asc' },
    }),
  ]);

  return {
    areas: areas.map((p) => p.area),
    ubicaciones: ubicaciones.map((p) => p.ubicacion),
    organizaciones,
  };
};

export const listarMias = async ({ estado, page, limit }: ListarMisPlazasQuery, actor: Actor) => {
  const org = await organizacionDelRepresentante(actor.id);
  const where: Prisma.PlazaWhereInput = { organizacionId: org.id, ...(estado && { estado }) };

  const [plazas, total] = await prisma.$transaction([
    prisma.plaza.findMany({
      where,
      select: plazaSelect,
      orderBy: { creadaEn: 'desc' },
      skip: saltar(page, limit),
      take: limit,
    }),
    prisma.plaza.count({ where }),
  ]);
  return { data: plazas.map(serializar), total };
};

/**
 * Detalle de una plaza. Una plaza no aprobada solo la ven la coordinación, la administración
 * y la propia organización; para cualquier otro usuario responde 404 (RN-04, anti-IDOR).
 */
export const obtener = async (id: string, actor: Actor) => {
  const plaza = await prisma.plaza.findUnique({
    where: { id },
    select: {
      ...plazaSelect,
      organizacionId: true,
      periodo: { select: { id: true, nombre: true, activo: true } },
    },
  });
  if (!plaza) throw errores.noEncontrado('Plaza');

  const publica = plaza.estado === 'APROBADA' && plaza.periodo.activo;
  if (!publica && !esSupervisor(actor.rol)) {
    const org = await prisma.organizacion.findUnique({ where: { id: plaza.organizacionId } });
    const esPropia =
      org?.representanteId === actor.id ||
      (actor.rol === 'TUTOR_EMPRESARIAL' &&
        (await prisma.tutorEmpresarial.count({
          where: { usuarioId: actor.id, organizacionId: plaza.organizacionId },
        })) > 0);
    if (!esPropia) throw errores.noEncontrado('Plaza');
  }

  const { organizacionId, periodo, ...resto } = plaza;
  return serializar({ ...resto, periodo: { id: periodo.id, nombre: periodo.nombre } });
};

/** RF-08 */
export const crear = async (datos: CrearPlazaInput, actor: Actor) => {
  const { organizacionId, ...campos } = datos;

  let org;
  if (actor.rol === 'ADMIN') {
    if (!organizacionId)
      throw errores.validacion(['organizacionId: es obligatorio para el administrador']);
    org = await prisma.organizacion.findUnique({ where: { id: organizacionId } });
    if (!org) throw errores.noEncontrado('Organización');
  } else {
    org = await organizacionDelRepresentante(actor.id);
  }
  exigirConvenio(org);

  const periodo = await obtenerPeriodoActivo();
  if (!periodo)
    throw errores.reglaNegocio('No hay un período académico activo para publicar plazas');

  const plaza = await prisma.plaza.create({
    data: { ...campos, organizacionId: org.id, periodoId: periodo.id, estado: 'EN_REVISION' },
    select: plazaSelect,
  });
  return serializar(plaza);
};

/** La organización corrige una plaza en revisión o rechazada; vuelve a quedar EN_REVISION. */
export const actualizar = async (id: string, datos: ActualizarPlazaInput, actor: Actor) => {
  const plaza = await prisma.plaza.findUnique({ where: { id }, include: { organizacion: true } });
  const esPropia =
    plaza && (actor.rol === 'ADMIN' || plaza.organizacion.representanteId === actor.id);
  if (!plaza || !esPropia) throw errores.noEncontrado('Plaza');

  if (plaza.estado !== 'EN_REVISION' && plaza.estado !== 'RECHAZADA') {
    throw errores.conflicto('Solo se pueden editar plazas en revisión o rechazadas', [
      `Estado actual: ${plaza.estado}`,
    ]);
  }
  exigirConvenio(plaza.organizacion);

  const actualizada = await prisma.plaza.update({
    where: { id },
    data: { ...datos, estado: 'EN_REVISION', motivoRechazo: null },
    select: plazaSelect,
  });
  return serializar(actualizada);
};

const resolverRevision = async (
  id: string,
  decision: 'APROBADA' | 'RECHAZADA',
  actor: Actor,
  ip?: string,
  motivo?: string,
) => {
  const plaza = await prisma.plaza.findUnique({ where: { id }, include: { organizacion: true } });
  if (!plaza) throw errores.noEncontrado('Plaza');
  if (plaza.estado !== 'EN_REVISION') {
    throw errores.conflicto('La plaza ya fue revisada', [`Estado actual: ${plaza.estado}`]);
  }
  if (decision === 'APROBADA') exigirConvenio(plaza.organizacion);

  return prisma.$transaction(async (tx) => {
    const actualizada = await tx.plaza.update({
      where: { id },
      data:
        decision === 'APROBADA'
          ? {
              estado: 'APROBADA',
              aprobadaPorId: actor.id,
              publicadaEn: new Date(),
              motivoRechazo: null,
            }
          : { estado: 'RECHAZADA', motivoRechazo: motivo },
      select: plazaSelect,
    });

    await registrarAuditoria(
      {
        usuarioId: actor.id,
        entidad: 'Plaza',
        entidadId: id,
        accion: decision === 'APROBADA' ? 'APROBAR' : 'RECHAZAR',
        valoresAnteriores: { estado: plaza.estado },
        valoresNuevos: { estado: decision, ...(motivo && { motivoRechazo: motivo }) },
        ip,
      },
      tx,
    );

    await notificar(
      plaza.organizacion.representanteId,
      decision === 'APROBADA'
        ? {
            tipo: 'PLAZA_APROBADA',
            titulo: 'Plaza aprobada',
            mensaje: `La plaza "${plaza.titulo}" fue aprobada y ya es visible para los estudiantes.`,
            enlace: `/plazas/${id}`,
          }
        : {
            tipo: 'PLAZA_RECHAZADA',
            titulo: 'Plaza rechazada',
            mensaje: `La plaza "${plaza.titulo}" fue rechazada: ${motivo}`,
            enlace: `/org/plazas/${id}`,
          },
      tx,
    );

    return serializar(actualizada);
  });
};

/** RF-09 y RN-04 */
export const aprobar = (id: string, actor: Actor, ip?: string) =>
  resolverRevision(id, 'APROBADA', actor, ip);

export const rechazar = (id: string, motivo: string, actor: Actor, ip?: string) =>
  resolverRevision(id, 'RECHAZADA', actor, ip, motivo);

/** RF-26: plazas vigentes para consumo externo, sin datos internos. */
export const listarPublicas = async ({
  q,
  area,
  modalidad,
  page,
  limit,
}: ListarPlazasPublicasQuery) => {
  const periodo = await obtenerPeriodoActivo();
  if (!periodo) return { data: [], total: 0 };

  const where: Prisma.PlazaWhereInput = {
    periodoId: periodo.id,
    estado: 'APROBADA',
    ...(area && { area: { equals: area, mode: 'insensitive' } }),
    ...(modalidad && { modalidad }),
    ...filtroTexto(q),
  };

  const [plazas, total] = await prisma.$transaction([
    prisma.plaza.findMany({
      where,
      select: {
        id: true,
        titulo: true,
        descripcion: true,
        area: true,
        modalidad: true,
        ubicacion: true,
        cupos: true,
        cuposOcupados: true,
        horario: true,
        competencias: true,
        publicadaEn: true,
        organizacion: { select: { razonSocial: true, sector: true, sitioWeb: true } },
      },
      orderBy: ORDEN.recientes,
      skip: saltar(page, limit),
      take: limit,
    }),
    prisma.plaza.count({ where }),
  ]);

  const data = plazas.map(({ cupos, cuposOcupados, ...plaza }) => ({
    ...plaza,
    cuposDisponibles: cupos - cuposOcupados,
    periodo: periodo.nombre,
  }));
  return { data, total };
};
