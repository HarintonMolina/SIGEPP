import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    env: {
      VITE_API_URL: 'http://localhost:4000/api/v1',
      VITE_DOMINIOS_INSTITUCIONALES: 'uni.edu.ni,std.uni.edu.ni',
    },
  },
});
