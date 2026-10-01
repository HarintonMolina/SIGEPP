import type { Prisma, Rol } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { registrarAuditoria } from '../../lib/auditoria.js';
import { errores } from '../../lib/errores.js';
import { notificar } from '../../lib/notificaciones.js';
import { saltar } from '../../lib/paginacion.js';
import { prisma } from '../../lib/prisma.js';
import type {
  CrearTutorInput,
  ListarOrganizacionesQuery,
  RegistroOrganizacionInput,
  VerificarOrganizacionInput,
} from './organizaciones.schema.js';

interface Actor {
  id: string;
  rol: Rol;
}

const usuarioBasico = {
  select: { id: true, nombres: true, apellidos: true, correo: true, telefono: true },
};

const organizacionSelect = {
  id: true,
  razonSocial: true,
  ruc: true,
  sector: true,
  direccion: true,
  sitioWeb: true,
  estadoVerificacion: true,
  convenioVigenteHasta: true,
  creadaEn: true,
  representante: usuarioBasico,
  _count: { select: { plazas: true, tutoresEmpresariales: true } },
} satisfies Prisma.OrganizacionSelect;

const tutorSelect = {
  id: true,
  cargo: true,
  activo: true,
  usuario: { select: { ...usuarioBasico.select, estado: true } },
} satisfies Prisma.TutorEmpresarialSelect;

/** Una organización tiene convenio vigente si está verificada y el convenio no ha vencido (RN-12). */
export const tieneConvenioVigente = (org: {
  estadoVerificacion: string;
  convenioVigenteHasta: Date | null;
}) =>
  org.estadoVerificacion === 'VERIFICADA' &&
  !!org.convenioVigenteHasta &&
  org.convenioVigenteHasta >= new Date();

const asegurarCorreoDisponible = async (correo: string) => {
  if (await prisma.usuario.findUnique({ where: { correo } })) {
    throw errores.conflicto('Ya existe una cuenta con ese correo');
  }
};

/**
 * Comprueba que el actor pueda acceder a la organización. Si no puede se responde 404
 * en lugar de 403 para no revelar qué identificadores existen (protección contra IDOR).
 */
const obtenerConAcceso = async (id: string, actor: Actor, { soloEscritura = false } = {}) => {
  const org = await prisma.organizacion.findUnique({
    where: { id },
    select: { id: true, representanteId: true },
  });
  if (!org) throw errores.noEncontrado('Organización');

  const esRepresentante = actor.rol === 'ORGANIZACION' && org.representanteId === actor.id;
  const esSupervisor = actor.rol === 'ADMIN' || (!soloEscritura && actor.rol === 'COORDINADOR');
  if (!esRepresentante && !esSupervisor) throw errores.noEncontrado('Organización');

  return org;
};

/** RF-05 */
export const registrar = async (datos: RegistroOrganizacionInput) => {
  await asegurarCorreoDisponible(datos.representante.correo);
  if (await prisma.organizacion.findUnique({ where: { ruc: datos.ruc } })) {
    throw errores.conflicto('Ya existe una organización registrada con ese RUC');
  }

  const { contrasena, ...representante } = datos.representante;
  const hashContrasena = await bcrypt.hash(contrasena, env.BCRYPT_COST);

  return prisma.organizacion.create({
    data: {
      razonSocial: datos.razonSocial,
      ruc: datos.ruc,
      sector: datos.sector,
      direccion: datos.direccion,
      sitioWeb: datos.sitioWeb,
      representante: { create: { ...representante, hashContrasena, rol: 'ORGANIZACION' } },
    },
    select: organizacionSelect,
  });
};

export const listar = async ({ estado, q, page, limit }: ListarOrganizacionesQuery) => {
  const where: Prisma.OrganizacionWhereInput = {
    ...(estado && { estadoVerificacion: estado }),
    ...(q && {
      OR: [
        { razonSocial: { contains: q, mode: 'insensitive' } },
        { ruc: { contains: q.toUpperCase() } },
      ],
    }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.organizacion.findMany({
      where,
      select: organizacionSelect,
      orderBy: { creadaEn: 'desc' },
      skip: saltar(page, limit),
      take: limit,
    }),
    prisma.organizacion.count({ where }),
  ]);
  return { data, total };
};

export const obtener = async (id: string, actor: Actor) => {
  await obtenerConAcceso(id, actor);
  return prisma.organizacion.findUniqueOrThrow({
    where: { id },
    select: {
      ...organizacionSelect,
      tutoresEmpresariales: { select: tutorSelect, orderBy: { usuario: { apellidos: 'asc' } } },
    },
  });
};

export const obtenerMia = async (actor: Actor) => {
  const org = await prisma.organizacion.findUnique({
    where: { representanteId: actor.id },
    select: { id: true },
  });
  if (!org) throw errores.noEncontrado('Organización');
  return obtener(org.id, actor);
};

