import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api/errors';
import { splitFormErrors } from './form-errors';

describe('splitFormErrors', () => {
  it('asocia solo campos permitidos y preserva mensajes con varios separadores', () => {
    const error = new ApiError({ kind: 'http', status: 400, codigo: 'VALIDACION', mensaje: 'Datos inválidos', detalles: [
      'correo: Formato inválido', ' telefono : Debe cumplir: 8 a 15 caracteres',
      'desconocido: No permitido', 'Detalle sin separador', ': Falta el campo', 'correo:',
    ] });
    expect(splitFormErrors(error, ['correo', 'telefono'])).toEqual({
      fields: { correo: 'Formato inválido', telefono: 'Debe cumplir: 8 a 15 caracteres' },
      general: ['Datos inválidos', 'desconocido: No permitido', 'Detalle sin separador', ': Falta el campo', 'correo:'],
    });
  });
  it('presenta conflicto de carnet sin atribuirlo a correo', () => {
    const error = new ApiError({ kind: 'http', status: 409, codigo: 'DUPLICADO', mensaje: 'El carnet ya existe' });
    expect(splitFormErrors(error, ['correo', 'carnet'])).toEqual({ fields: {}, general: ['El carnet ya existe'] });
  });
  it('conserva detalles de carnet como error de carnet', () => {
    const error = new ApiError({ kind: 'http', status: 409, codigo: 'DUPLICADO', mensaje: 'Ya existe', detalles: ['carnet: Ya registrado'] });
    expect(splitFormErrors(error, ['correo', 'carnet'])).toEqual({ fields: { carnet: 'Ya registrado' }, general: ['Ya existe'] });
  });
  it('conserva todos los detalles de un mismo campo', () => {
    const error = new ApiError({ kind: 'http', codigo: 'VALIDACION', mensaje: 'Datos inválidos', detalles: ['correo: Primero', 'correo: Segundo'] });
    expect(splitFormErrors(error, ['correo'])).toEqual({ fields: { correo: 'Primero\nSegundo' }, general: ['Datos inválidos'] });
  });
  it('no crea campos arbitrarios por claves de prototipo', () => {
    const error = new ApiError({ kind: 'http', codigo: 'VALIDACION', mensaje: 'Datos inválidos', detalles: ['__proto__: detalle', 'constructor: detalle'] });
    expect(splitFormErrors(error, ['correo'])).toEqual({ fields: {}, general: ['Datos inválidos', '__proto__: detalle', 'constructor: detalle'] });
  });
});
