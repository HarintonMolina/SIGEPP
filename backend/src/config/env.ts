import 'dotenv/config';
import { z } from 'zod';

const esquemaEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  DATABASE_URL_TEST: z.string().url().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  DOMINIOS_INSTITUCIONALES: z
    .string()
    .default('uni.edu.ni')
    .transform((valor) =>
      valor
        .split(',')
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean),
    ),
  BCRYPT_COST: z.coerce.number().int().min(12).default(12),
});

const resultado = esquemaEnv.safeParse(process.env);

if (!resultado.success) {
  console.error('Variables de entorno inválidas:', resultado.error.flatten().fieldErrors);
  process.exit(1);
}

// En pruebas se trabaja sobre una base de datos aparte para no borrar los datos de desarrollo.
if (resultado.data.NODE_ENV === 'test' && resultado.data.DATABASE_URL_TEST) {
  resultado.data.DATABASE_URL = resultado.data.DATABASE_URL_TEST;
  process.env.DATABASE_URL = resultado.data.DATABASE_URL_TEST;
}

export const env = resultado.data;
export const esProduccion = env.NODE_ENV === 'production';
