import { createHash, randomBytes } from 'node:crypto';
import type { Prisma, Rol } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { registrarAuditoria } from '../../lib/auditoria.js';
import { AppError, errores } from '../../lib/errores.js';
import { prisma } from '../../lib/prisma.js';
import type { LoginInput, RegistroInput } from './auth.schema.js';

/** RNF-08: intentos fallidos permitidos antes del bloqueo temporal. */
export const MAX_INTENTOS_FALLIDOS = 5;
/** Duración base del bloqueo; crece con cada bloqueo consecutivo (15, 30, 45 min...). */
const MINUTOS_BLOQUEO_BASE = 15;

// Hash con el mismo costo, usado cuando el correo no existe para que la respuesta
// tarde lo mismo y no revele qué correos están registrados.
const HASH_FICTICIO = bcrypt.hashSync('contrasena-ficticia', env.BCRYPT_COST);

const usuarioPublicoSelect = {
  id: true,
  nombres: true,
  apellidos: true,
  correo: true,
  rol: true,
  estado: true,
  telefono: true,
  creadoEn: true,
  estudiante: {
    select: {
      id: true,
      carnet: true,
      carrera: true,
      anio: true,
      porcentajeAvance: true,
      avanceVerificado: true,
    },
  },
  docente: { select: { id: true, departamento: true, especialidad: true } },
  tutorEmpresarial: { select: { id: true, organizacionId: true, cargo: true } },
  organizacion: { select: { id: true, razonSocial: true, estadoVerificacion: true } },
} satisfies Prisma.UsuarioSelect;

export type UsuarioPublico = Prisma.UsuarioGetPayload<{ select: typeof usuarioPublicoSelect }>;

export interface Sesion {
  accessToken: string;
  refreshToken: string;
  refreshExpiraEn: Date;
  usuario: UsuarioPublico;
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const esCorreoInstitucional = (correo: string) => {
  const dominio = correo.split('@')[1] ?? '';
  return env.DOMINIOS_INSTITUCIONALES.includes(dominio);
};

const firmarAccessToken = (usuarioId: string, rol: Rol) =>
  jwt.sign({ rol }, env.JWT_ACCESS_SECRET, {
    subject: usuarioId,
    expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });

/**
 * El token de refresco es una cadena aleatoria opaca; en la base solo se guarda su hash,
 * de modo que una filtración de la base no permite suplantar sesiones.
 */
const emitirRefreshToken = async (
  usuarioId: string,
  cliente: Prisma.TransactionClient = prisma,
) => {
  const token = randomBytes(48).toString('base64url');
  const expiraEn = new Date(Date.now() + env.REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  await cliente.refreshToken.create({ data: { usuarioId, tokenHash: hashToken(token), expiraEn } });
  return { token, expiraEn };
};

const crearSesion = async (usuario: UsuarioPublico): Promise<Sesion> => {
  const { token, expiraEn } = await emitirRefreshToken(usuario.id);
  return {
    accessToken: firmarAccessToken(usuario.id, usuario.rol),
    refreshToken: token,
    refreshExpiraEn: expiraEn,
    usuario,
  };
};

/** RF-01: registro de estudiantes y docentes con correo del dominio institucional. */
export const registrar = async (datos: RegistroInput): Promise<UsuarioPublico> => {
  if (!esCorreoInstitucional(datos.correo)) {
    throw errores.validacion([
      `correo: debe pertenecer al dominio institucional (${env.DOMINIOS_INSTITUCIONALES.join(', ')})`,
    ]);
  }

  const existente = await prisma.usuario.findUnique({ where: { correo: datos.correo } });
  if (existente) throw errores.conflicto('Ya existe una cuenta con ese correo');

  const hashContrasena = await bcrypt.hash(datos.contrasena, env.BCRYPT_COST);
  const base = {
    nombres: datos.nombres,
    apellidos: datos.apellidos,
    correo: datos.correo,
    telefono: datos.telefono,
    hashContrasena,
    rol: datos.rol,
  };

  const perfil =
    datos.rol === 'ESTUDIANTE'
      ? {
          estudiante: {
            create: { carnet: datos.carnet, carrera: datos.carrera, anio: datos.anio },
          },
        }
      : {
          docente: {
            create: { departamento: datos.departamento, especialidad: datos.especialidad },
          },
        };

  return prisma.usuario.create({ data: { ...base, ...perfil }, select: usuarioPublicoSelect });
};

/** RF-02 y RNF-08: inicio de sesión con bloqueo temporal tras intentos fallidos. */
export const iniciarSesion = async (
  { correo, contrasena }: LoginInput,
  ip?: string,
): Promise<Sesion> => {
  const usuario = await prisma.usuario.findUnique({ where: { correo } });

  if (!usuario) {
    await bcrypt.compare(contrasena, HASH_FICTICIO);
    throw errores.noAutenticado('Correo o contraseña incorrectos');
  }

  if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
    const minutos = Math.ceil((usuario.bloqueadoHasta.getTime() - Date.now()) / 60_000);
    throw new AppError(
      429,
      'CUENTA_BLOQUEADA',
      `Cuenta bloqueada temporalmente por intentos fallidos. Intenta de nuevo en ${minutos} min`,
    );
  }

  const valida = await bcrypt.compare(contrasena, usuario.hashContrasena);

  if (!valida) {
    const intentos = usuario.intentosFallidos + 1;

    if (intentos >= MAX_INTENTOS_FALLIDOS) {
      const bloqueos = usuario.bloqueos + 1;
      const bloqueadoHasta = new Date(Date.now() + MINUTOS_BLOQUEO_BASE * bloqueos * 60_000);
      await prisma.$transaction(async (tx) => {
        await tx.usuario.update({
          where: { id: usuario.id },
          data: { intentosFallidos: 0, bloqueos, bloqueadoHasta },
        });
        await registrarAuditoria(
          {
            usuarioId: usuario.id,
            entidad: 'Usuario',
            entidadId: usuario.id,
            accion: 'BLOQUEO_POR_INTENTOS',
            valoresNuevos: { bloqueos, bloqueadoHasta: bloqueadoHasta.toISOString() },
            ip,
          },
          tx,
        );
      });
    } else {
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { intentosFallidos: intentos },
      });
    }

