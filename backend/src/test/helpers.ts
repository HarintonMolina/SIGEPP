import { prisma } from '../lib/prisma.js';

/** Vacía todas las tablas de la base de datos de prueba (excepto el historial de migraciones). */
export const limpiarBaseDatos = async () => {
  const tablas = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tablas.length === 0) return;
  const lista = tablas.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE`);
};
