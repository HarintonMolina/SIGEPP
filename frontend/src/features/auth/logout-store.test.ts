import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLogoutStore } from './logout-store';

afterEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); });

describe('marcador de cierre pendiente', () => {
  it('persiste solo el booleano y otra instancia lo lee', () => {
    const store = createLogoutStore(sessionStorage);
    store.write(true);
    expect(sessionStorage.getItem('sigepp.logoutPending')).toBe('true');
    expect(createLogoutStore(sessionStorage).read()).toBe(true);
    store.write(false);
    expect(sessionStorage.getItem('sigepp.logoutPending')).toBeNull();
    expect(store.read()).toBe(false);
  });

  it('usa sessionStorage por defecto', () => {
    createLogoutStore().write(true);
    expect(sessionStorage.getItem('sigepp.logoutPending')).toBe('true');
  });

  it.each(['getItem', 'setItem', 'removeItem'] as const)('tolera SecurityError en %s y mantiene bloqueo en memoria', (method) => {
    const storage = {
      getItem: vi.fn(() => 'true'), setItem: vi.fn(), removeItem: vi.fn(),
    };
    storage[method].mockImplementation(() => { throw new DOMException('Bloqueado', 'SecurityError'); });
    const store = createLogoutStore(storage);
    store.read();
    store.write(true);
    expect(store.read()).toBe(true);
    store.write(false);
    expect(store.read()).toBe(false);
    expect(store.isPersistent()).toBe(false);
  });

  it('tolera que acceder a sessionStorage lance SecurityError', () => {
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new DOMException('Bloqueado', 'SecurityError'); });
    const store = createLogoutStore();
    store.write(true);
    expect(store.read()).toBe(true);
    expect(store.isPersistent()).toBe(false);
  });
});
