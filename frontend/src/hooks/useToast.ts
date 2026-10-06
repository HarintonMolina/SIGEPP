import { createContext, useContext } from 'react';

export interface ToastInput { title: string; description?: string; tone: 'exito' | 'error' | 'informacion' }
export interface ToastService { notify(input: ToastInput): void }
export const ToastContext = createContext<ToastService | null>(null);

export function useToast(): ToastService {
  const service = useContext(ToastContext);
  if (!service) throw new Error('useToast requiere ToastProvider');
  return service;
}
