import { describe, expect, it } from 'vitest';
import { readFrontendEnv } from './env';

describe('readFrontendEnv', () => {
  it('normaliza la barra final del API y los dominios institucionales', () => {
    expect(readFrontendEnv({
      VITE_API_URL: 'http://localhost:4000/api/v1/',
      VITE_DOMINIOS_INSTITUCIONALES: ' UNI.EDU.NI, std.uni.edu.ni ',
    })).toEqual({
      apiUrl: 'http://localhost:4000/api/v1',
      institutionalDomains: ['uni.edu.ni', 'std.uni.edu.ni'],
    });
  });

  it('rechaza variables obligatorias ausentes', () => {
    expect(() => readFrontendEnv({})).toThrow('Configuración');
  });

  it.each([
    'javascript:alert(1)',
    'ftp://localhost/api',
    'esto no es una URL',
    'https://usuario:clave@example.com/api',
  ])('rechaza un API inseguro o inválido: %s', (apiUrl) => {
    expect(() => readFrontendEnv({
      VITE_API_URL: apiUrl,
      VITE_DOMINIOS_INSTITUCIONALES: 'uni.edu.ni',
    })).toThrow('Configuración');
  });

  it.each([undefined, '', '   ', ', ,'])('rechaza una lista de dominios vacía: %s', (domains) => {
    expect(() => readFrontendEnv({
      VITE_API_URL: 'http://localhost:4000/api/v1',
      VITE_DOMINIOS_INSTITUCIONALES: domains,
    })).toThrow('Configuración');
  });

  it('admite HTTPS y omite entradas vacías en una lista configurada', () => {
    expect(readFrontendEnv({
      VITE_API_URL: 'https://api.example.com/api/v1',
      VITE_DOMINIOS_INSTITUCIONALES: 'uni.edu.ni, ,std.uni.edu.ni,',
    })).toEqual({
      apiUrl: 'https://api.example.com/api/v1',
      institutionalDomains: ['uni.edu.ni', 'std.uni.edu.ni'],
    });
  });
});
