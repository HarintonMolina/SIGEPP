import { execSync } from 'node:child_process';
import 'dotenv/config';

/** Aplica las migraciones a la base de datos de prueba antes de ejecutar las pruebas. */
export default function setup() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error('Define DATABASE_URL_TEST en backend/.env para ejecutar las pruebas');
  }
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
