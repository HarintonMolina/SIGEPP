import type { Prisma, Rol } from '@prisma/client';
import { registrarAuditoria } from '../../lib/auditoria.js';
import { errores } from '../../lib/errores.js';
import { notificar } from '../../lib/notificaciones.js';
import { prisma } from '../../lib/prisma.js';
import { ESTADOS_ACTIVOS, obtenerConAcceso } from '../asignaciones/asignaciones.service.js';
import type { PlanInput } from './planes-trabajo.schema.js';

interface Actor {
  id: string;
  rol: Rol;
}

const planSelect = {
  id: true,
  asignacionId: true,
  version: true,
  objetivos: true,
  actividades: true,
  horasPrevistas: true,
  estado: true,
  aprobadoDocenteEn: true,
  aprobadoEmpresaEn: true,
  actualizadoEn: true,
  versiones: {
    select: {
      version: true,
      objetivos: true,
      actividades: true,
      horasPrevistas: true,
      observacionDocente: true,
      observacionEmpresa: true,
      creadaEn: true,
    },
    orderBy: { version: 'desc' },
  },
} satisfies Prisma.PlanTrabajoSelect;

const sumarHoras = (actividades: PlanInput['actividades']) =>
  actividades.reduce((total, a) => total + a.horas, 0);

/** Carga el plan y verifica que el actor sea parte de su asignación (o la supervise). */
const cargarPlan = async (planId: string, actor: Actor) => {
  const plan = await prisma.planTrabajo.findUnique({ where: { id: planId } });
  if (!plan) throw errores.noEncontrado('Plan de trabajo');
  const { asignacion, parte } = await obtenerConAcceso(plan.asignacionId, actor);
  return { plan, asignacion, parte };
};

const exigirEstudiante = (parte: string) => {
  if (parte !== 'ESTUDIANTE')
    throw errores.prohibido('Solo el estudiante puede editar su plan de trabajo');
};

const exigirTutor = (parte: string) => {
  if (parte !== 'TUTOR_ACADEMICO' && parte !== 'TUTOR_EMPRESARIAL') {
    throw errores.prohibido('Solo los tutores de la asignación pueden revisar el plan');
  }
  return parte;
};

export const obtenerPorAsignacion = async (asignacionId: string, actor: Actor) => {
  await obtenerConAcceso(asignacionId, actor);
  const plan = await prisma.planTrabajo.findUnique({ where: { asignacionId }, select: planSelect });
  if (!plan) throw errores.noEncontrado('Plan de trabajo');
  return plan;
};

/** RF-14: el estudiante crea el borrador de su plan. */
export const crear = async (asignacionId: string, datos: PlanInput, actor: Actor) => {
  const { asignacion, parte } = await obtenerConAcceso(asignacionId, actor);
  exigirEstudiante(parte);
  if (!(ESTADOS_ACTIVOS as readonly string[]).includes(asignacion.estado)) {
    throw errores.conflicto('La asignación no está activa');
  }
  if (asignacion.planTrabajo) throw errores.conflicto('La asignación ya tiene un plan de trabajo');

  return prisma.planTrabajo.create({
    data: {
      asignacionId,
      objetivos: datos.objetivos,
      actividades: datos.actividades,
      horasPrevistas: sumarHoras(datos.actividades),
    },
    select: planSelect,
  });
};

/** El estudiante modifica el plan mientras está en borrador u observado. */
export const actualizar = async (planId: string, datos: PlanInput, actor: Actor) => {
  const { plan, parte } = await cargarPlan(planId, actor);
  exigirEstudiante(parte);
  if (plan.estado !== 'BORRADOR' && plan.estado !== 'OBSERVADO') {
    throw errores.conflicto('El plan no se puede editar en su estado actual', [
      `Estado actual: ${plan.estado}`,
    ]);
  }

  return prisma.planTrabajo.update({
    where: { id: planId },
    data: {
      objetivos: datos.objetivos,
      actividades: datos.actividades,
      horasPrevistas: sumarHoras(datos.actividades),
    },
    select: planSelect,
  });
};

/**
 * Envía el plan a revisión de ambos tutores. Cada envío queda guardado como una versión
 * inmutable; si la versión actual ya se había enviado (y fue observada), se crea la siguiente.
 */
export const enviar = async (planId: string, actor: Actor) => {
  const { plan, asignacion, parte } = await cargarPlan(planId, actor);
  exigirEstudiante(parte);
  if (plan.estado !== 'BORRADOR' && plan.estado !== 'OBSERVADO') {
    throw errores.conflicto('El plan ya fue enviado', [`Estado actual: ${plan.estado}`]);
  }
  if (plan.horasPrevistas < asignacion.periodo.horasMinimas) {
    throw errores.reglaNegocio('El plan no alcanza las horas mínimas del período', [
      `Horas previstas: ${plan.horasPrevistas}; mínimo requerido: ${asignacion.periodo.horasMinimas}`,
    ]);
  }

  const yaEnviada = await prisma.planTrabajoVersion.findUnique({
    where: { planId_version: { planId, version: plan.version } },
  });
  const version = yaEnviada ? plan.version + 1 : plan.version;

  return prisma.$transaction(async (tx) => {
    await tx.planTrabajoVersion.create({
      data: {
        planId,
        version,
        objetivos: plan.objetivos,
        actividades: plan.actividades as Prisma.InputJsonValue,
        horasPrevistas: plan.horasPrevistas,
      },
    });
    const actualizado = await tx.planTrabajo.update({
      where: { id: planId },
      data: { version, estado: 'EN_REVISION', aprobadoDocenteEn: null, aprobadoEmpresaEn: null },
      select: planSelect,
    });

    await registrarAuditoria(
      {
        entidad: 'PlanTrabajo',
        entidadId: planId,
        accion: 'ENVIAR_REVISION',
        valoresAnteriores: { estado: plan.estado },
        valoresNuevos: { estado: 'EN_REVISION', version },
      },
      tx,
    );

    const estudiante = `${asignacion.estudiante.usuario.nombres} ${asignacion.estudiante.usuario.apellidos}`;
    for (const usuarioId of [asignacion.docente.usuarioId, asignacion.tutorEmpresarial.usuarioId]) {
      await notificar(
        usuarioId,
        {
          tipo: 'PLAN_EN_REVISION',
          titulo: 'Plan de trabajo por revisar',
          mensaje: `${estudiante} envió la versión ${version} de su plan de trabajo.`,
          enlace: `/asignaciones/${asignacion.id}`,
        },
        tx,
      );
    }

    return actualizado;
  });
};

