import { describe, expect, it } from 'vitest';
import { makeSesionResponse, makeUsuario } from '../../test/fixtures';
import { sesionResponseSchema, usuarioResponseSchema, usuarioSchema } from './contracts';

describe('contratos públicos auth', () => {
  it('contrato usuario acepta perfiles null sin inferirlos del rol', () => {
    expect(usuarioSchema.safeParse(makeUsuario()).success).toBe(true);
  });

  it('contrato usuario conserva avance 92 como string y los cuatro perfiles', () => {
    const valid = makeUsuario('ESTUDIANTE', {
      estudiante: {
        id: 'estudiante-prueba', carnet: '2022-0802U', carrera: 'Ingeniería en Sistemas',
        anio: 5, porcentajeAvance: '92', avanceVerificado: true,
      },
      docente: { id: 'docente-prueba', departamento: 'Sistemas', especialidad: null },
      tutorEmpresarial: { id: 'tutor-prueba', organizacionId: 'empresa-prueba', cargo: 'Supervisor' },
      organizacion: { id: 'empresa-prueba', razonSocial: 'Empresa de prueba', estadoVerificacion: 'VERIFICADA' },
    });
    expect(usuarioSchema.safeParse(valid).success).toBe(true);
    expect(usuarioSchema.parse(valid).estudiante?.porcentajeAvance).toBe('92');
  });

  it.each(['ESTUDIANTE', 'TUTOR_ACADEMICO', 'TUTOR_EMPRESARIAL', 'ORGANIZACION', 'COORDINADOR', 'ADMIN'] as const)(
    'sesión permite el rol público %s', (rol) => {
      expect(sesionResponseSchema.safeParse(makeSesionResponse(rol)).success).toBe(true);
    },
  );

  it.each([
    { rol: 'INVITADO' }, { estado: 'DESCONOCIDO' }, { creadoEn: 'ayer' },
    { telefono: 88880000 }, { estudiante: undefined },
    { docente: { id: 'docente', departamento: 'Sistemas' } },
    { tutorEmpresarial: { id: 'tutor', cargo: 'Supervisor' } },
    { organizacion: { id: 'empresa', razonSocial: 'Prueba', estadoVerificacion: 'OTRA' } },
    { estudiante: {
      id: 'estudiante', carnet: '2022-0802U', carrera: 'Sistemas',
      anio: 5, porcentajeAvance: 92, avanceVerificado: false,
    } },
  ])('contrato usuario rechaza campos públicos incompatibles: %j', (invalid) => {
    expect(usuarioSchema.safeParse({ ...makeUsuario(), ...invalid }).success).toBe(false);
  });

  it('registro requiere el sobre usuario', () => {
    expect(usuarioResponseSchema.safeParse({ usuario: makeUsuario() }).success).toBe(true);
    expect(usuarioResponseSchema.safeParse(makeUsuario()).success).toBe(false);
  });

  it('sesión requiere accessToken string y usuario completo', () => {
    expect(sesionResponseSchema.safeParse({ usuario: makeUsuario() }).success).toBe(false);
    expect(sesionResponseSchema.safeParse({ accessToken: 123, usuario: makeUsuario() }).success).toBe(false);
    expect(sesionResponseSchema.safeParse({ accessToken: 'prueba', usuario: {} }).success).toBe(false);
  });
});
