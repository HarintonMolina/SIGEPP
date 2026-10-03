export interface FrontendEnv {
  apiUrl: string;
  institutionalDomains: readonly string[];
}

export function readFrontendEnv(values: Record<string, string | undefined>): FrontendEnv {
  const apiUrl = values.VITE_API_URL?.trim() ?? '';
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(apiUrl);
  } catch {
    throw new Error('Configuración: VITE_API_URL debe ser una URL HTTP o HTTPS válida.');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
    throw new Error('Configuración: VITE_API_URL debe usar HTTP o HTTPS y no contener credenciales.');
  }

  const institutionalDomains = (values.VITE_DOMINIOS_INSTITUCIONALES ?? '')
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

  if (institutionalDomains.length === 0) {
    throw new Error('Configuración: VITE_DOMINIOS_INSTITUCIONALES debe incluir al menos un dominio.');
  }

  return {
    apiUrl: apiUrl.replace(/\/+$/, ''),
    institutionalDomains,
  };
}

export const env: FrontendEnv = readFrontendEnv({
  VITE_API_URL: import.meta.env.VITE_API_URL,
  VITE_DOMINIOS_INSTITUCIONALES: import.meta.env.VITE_DOMINIOS_INSTITUCIONALES,
});