/**
 * RF-15 y RN-07: cada tutor aprueba por separado. Con ambas aprobaciones el plan queda
 * APROBADO y la asignación pasa a EN_CURSO, lo que habilita el registro de bitácoras.
 */
export const aprobar = async (planId: string, actor: Actor) => {
  const { plan, asignacion, parte } = await cargarPlan(planId, actor);
  const tutor = exigirTutor(parte);
  if (plan.estado !== 'EN_REVISION') {
    throw errores.conflicto('El plan no está en revisión', [`Estado actual: ${plan.estado}`]);
  }

  const campo = tutor === 'TUTOR_ACADEMICO' ? 'aprobadoDocenteEn' : 'aprobadoEmpresaEn';
  if (plan[campo]) throw errores.conflicto('Ya aprobaste esta versión del plan');

  const ahora = new Date();
  const otroAprobo = tutor === 'TUTOR_ACADEMICO' ? plan.aprobadoEmpresaEn : plan.aprobadoDocenteEn;
  const completo = !!otroAprobo;

  return prisma.$transaction(async (tx) => {
    const actualizado = await tx.planTrabajo.update({
      where: { id: planId },
      data: { [campo]: ahora, ...(completo && { estado: 'APROBADO' }) },
      select: planSelect,
    });

    if (completo && asignacion.estado === 'ASIGNADA') {
      await tx.asignacion.update({ where: { id: asignacion.id }, data: { estado: 'EN_CURSO' } });
    }

    await registrarAuditoria(
      {
        entidad: 'PlanTrabajo',
        entidadId: planId,
        accion: 'APROBAR',
        valoresAnteriores: { estado: plan.estado },
        valoresNuevos: {
          estado: actualizado.estado,
          [campo]: ahora.toISOString(),
          version: plan.version,
        },
      },
      tx,
    );

    await notificar(
      asignacion.estudiante.usuarioId,
      completo
        ? {
            tipo: 'PLAN_APROBADO',
            titulo: 'Plan de trabajo aprobado',
            mensaje:
              'Ambos tutores aprobaron tu plan. Ya puedes registrar tus bitácoras quincenales.',
            enlace: '/expediente/bitacoras',
          }
        : {
            tipo: 'PLAN_APROBACION_PARCIAL',
            titulo: 'Un tutor aprobó tu plan',
            mensaje: `Tu tutor ${tutor === 'TUTOR_ACADEMICO' ? 'académico' : 'empresarial'} aprobó el plan; falta la otra aprobación.`,
            enlace: '/expediente/plan',
          },
      tx,
    );

    return actualizado;
  });
};

/** RF-15: un tutor devuelve el plan con observaciones; el estudiante lo corrige y lo reenvía. */
export const observar = async (planId: string, observacion: string, actor: Actor) => {
  const { plan, asignacion, parte } = await cargarPlan(planId, actor);
  const tutor = exigirTutor(parte);
  if (plan.estado !== 'EN_REVISION') {
    throw errores.conflicto('El plan no está en revisión', [`Estado actual: ${plan.estado}`]);
  }

  return prisma.$transaction(async (tx) => {
    await tx.planTrabajoVersion.update({
      where: { planId_version: { planId, version: plan.version } },
      data:
        tutor === 'TUTOR_ACADEMICO'
          ? { observacionDocente: observacion }
          : { observacionEmpresa: observacion },
    });
    const actualizado = await tx.planTrabajo.update({
      where: { id: planId },
      data: { estado: 'OBSERVADO', aprobadoDocenteEn: null, aprobadoEmpresaEn: null },
      select: planSelect,
    });

    await registrarAuditoria(
      {
        entidad: 'PlanTrabajo',
        entidadId: planId,
        accion: 'OBSERVAR',
        valoresAnteriores: { estado: plan.estado },
        valoresNuevos: { estado: 'OBSERVADO', version: plan.version, observacion },
      },
      tx,
    );

    await notificar(
      asignacion.estudiante.usuarioId,
      {
        tipo: 'PLAN_OBSERVADO',
        titulo: 'Tu plan de trabajo tiene observaciones',
        mensaje: `Tu tutor ${tutor === 'TUTOR_ACADEMICO' ? 'académico' : 'empresarial'} dejó observaciones: ${observacion}`,
        enlace: '/expediente/plan',
      },
      tx,
    );

    return actualizado;
  });
};
