import { createContext } from 'react';
import type { AppRuntime } from './runtime';

export const RuntimeContext = createContext<AppRuntime | null>(null);
