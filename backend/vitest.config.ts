import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: { NODE_ENV: 'test' },
    globalSetup: ['src/test/global-setup.ts'],
    // bcrypt con costo 12 (RNF-05) tarda varios cientos de milisegundos por operación
    testTimeout: 30_000,
    // Las pruebas de integración comparten la misma base de datos de prueba
    fileParallelism: false,
  },
});
