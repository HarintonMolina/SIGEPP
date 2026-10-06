import { test, expect } from '@playwright/test';
import { apiURL } from './fixtures';
test('limitador IP real: intento 21 recibe DEMASIADAS_PETICIONES', async ({ request }) => {
  for (let index = 1; index <= 21; index += 1) {
    const response = await request.post(`${apiURL}/auth/login`, { data: { correo: 'inexistente@uni.edu.ni', contrasena: 'Incorrecta2026' } });
    expect(response.status()).toBe(index <= 20 ? 401 : 429);
    if (index === 21) expect((await response.json()).error.codigo).toBe('DEMASIADAS_PETICIONES');
  }
});
