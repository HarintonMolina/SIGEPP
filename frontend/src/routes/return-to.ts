import type { Rol } from '../features/auth/contracts';
import { canAccess, findRoute, getHomePath } from './catalog';

const hasControlCharacters = (value: string) => Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);

// Only root-relative, known private destinations may enter navigation state.
// Restrict path parameters to unencoded URL-safe identifiers: this avoids
// disagreement between browser/Router decoding (including nested encodings).
export function getKnownPrivateReturnTo(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null;
  if (/[\\#\s]/.test(value) || hasControlCharacters(value)) return null;
  try {
    const origin = 'https://sigepp.invalid';
    const url = new URL(value, origin);
    const rawPath = value.split('?')[0];
    if (url.origin !== origin || url.pathname !== rawPath || !/^\/[a-zA-Z0-9/_-]+$/.test(rawPath) || rawPath.includes('//')) return null;
    const decodedQuery = decodeURIComponent(url.search);
    if (decodedQuery.includes('\\') || hasControlCharacters(decodedQuery) || /%[0-9a-f]{2}/i.test(decodedQuery)) return null;
    const route = findRoute(url.pathname);
    if (!route || route.roles === 'public') return null;
    return url.pathname + url.search;
  } catch {
    return null;
  }
}
export function getSafeReturnTo(value: unknown, rol: Rol): string {
  const destination = getKnownPrivateReturnTo(value);
  const route = destination ? findRoute(destination.split('?')[0]) : undefined;
  return destination && route && canAccess(route.id, rol) ? destination : getHomePath(rol);
}