/** RF-06 */
export const verificar = async (
  id: string,
  datos: VerificarOrganizacionInput,
  actor: Actor,
  ip?: string,
) => {
  const anterior = await prisma.organizacion.findUnique({ where: { id } });
  if (!anterior) throw errores.noEncontrado('Organización');

  return prisma.$transaction(async (tx) => {
    const org = await tx.organizacion.update({
      where: { id },
      data: {
        estadoVerificacion: datos.estado,
        convenioVigenteHasta:
          datos.estado === 'VERIFICADA'
            ? datos.convenioVigenteHasta
            : anterior.convenioVigenteHasta,
      },
      select: organizacionSelect,
    });

    await registrarAuditoria(
      {
        usuarioId: actor.id,
        entidad: 'Organizacion',
        entidadId: id,
        accion: datos.estado === 'VERIFICADA' ? 'VERIFICAR' : 'RECHAZAR',
        valoresAnteriores: {
          estadoVerificacion: anterior.estadoVerificacion,
          convenioVigenteHasta: anterior.convenioVigenteHasta?.toISOString() ?? null,
        },
        valoresNuevos: {
          estadoVerificacion: org.estadoVerificacion,
          convenioVigenteHasta: org.convenioVigenteHasta?.toISOString() ?? null,
        },
        ip,
      },
      tx,
    );

    await notificar(
      anterior.representanteId,
      datos.estado === 'VERIFICADA'
        ? {
            tipo: 'ORGANIZACION_VERIFICADA',
            titulo: 'Organización verificada',
            mensaje: 'La coordinación verificó tu organización. Ya puedes publicar plazas.',
            enlace: '/org/plazas/nueva',
          }
        : {
            tipo: 'ORGANIZACION_RECHAZADA',
            titulo: 'Verificación rechazada',
            mensaje:
              'La coordinación no aprobó la verificación de tu organización. Contáctala para más detalles.',
          },
      tx,
    );

    return org;
  });
};

export const listarTutores = async (organizacionId: string, actor: Actor) => {
  await obtenerConAcceso(organizacionId, actor);
  return prisma.tutorEmpresarial.findMany({
    where: { organizacionId },
    select: tutorSelect,
    orderBy: [{ activo: 'desc' }, { usuario: { apellidos: 'asc' } }],
  });
};

/** RF-07: alta de tutor empresarial. */
export const crearTutor = async (organizacionId: string, datos: CrearTutorInput, actor: Actor) => {
  await obtenerConAcceso(organizacionId, actor, { soloEscritura: true });
  await asegurarCorreoDisponible(datos.correo);

  const { contrasena, cargo, ...personales } = datos;
  const hashContrasena = await bcrypt.hash(contrasena, env.BCRYPT_COST);

  return prisma.tutorEmpresarial.create({
    data: {
      cargo,
      organizacion: { connect: { id: organizacionId } },
      usuario: { create: { ...personales, hashContrasena, rol: 'TUTOR_EMPRESARIAL' } },
    },
    select: tutorSelect,
  });
};

/** RF-07: baja (o reactivación) de un tutor empresarial. */
export const actualizarTutor = async (
  organizacionId: string,
  tutorId: string,
  { activo }: { activo: boolean },
  actor: Actor,
  ip?: string,
) => {
  await obtenerConAcceso(organizacionId, actor, { soloEscritura: true });

  const tutor = await prisma.tutorEmpresarial.findFirst({ where: { id: tutorId, organizacionId } });
  if (!tutor) throw errores.noEncontrado('Tutor empresarial');

  if (!activo) {
    const asignacionesActivas = await prisma.asignacion.count({
      where: {
        tutorEmpresarialId: tutorId,
        estado: { in: ['ASIGNADA', 'EN_CURSO'] },
        eliminadaEn: null,
      },
    });
    if (asignacionesActivas > 0) {
      throw errores.conflicto('No se puede dar de baja a un tutor con estudiantes asignados', [
        `El tutor tiene ${asignacionesActivas} asignación(es) activa(s)`,
      ]);
    }
  }

  return prisma.$transaction(async (tx) => {
    const actualizado = await tx.tutorEmpresarial.update({
      where: { id: tutorId },
      data: { activo, usuario: { update: { estado: activo ? 'ACTIVO' : 'INACTIVO' } } },
      select: tutorSelect,
    });
    // Al dar de baja se cierran todas las sesiones abiertas del tutor.
    if (!activo) {
      await tx.refreshToken.updateMany({
        where: { usuarioId: tutor.usuarioId, revocadoEn: null },
        data: { revocadoEn: new Date() },
      });
    }
    await registrarAuditoria(
      {
        usuarioId: actor.id,
        entidad: 'TutorEmpresarial',
        entidadId: tutorId,
        accion: activo ? 'REACTIVAR' : 'DAR_DE_BAJA',
        valoresAnteriores: { activo: tutor.activo },
        valoresNuevos: { activo },
        ip,
      },
      tx,
    );
    return actualizado;
  });
};
