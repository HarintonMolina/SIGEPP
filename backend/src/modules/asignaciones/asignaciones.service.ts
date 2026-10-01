import type { Prisma, Rol } from '@prisma/client';
import { registrarAuditoria } from '../../lib/auditoria.js';
import { errores } from '../../lib/errores.js';
import { notificar } from '../../lib/notificaciones.js';
import { saltar } from '../../lib/paginacion.js';
import { obtenerPeriodoActivo } from '../../lib/periodo.js';
import { prisma } from '../../lib/prisma.js';
import type { CrearAsignacionInput, ListarAsignacionesQuery } from './asignaciones.schema.js';

interface Actor {
  id: string;
  rol: Rol;
}

/** Papel que cumple el usuario dentro de una asignación concreta. */
export type ParteAsignacion = 'ESTUDIANTE' | 'TUTOR_ACADEMICO' | 'TUTOR_EMPRESARIAL' | 'SUPERVISOR';

export const ESTADOS_ACTIVOS = ['ASIGNADA', 'EN_CURSO'] as const;

const personaSelect = {
  select: { id: true, nombres: true, apellidos: true, correo: true, telefono: true },
};

const asignacionSelect = {
  id: true,
  estado: true,
  fechaInicio: true,
  fechaFin: true,
  horasAcumuladas: true,
  notaFinal: true,
  creadaEn: true,
  estudiante: {
    select: { id: true, carnet: true, carrera: true, usuarioId: true, usuario: personaSelect },
  },
  plaza: {
    select: {
      id: true,
      titulo: true,
      area: true,
      modalidad: true,
      ubicacion: true,
      horario: true,
      organizacion: { select: { id: true, razonSocial: true } },
    },
  },
  docente: { select: { id: true, departamento: true, usuarioId: true, usuario: personaSelect } },
  tutorEmpresarial: { select: { id: true, cargo: true, usuarioId: true, usuario: personaSelect } },
  periodo: { select: { id: true, nombre: true, horasMinimas: true } },
  planTrabajo: {
    select: {
      id: true,
      version: true,
      estado: true,
      horasPrevistas: true,
      aprobadoDocenteEn: true,
      aprobadoEmpresaEn: true,
    },
  },
  _count: { select: { bitacoras: true, evaluaciones: true } },
} satisfies Prisma.AsignacionSelect;

type AsignacionDb = Prisma.AsignacionGetPayload<{ select: typeof asignacionSelect }>;

const parteDe = (asignacion: AsignacionDb, actor: Actor): ParteAsignacion | null => {
  if (actor.rol === 'COORDINADOR' || actor.rol === 'ADMIN') return 'SUPERVISOR';
  if (asignacion.estudiante.usuarioId === actor.id) return 'ESTUDIANTE';
  if (asignacion.docente.usuarioId === actor.id) return 'TUTOR_ACADEMICO';
  if (asignacion.tutorEmpresarial.usuarioId === actor.id) return 'TUTOR_EMPRESARIAL';
  return null;
};

/**
 * Línea de tiempo del trámite (RF-24) con los seis hitos del expediente.
 * Cada hito está COMPLETADO, EN_CURSO o PENDIENTE.
 */
const calcularHitos = (a: AsignacionDb) => {
  const planAprobado = a.planTrabajo?.estado === 'APROBADO';
  const horasCumplidas = a.horasAcumuladas >= a.periodo.horasMinimas;
  const evaluado = a._count.evaluaciones >= 2;
  const finalizada = a.estado === 'FINALIZADA';

  const estado = (completado: boolean, enCurso: boolean) =>
    completado ? 'COMPLETADO' : enCurso ? 'EN_CURSO' : 'PENDIENTE';

  return [
    { clave: 'POSTULACION', titulo: 'Postulación aceptada', estado: 'COMPLETADO' },
    { clave: 'ASIGNACION', titulo: 'Asignación y tutores', estado: 'COMPLETADO' },
    { clave: 'PLAN', titulo: 'Plan de trabajo aprobado', estado: estado(planAprobado, true) },
    {
      clave: 'BITACORAS',
      titulo: 'Bitácoras y horas',
      estado: estado(horasCumplidas, planAprobado),
    },
    {
      clave: 'EVALUACION',
      titulo: 'Evaluación de tutores',
      estado: estado(evaluado, horasCumplidas),
    },
    { clave: 'ACTA', titulo: 'Acta de aprobación', estado: estado(finalizada, evaluado) },
  ];
};

