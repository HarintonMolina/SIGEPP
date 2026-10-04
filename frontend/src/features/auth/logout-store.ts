import type { LogoutStore } from './session.types';

const KEY = 'sigepp.logoutPending';

export function createLogoutStore(storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>): LogoutStore {
  let pending = false;
  let persistent = true;
  try {
    storage ??= globalThis.sessionStorage;
    if (!storage) persistent = false;
  } catch {
    persistent = false;
  }
  return {
    read() {
      if (persistent && storage) {
        try { pending = storage.getItem(KEY) === 'true'; }
        catch { persistent = false; }
      }
      return pending;
    },
    write(value) {
      pending = value;
      if (persistent && storage) {
        try {
          if (value) storage.setItem(KEY, 'true');
          else storage.removeItem(KEY);
        } catch { persistent = false; }
      }
    },
    isPersistent: () => persistent,
  };
}
