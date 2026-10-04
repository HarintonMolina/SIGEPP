import { useContext } from 'react';
import { RuntimeContext } from '../app/RuntimeContext';
import type { AppRuntime } from '../app/runtime';

export function useRuntime(): AppRuntime {
  const runtime = useContext(RuntimeContext);
  if (!runtime) throw new Error('useRuntime requiere Providers.');
  return runtime;
}
