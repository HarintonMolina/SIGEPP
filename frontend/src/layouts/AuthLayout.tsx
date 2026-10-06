import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4 sm:p-8">
    <header className="text-center"><p className="text-2xl font-bold text-primary">SIGEPP</p><p className="text-sm text-muted">Sistema de Gestión del Ejercicio y Prácticas Profesionales</p></header>
    <main className="w-full max-w-[32rem]"><Outlet /></main>
  </div>;
}