const serializar = (a: AsignacionDb, parte?: ParteAsignacion) => {
  const { _count, ...resto } = a;
  return {
    ...resto,
    totalBitacoras: _count.bitacoras,
    progreso: {
      horasAcumuladas: a.horasAcumuladas,
      horasMinimas: a.periodo.horasMinimas,
      porcentaje: Math.min(100, Math.round((a.horasAcumuladas / a.periodo.horasMinimas) * 100)),
    },
    hitos: calcularHitos(a),
    ...(parte && { miRol: parte }),
  };
};

/**
 * Devuelve la asignación si el actor es parte de ella (estudiante, alguno de sus tutores)
 * o la supervisa; en cualquier otro caso responde 404 (protección contra IDOR).
 * Lo usan también los módulos de plan de trabajo y bitácoras.
 */
export const obtenerConAcceso = async (id: string, actor: Actor) => {
  const asignacion = await prisma.asignacion.findFirst({
    where: { id, eliminadaEn: null },
    select: asignacionSelect,
  });
  if (!asignacion) throw errores.noEncontrado('Asignación');

  const parte = parteDe(asignacion, actor);
  if (!parte) throw errores.noEncontrado('Asignación');
  return { asignacion, parte };
};

export const obtener = async (id: string, actor: Actor) => {
  const { asignacion, parte } = await obtenerConAcceso(id, actor);
  return serializar(asignacion, parte);
};

/** Asignación activa del estudiante autenticado (punto de entrada de su expediente). */
export const obtenerActual = async (actor: Actor) => {
  const asignacion = await prisma.asignacion.findFirst({
    where: {
      estudiante: { usuarioId: actor.id },
      estado: { in: [...ESTADOS_ACTIVOS] },
      eliminadaEn: null,
    },
    select: asignacionSelect,
    orderBy: { creadaEn: 'desc' },
  });
  if (!asignacion) throw errores.noEncontrado('Asignación activa');
  return serializar(asignacion, 'ESTUDIANTE');
};

/** Cada rol ve solo las asignaciones en las que participa; la coordinación las ve todas. */
export const listar = async (filtros: ListarAsignacionesQuery, actor: Actor) => {
  const porRol: Record<Rol, Prisma.AsignacionWhereInput | null> = {
    ESTUDIANTE: { estudiante: { usuarioId: actor.id } },
    TUTOR_ACADEMICO: { docente: { usuarioId: actor.id } },
    TUTOR_EMPRESARIAL: { tutorEmpresarial: { usuarioId: actor.id } },
    COORDINADOR: {},
    ADMIN: {},
    ORGANIZACION: null,
  };
  const filtroRol = porRol[actor.rol];
  if (!filtroRol) throw errores.prohibido();

  const where: Prisma.AsignacionWhereInput = {
    ...filtroRol,
    eliminadaEn: null,
    ...(filtros.estado && { estado: filtros.estado }),
    ...(filtros.q && {
      estudiante: {
        ...(filtroRol.estudiante as Prisma.EstudianteWhereInput | undefined),
        OR: [
          { carnet: { contains: filtros.q, mode: 'insensitive' } },
          { usuario: { nombres: { contains: filtros.q, mode: 'insensitive' } } },
          { usuario: { apellidos: { contains: filtros.q, mode: 'insensitive' } } },
        ],
      },
    }),
  };

  const [asignaciones, total] = await prisma.$transaction([
    prisma.asignacion.findMany({
      where,
      select: asignacionSelect,
      orderBy: { creadaEn: 'desc' },
      skip: saltar(filtros.page, filtros.limit),
      take: filtros.limit,
    }),
    prisma.asignacion.count({ where }),
  ]);
  return { data: asignaciones.map((a) => serializar(a)), total };
};

