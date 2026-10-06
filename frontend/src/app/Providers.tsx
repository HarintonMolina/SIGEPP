import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AuthProvider } from '../features/auth/AuthProvider';
import { ToastProvider } from '../components/Toast';
import { RuntimeContext } from './RuntimeContext';
import type { AppRuntime } from './runtime';

export function Providers({ runtime, children }: { runtime: AppRuntime; children: ReactNode }) {
  return (
    <RuntimeContext.Provider value={runtime}>
      <QueryClientProvider client={runtime.queryClient}>
        <AuthProvider service={runtime.session}><ToastProvider>{children}</ToastProvider></AuthProvider>
      </QueryClientProvider>
    </RuntimeContext.Provider>
  );
}
