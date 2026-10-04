import type { Rol, SesionResponse, Usuario } from '../features/auth/contracts';

export function makeUsuario(rol: Rol = 'ESTUDIANTE', overrides?: Partial<Usuario>): Usuario {
  return {
    id: 'usuario-prueba-1',
    nombres: 'Ana',
    apellidos: 'Pérez',
    correo: 'ana@std.uni.edu.ni',
    rol,
    estado: 'ACTIVO',
    telefono: null,
    creadoEn: '2026-10-03T12:00:00.000Z',
    estudiante: null,
    docente: null,
    tutorEmpresarial: null,
    organizacion: null,
    ...overrides,
  };
}

export function makeSesionResponse(rol?: Rol, accessToken = 'token-ficticio-prueba'): SesionResponse {
  return { accessToken, usuario: makeUsuario(rol) };
}