/** Postulaciones preseleccionadas por las empresas que esperan la confirmación de la coordinación. */
export const listarCandidatos = async () => {
  const periodo = await obtenerPeriodoActivo();
  if (!periodo) return [];

  const postulaciones = await prisma.postulacion.findMany({
    where: { estado: 'PRESELECCIONADA', asignacion: null, plaza: { periodoId: periodo.id } },
    select: {
      id: true,
      creadaEn: true,
      estudiante: {
        select: {
          id: true,
          carnet: true,
          porcentajeAvance: true,
          usuario: { select: { nombres: true, apellidos: true, correo: true } },
        },
      },
      plaza: {
        select: {
          id: true,
          titulo: true,
          cupos: true,
          cuposOcupados: true,
          organizacion: {
            select: {
              id: true,
              razonSocial: true,
              tutoresEmpresariales: {
                where: { activo: true },
                select: {
                  id: true,
                  cargo: true,
                  usuario: { select: { nombres: true, apellidos: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { creadaEn: 'asc' },
  });

  return postulaciones.map(({ plaza, ...p }) => ({
    ...p,
    plaza: {
      id: plaza.id,
      titulo: plaza.titulo,
      cuposDisponibles: plaza.cupos - plaza.cuposOcupados,
      organizacion: { id: plaza.organizacion.id, razonSocial: plaza.organizacion.razonSocial },
    },
    tutoresEmpresariales: plaza.organizacion.tutoresEmpresariales,
  }));
};

/** Docentes con su carga actual, para elegir tutor académico respetando RN-06. */
export const listarDocentes = async () => {
  const docentes = await prisma.docente.findMany({
    where: { usuario: { estado: 'ACTIVO' } },
    select: {
      id: true,
      departamento: true,
      especialidad: true,
      cupoMaximo: true,
      cupoOcupado: true,
      usuario: { select: { nombres: true, apellidos: true, correo: true } },
    },
    orderBy: [{ cupoOcupado: 'asc' }, { usuario: { apellidos: 'asc' } }],
  });
  return docentes.map((d) => ({ ...d, cupoDisponible: d.cupoMaximo - d.cupoOcupado }));
};

/** RF-13: confirma la asignación y designa al tutor académico (RN-02, RN-05, RN-06). */
export const crear = async (datos: CrearAsignacionInput, actor: Actor) => {
  const postulacion = await prisma.postulacion.findUnique({
    where: { id: datos.postulacionId },
    include: {
      plaza: { include: { periodo: true } },
      estudiante: { include: { usuario: true } },
      asignacion: true,
    },
  });
  if (!postulacion) throw errores.noEncontrado('Postulación');
  if (postulacion.asignacion) throw errores.conflicto('La postulación ya tiene una asignación');
  if (postulacion.estado !== 'PRESELECCIONADA') {
    throw errores.reglaNegocio(
      'Solo se pueden asignar postulaciones preseleccionadas por la empresa',
      [`Estado actual de la postulación: ${postulacion.estado}`],
    );
  }

  const { plaza, estudiante } = postulacion;
  const { periodo } = plaza;

  if (datos.fechaInicio < periodo.fechaInicio || datos.fechaFin > periodo.fechaFin) {
    throw errores.reglaNegocio(
      'Las fechas de la práctica deben estar dentro del período académico',
      [
        `${periodo.nombre}: del ${periodo.fechaInicio.toISOString().slice(0, 10)} al ${periodo.fechaFin.toISOString().slice(0, 10)}`,
      ],
    );
  }

  const activa = await prisma.asignacion.findFirst({
    where: {
      estudianteId: estudiante.id,
      periodoId: periodo.id,
      estado: { in: [...ESTADOS_ACTIVOS] },
      eliminadaEn: null,
    },
  });
  if (activa) {
    throw errores.conflicto('El estudiante ya tiene una asignación activa en este período', [
      'RN-02: un estudiante no puede mantener más de una asignación activa en el mismo período',
    ]);
  }

  // RN-05: ambos tutores deben existir; el empresarial debe pertenecer a la organización de la plaza.
  const docente = await prisma.docente.findUnique({
    where: { id: datos.docenteId },
    include: { usuario: true },
  });
  if (!docente || docente.usuario.estado !== 'ACTIVO') throw errores.noEncontrado('Docente');

  const tutor = await prisma.tutorEmpresarial.findUnique({
    where: { id: datos.tutorEmpresarialId },
    include: { usuario: true },
  });
  if (!tutor || tutor.organizacionId !== plaza.organizacionId || !tutor.activo) {
    throw errores.reglaNegocio('El tutor empresarial no es válido para esta plaza', [
      'RN-05: el tutor empresarial debe estar activo y pertenecer a la organización de la plaza',
    ]);
  }

  return prisma.$transaction(async (tx) => {
    // Incrementos condicionados: evitan sobrepasar los cupos aunque lleguen dos peticiones a la vez.
    const plazaConCupo = await tx.plaza.updateMany({
      where: { id: plaza.id, cuposOcupados: { lt: tx.plaza.fields.cupos } },
      data: { cuposOcupados: { increment: 1 } },
    });
    if (plazaConCupo.count === 0) throw errores.conflicto('La plaza no tiene cupos disponibles');

    const docenteConCupo = await tx.docente.updateMany({
      where: { id: docente.id, cupoOcupado: { lt: tx.docente.fields.cupoMaximo } },
      data: { cupoOcupado: { increment: 1 } },
    });
    if (docenteConCupo.count === 0) {
      throw errores.reglaNegocio('El docente alcanzó su máximo de tutorados', [
        `RN-06: un tutor académico no puede supervisar a más de ${docente.cupoMaximo} estudiantes en el período`,
      ]);
    }

    const asignacion = await tx.asignacion.create({
      data: {
        postulacionId: postulacion.id,
        estudianteId: estudiante.id,
        plazaId: plaza.id,
        docenteId: docente.id,
        tutorEmpresarialId: tutor.id,
        periodoId: periodo.id,
        fechaInicio: datos.fechaInicio,
        fechaFin: datos.fechaFin,
      },
      select: asignacionSelect,
    });

    const ahora = new Date();
    await tx.postulacion.update({
      where: { id: postulacion.id },
      data: { estado: 'ASIGNADA', resueltaEn: ahora },
    });

    // Con la asignación confirmada se retiran sus demás postulaciones pendientes del período.
    await tx.postulacion.updateMany({
      where: {
        estudianteId: estudiante.id,
        id: { not: postulacion.id },
        estado: { in: ['POSTULADA', 'PRESELECCIONADA'] },
        plaza: { periodoId: periodo.id },
      },
      data: { estado: 'RETIRADA', resueltaEn: ahora },
    });

    await registrarAuditoria(
      {
        usuarioId: actor.id,
        entidad: 'Asignacion',
        entidadId: asignacion.id,
        accion: 'CREAR',
        valoresNuevos: {
          postulacionId: postulacion.id,
          docenteId: docente.id,
          tutorEmpresarialId: tutor.id,
          fechaInicio: datos.fechaInicio.toISOString(),
          fechaFin: datos.fechaFin.toISOString(),
        },
      },
      tx,
    );

    const nombreEstudiante = `${estudiante.usuario.nombres} ${estudiante.usuario.apellidos}`;
    await notificar(
      estudiante.usuarioId,
      {
        tipo: 'ASIGNACION_CONFIRMADA',
        titulo: 'Asignación confirmada',
        mensaje: `Fuiste asignado a "${plaza.titulo}". El siguiente paso es elaborar tu plan de trabajo.`,
        enlace: '/expediente/plan',
      },
      tx,
    );
    for (const usuarioId of [docente.usuarioId, tutor.usuarioId]) {
      await notificar(
        usuarioId,
        {
          tipo: 'NUEVO_TUTORADO',
          titulo: 'Nuevo estudiante a tu cargo',
          mensaje: `Fuiste designado tutor de ${nombreEstudiante} en la plaza "${plaza.titulo}".`,
          enlace: `/asignaciones/${asignacion.id}`,
        },
        tx,
      );
    }

    return serializar(asignacion, 'SUPERVISOR');
  });
};