    throw errores.noAutenticado('Correo o contraseña incorrectos');
  }

  if (usuario.estado !== 'ACTIVO') {
    throw errores.prohibido('La cuenta está inactiva. Contacta a la coordinación');
  }

  const actualizado = await prisma.usuario.update({
    where: { id: usuario.id },
    data: { intentosFallidos: 0, bloqueos: 0, bloqueadoHasta: null },
    select: usuarioPublicoSelect,
  });

  return crearSesion(actualizado);
};

/**
 * Renueva el token de acceso. El token de refresco se rota en cada uso; si llega uno
 * ya revocado se asume que fue robado y se cierran todas las sesiones del usuario.
 */
export const refrescarSesion = async (refreshToken: string | undefined): Promise<Sesion> => {
  if (!refreshToken) throw errores.noAutenticado('No hay sesión activa');

  const registro = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
    include: { usuario: { select: usuarioPublicoSelect } },
  });

  if (!registro) throw errores.noAutenticado('Sesión inválida');

  if (registro.revocadoEn) {
    await prisma.refreshToken.updateMany({
      where: { usuarioId: registro.usuarioId, revocadoEn: null },
      data: { revocadoEn: new Date() },
    });
    throw errores.noAutenticado('Sesión inválida');
  }

  if (registro.expiraEn < new Date()) throw errores.noAutenticado('La sesión expiró');
  if (registro.usuario.estado !== 'ACTIVO') throw errores.prohibido('La cuenta está inactiva');

  const rotado = await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({ where: { id: registro.id }, data: { revocadoEn: new Date() } });
    return emitirRefreshToken(registro.usuarioId, tx);
  });

  return {
    accessToken: firmarAccessToken(registro.usuario.id, registro.usuario.rol),
    refreshToken: rotado.token,
    refreshExpiraEn: rotado.expiraEn,
    usuario: registro.usuario,
  };
};

export const cerrarSesion = async (refreshToken: string | undefined) => {
  if (!refreshToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(refreshToken), revocadoEn: null },
    data: { revocadoEn: new Date() },
  });
};

export const obtenerPerfil = async (usuarioId: string): Promise<UsuarioPublico> => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: usuarioPublicoSelect,
  });
  if (!usuario) throw errores.noEncontrado('Usuario');
  return usuario;
};
