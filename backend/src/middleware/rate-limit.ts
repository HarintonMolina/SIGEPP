import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const respuesta = (mensaje: string) => ({
  error: { codigo: 'DEMASIADAS_PETICIONES', mensaje, detalles: [] },
});

// En pruebas automatizadas se desactiva para no interferir con los casos de prueba.
const omitirEnPruebas = () => env.NODE_ENV === 'test';

/** RNF-08: 100 peticiones por minuto por dirección IP. */
export const limiteGeneral = rateLimit({
  windowMs: 60_000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: omitirEnPruebas,
  message: respuesta('Demasiadas peticiones, intenta de nuevo en un minuto'),
});

/** Límite adicional para los endpoints de autenticación, contra fuerza bruta distribuida. */
export const limiteAutenticacion = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: omitirEnPruebas,
  message: respuesta('Demasiados intentos, intenta de nuevo en 15 minutos'),
});

/** API pública de plazas (RF-26): 60 peticiones por minuto por dirección IP. */
export const limitePublico = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: omitirEnPruebas,
  message: respuesta('Límite de la API pública alcanzado, intenta de nuevo en un minuto'),
});
