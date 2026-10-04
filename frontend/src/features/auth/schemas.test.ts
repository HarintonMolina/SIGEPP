import { describe, expect, it } from 'vitest';
import { createRegistroFormSchema, loginFormSchema, toRegistroInput } from './schemas';

const estudiante = {
  rol: 'ESTUDIANTE' as const, nombres: 'Ana Lucía', apellidos: 'Pérez Gómez',
  correo: 'ana@std.uni.edu.ni', contrasena: 'Segura2026', confirmacion: 'Segura2026',
  carnet: '2022-0802U', carrera: 'Ingeniería en Sistemas', anio: 5,
};
const docente = {
  rol: 'TUTOR_ACADEMICO' as const, nombres: 'Ana Lucía', apellidos: 'Pérez Gómez',
  correo: 'ana@uni.edu.ni', contrasena: 'Segura2026', confirmacion: 'Segura2026',
  departamento: 'Ingeniería en Sistemas',
};
const schema = createRegistroFormSchema(['uni.edu.ni', 'std.uni.edu.ni']);

describe('registro', () => {
  it('acepta ambos roles y normaliza correo, nombre y carnet', () => {
    expect(schema.parse({ ...estudiante, nombres: ' Ana Lucía ', correo: ' ANA@STD.UNI.EDU.NI ', carnet: ' 2022-0802u ' }))
      .toEqual({ ...estudiante, nombres: 'Ana Lucía' });
    expect(schema.parse(docente)).toEqual(docente);
  });
  it.each([estudiante, docente])('aplica el dominio institucional exacto al rol $rol', (values) => {
    for (const correo of ['a@eviluni.edu.ni', 'a@sub.uni.edu.ni', 'correo-invalido']) {
      expect(schema.safeParse({ ...values, correo }).success).toBe(false);
    }
    expect(schema.safeParse({ ...values, correo: 'a@std.uni.edu.ni' }).success).toBe(true);
  });
  it.each(['nombres', 'apellidos'] as const)('respeta los límites de %s después del trim', (field) => {
    for (const [length, valid] of [[1, false], [2, true], [80, true], [81, false]] as const) {
      expect(schema.safeParse({ ...estudiante, [field]: ` ${'a'.repeat(length)} ` }).success).toBe(valid);
    }
  });
  it.each([[7, false], [8, true], [72, true], [73, false]] as const)('contraseña de %i caracteres', (length, valid) => {
    const contrasena = `a1${'x'.repeat(length - 2)}`;
    expect(schema.safeParse({ ...estudiante, contrasena, confirmacion: contrasena }).success).toBe(valid);
  });
  it.each(['abcdefgh', '12345678', 'á1234567'])('rechaza contraseña sin letra ASCII o dígito: %s', (contrasena) => {
    expect(schema.safeParse({ ...docente, contrasena, confirmacion: contrasena }).success).toBe(false);
  });
  it('conserva espacios y permite contraseña sin mayúsculas ni símbolos', () => {
    const contrasena = ' abc1234 ';
    expect(schema.parse({ ...docente, contrasena, confirmacion: contrasena }).contrasena).toBe(contrasena);
  });
  it('asocia la desigualdad exacta de confirmación al control', () => {
    const result = schema.safeParse({ ...estudiante, confirmacion: 'Distinta2026' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.flatten().fieldErrors.confirmacion).toBeDefined();
  });
  it.each([[0, false], [1, true], [5, true], [6, false], [1.5, false], ['', false], ['abc', false]] as const)('valida año %s', (anio, valid) => {
    expect(schema.safeParse({ ...estudiante, anio }).success).toBe(valid);
  });
  it('convierte la selección de año de RHF a entero', () => {
    expect(toRegistroInput(schema.parse({ ...estudiante, anio: '5' }))).toMatchObject({ anio: 5 });
  });
  it.each(['2022-802U', '2022-0802', '2022-0802UU'])('rechaza carnet incorrecto %s', (carnet) => {
    expect(schema.safeParse({ ...estudiante, carnet }).success).toBe(false);
  });
  it.each(['carrera', 'departamento'] as const)('valida límites de %s tras trim', (field) => {
    const values = field === 'carrera' ? estudiante : docente;
    for (const [length, valid] of [[2, false], [3, true], [100, true], [101, false]] as const) {
      expect(schema.safeParse({ ...values, [field]: ` ${'a'.repeat(length)} ` }).success).toBe(valid);
    }
  });
  it.each([['+505 8888-8888', true], ['12345678', true], ['', true], [' ', true], ['1234567', false], ['1234567890123456', false], ['abcdefgh', false]] as const)('valida teléfono %s', (telefono, valid) => {
    expect(schema.safeParse({ ...docente, telefono }).success).toBe(valid);
  });
  it.each([[100, true], [101, false]] as const)('especialidad de %i caracteres', (length, valid) => {
    expect(schema.safeParse({ ...docente, especialidad: ` ${'a'.repeat(length)} ` }).success).toBe(valid);
  });
  it('omite opcionales vacíos y confirmación al serializar docente', () => {
    expect(toRegistroInput({ ...docente, telefono: ' ', especialidad: '' })).toEqual({
      rol: 'TUTOR_ACADEMICO', nombres: 'Ana Lucía', apellidos: 'Pérez Gómez',
      correo: 'ana@uni.edu.ni', contrasena: 'Segura2026', departamento: 'Ingeniería en Sistemas',
    });
  });
  it('incluye opcionales no vacíos con trim', () => {
    expect(toRegistroInput(schema.parse({ ...docente, telefono: ' 12345678 ', especialidad: ' Matemática ' })))
      .toMatchObject({ telefono: '12345678', especialidad: 'Matemática' });
  });
  it('excluye campos del otro rol y confirmación en ambos payloads', () => {
    expect(toRegistroInput(schema.parse({ ...estudiante, departamento: 'Docencia', especialidad: 'Mate' })))
      .toEqual({ rol: 'ESTUDIANTE', nombres: 'Ana Lucía', apellidos: 'Pérez Gómez', correo: 'ana@std.uni.edu.ni', contrasena: 'Segura2026', carnet: '2022-0802U', carrera: 'Ingeniería en Sistemas', anio: 5 });
    expect(toRegistroInput(schema.parse({ ...docente, carnet: '2022-0802U', carrera: 'Sistemas', anio: 5 })))
      .toEqual({ rol: 'TUTOR_ACADEMICO', nombres: 'Ana Lucía', apellidos: 'Pérez Gómez', correo: 'ana@uni.edu.ni', contrasena: 'Segura2026', departamento: 'Ingeniería en Sistemas' });
  });
  it('rechaza otros roles de registro', () => {
    expect(schema.safeParse({ ...docente, rol: 'ADMIN' }).success).toBe(false);
  });
  it('presenta los errores de tipo, año ilegible y rol inválido en español', () => {
    for (const values of [{ ...docente, nombres: undefined }, { ...estudiante, anio: 'abc' }, { ...docente, rol: 'ADMIN' }]) {
      const result = schema.safeParse(values);
      expect(result.success).toBe(false);
      if (!result.success) {
        for (const issue of result.error.issues) expect(issue.message).toMatch(/Ingresa|Selecciona/);
      }
    }
  });
});

describe('login', () => {
  it('acepta correo empresarial y contraseña corta sin política de registro', () => {
    expect(loginFormSchema.parse({ correo: 'rrhh@empresa.example', contrasena: 'x' }))
      .toEqual({ correo: 'rrhh@empresa.example', contrasena: 'x' });
  });
  it('normaliza correo y conserva contraseña sin trim', () => {
    expect(loginFormSchema.parse({ correo: ' RRHH@EMPRESA.EXAMPLE ', contrasena: ' ' }))
      .toEqual({ correo: 'rrhh@empresa.example', contrasena: ' ' });
  });
  it.each([[0, false], [1, true], [72, true], [73, false]] as const)('valida contraseña login de %i caracteres', (length, valid) => {
    expect(loginFormSchema.safeParse({ correo: 'rrhh@empresa.example', contrasena: 'x'.repeat(length) }).success).toBe(valid);
  });
  it('rechaza correo mal formado', () => {
    expect(loginFormSchema.safeParse({ correo: 'invalido', contrasena: 'x' }).success).toBe(false);
  });
});
