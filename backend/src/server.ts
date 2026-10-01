import { crearApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';

const app = crearApp();

const servidor = app.listen(env.PORT, () => {
  console.info(`SIGEPP API escuchando en http://localhost:${env.PORT}`);
});

const apagar = async (senal: string) => {
  console.info(`${senal} recibido, cerrando el servidor...`);
  servidor.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGINT', () => void apagar('SIGINT'));
process.on('SIGTERM', () => void apagar('SIGTERM'));
