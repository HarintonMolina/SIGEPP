/**
 * Fábricas de datos para las pruebas de integración. Crean registros directamente
 * en la base de prueba y emiten tokens sin pasar por /auth/login, para que las
 * pruebas sean rápidas e independientes del módulo de autenticación.
 */
import type { Prisma, Rol } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

// Hash bcrypt (costo 12) de la contraseña "Sigepp2026", para los usuarios creados por las fábricas.
export const CONTRASENA_PRUEBA = 'Sigepp2026';
const HASH_PRUEBA = '$2a$12$.SQRzWeqe.8X5VoWvGc6recEOJ29llmM.VOK3jhu35ZYeTvpZJfYa';

let secuencia = 0;
const siguiente = () => ++secuencia;

export const tokenPara = (usuario: { id: string; rol: Rol }) =>
  jwt.sign({ rol: usuario.rol }, env.JWT_ACCESS_SECRET, { subject: usuario.id, expiresIn: '15m' });

export const bearer = (usuario: { id: string; rol: Rol }) => `Bearer ${tokenPara(usuario)}`;

export const crearUsuario = (rol: Rol, datos: Partial<Prisma.UsuarioCreateInput> = {}) => {
  const n = siguiente();
  return prisma.usuario.create({
    data: {
      rol,
      nombres: `Nombre${n}`,
      apellidos: `Apellido${n}`,
      correo: `usuario${n}@uni.edu.ni`,
      hashContrasena: HASH_PRUEBA,
      ...datos,
    },
  });
};

export const crearPeriodoActivo = (datos: Partial<Prisma.PeriodoCreateInput> = {}) =>
  prisma.periodo.create({
    data: {
      nombre: 'II Semestre 2026',
      anio: 2026,
      semestre: 2,
      fechaInicio: new Date('2026-08-15'),
      fechaFin: new Date('2026-12-15'),
      convocatoriaAbierta: true,
      activo: true,
      ...datos,
    },
  });

const enUnAnio = () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

export const crearOrganizacion = async (
  opciones: { verificada?: boolean; convenioVigenteHasta?: Date | null } = {},
) => {
  const { verificada = true, convenioVigenteHasta = enUnAnio() } = opciones;
  const n = siguiente();
  const representante = await crearUsuario('ORGANIZACION', {
    correo: `rep${n}@empresa${n}.example`,
  });
  const organizacion = await prisma.organizacion.create({
    data: {
      razonSocial: `Empresa de Prueba ${n}, S.A.`,
      ruc: `J${String(n).padStart(13, '0')}`,
      sector: 'Tecnología',
      direccion: 'Managua',
      estadoVerificacion: verificada ? 'VERIFICADA' : 'PENDIENTE',
      convenioVigenteHasta: verificada ? convenioVigenteHasta : null,
      representanteId: representante.id,
    },
  });
  return { organizacion, representante };
};

export const datosPlaza = (datos: Record<string, unknown> = {}) => ({
  titulo: 'Desarrollador Web Jr.',
  descripcion: 'Apoyo en el desarrollo de una aplicación web con React y Node.js.',
  area: 'Desarrollo de software',
  modalidad: 'HIBRIDA',
  ubicacion: 'Managua',
  cupos: 2,
  horario: 'Lunes a viernes, 8:00 a 12:00',
  competencias: ['JavaScript', 'React'],
  ...datos,
});

export const crearPlaza = (
  organizacionId: string,
  periodoId: string,
  datos: Partial<Prisma.PlazaUncheckedCreateInput> = {},
) =>
  prisma.plaza.create({
    data: {
      ...(datosPlaza() as Omit<Prisma.PlazaUncheckedCreateInput, 'organizacionId' | 'periodoId'>),
      organizacionId,
      periodoId,
      estado: 'APROBADA',
      publicadaEn: new Date(),
      ...datos,
    },
  });

export const crearEstudiante = async (porcentajeAvance = 90) => {
  const n = siguiente();
  const usuario = await crearUsuario('ESTUDIANTE', { correo: `estudiante${n}@std.uni.edu.ni` });
  const estudiante = await prisma.estudiante.create({
    data: {
      usuarioId: usuario.id,
      carnet: `2022-${String(n).padStart(4, '0')}U`,
      carrera: 'Ingeniería en Sistemas',
      anio: 5,
      porcentajeAvance,
      avanceVerificado: true,
    },
  });
  return { usuario, estudiante };
};

export const crearDocente = async () => {
  const usuario = await crearUsuario('TUTOR_ACADEMICO');
  const docente = await prisma.docente.create({
    data: { usuarioId: usuario.id, departamento: 'Ingeniería en Sistemas' },
  });
  return { usuario, docente };
};

export const crearTutorEmpresarial = async (organizacionId: string) => {
  const n = siguiente();
  const usuario = await crearUsuario('TUTOR_EMPRESARIAL', { correo: `tutor${n}@empresa.example` });
  const tutor = await prisma.tutorEmpresarial.create({
    data: { usuarioId: usuario.id, organizacionId, cargo: 'Líder técnico' },
  });
  return { usuario, tutor };
};

/** Asignación activa completa: estudiante, postulación, docente y tutor empresarial. */
export const crearAsignacion = async (plaza: {
  id: string;
  organizacionId: string;
  periodoId: string;
}) => {
  const { estudiante } = await crearEstudiante();
  const { docente } = await crearDocente();
  const { tutor } = await crearTutorEmpresarial(plaza.organizacionId);
  const postulacion = await prisma.postulacion.create({
    data: {
      estudianteId: estudiante.id,
      plazaId: plaza.id,
      cartaMotivacion: 'Carta de motivación de prueba con la longitud suficiente.',
      estado: 'ASIGNADA',
    },
  });
  const asignacion = await prisma.asignacion.create({
    data: {
      postulacionId: postulacion.id,
      estudianteId: estudiante.id,
      plazaId: plaza.id,
      docenteId: docente.id,
      tutorEmpresarialId: tutor.id,
      periodoId: plaza.periodoId,
      fechaInicio: new Date('2026-09-01'),
      fechaFin: new Date('2026-12-01'),
    },
  });
  return { asignacion, estudiante, docente, tutor };
};
