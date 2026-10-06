import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { findRoute, getNavigation } from '../routes/catalog';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';

export function AppShell() {
  const { snapshot } = useSession();
  const location = useLocation();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    // Run after dialog close autofocus when a navigation originated in Más.
    const frame = requestAnimationFrame(() => heading.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [location.key]);
  if (snapshot.status !== 'autenticada') return null;
  const navigation = getNavigation(snapshot.usuario.rol);
  const route = findRoute(location.pathname);
  return <div className="min-h-screen lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
    <a href="#contenido-principal" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-control focus:bg-surface focus:p-3 focus:text-primary" onClick={() => heading.current?.focus()}>Saltar al contenido</a>
    <Sidebar navigation={navigation} />
    <div className="flex min-h-screen min-w-0 flex-col">
      <Topbar usuario={snapshot.usuario} />
      <main id="contenido-principal" tabIndex={-1} aria-labelledby="titulo-pagina" className="min-w-0 flex-1 p-4 sm:p-6">
        <h1 id="titulo-pagina" ref={heading} tabIndex={-1} className="mb-6 text-2xl font-bold">{route?.label}</h1>
        <Outlet />
      </main>
      <MobileNav key={location.pathname} navigation={navigation} />
    </div>
  </div>;
}
