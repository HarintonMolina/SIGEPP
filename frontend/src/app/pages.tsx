import type { PageRegistry } from '../routes/router';

export const pages: PageRegistry = {
  login: () => import('../features/auth/LoginPage'),
  registro: () => import('../features/auth/RegistroPage'),
  inicio: () => import('../features/inicio/InicioPage'),
  perfil: () => import('../features/perfil/PerfilPage'),
  modulo: () => import('../features/modulos/ModuloPage'),
};
