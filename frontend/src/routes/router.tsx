import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router-dom';
import { routeCatalog, type PageKey } from './catalog';
import { LoadingState } from '../components/LoadingState';
import { ProtectedRoute, SessionDestination } from './ProtectedRoute';
import { ErrorPage } from './ErrorPage';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import { AppShell } from '../layouts/AppShell';
import { AuthLayout } from '../layouts/AuthLayout';

export type PageRegistry = Record<PageKey, () => Promise<{ default: ComponentType }>>;

export function createAppRouter(pages: PageRegistry): ReturnType<typeof createBrowserRouter> {
  const components = {
    login: lazy(pages.login), registro: lazy(pages.registro), inicio: lazy(pages.inicio),
    perfil: lazy(pages.perfil), modulo: lazy(pages.modulo),
  };
  const routes: RouteObject[] = routeCatalog.map((route) => {
    const base = { id: route.id, path: route.path, caseSensitive: true, handle: route };
    if (route.id === 'root') return { ...base, element: <SessionDestination root /> };
    if (route.id === 'forbidden' || route.id === 'not-found') {
      return { ...base, element: <ErrorPage code={route.id === 'forbidden' ? 403 : 404} /> };
    }
    const Page = components[route.page];
    const content = <Suspense fallback={<LoadingState label="Cargando página…" />}><Page /></Suspense>;
    if (route.roles === 'public') {
      return { ...base, element: <SessionDestination />, children: [{ element: <AuthLayout />, children: [{ index: true, element: content }] }] };
    }
    const redirect = route.redirectTo && routeCatalog.find((entry) => entry.id === route.redirectTo);
    return {
      ...base, element: <ProtectedRoute routeId={route.id} />,
      children: redirect
        ? [{ index: true, element: <Navigate to={redirect.path} replace /> }]
        : [{ element: <AppShell />, children: [{ index: true, element: content }] }],
    };
  });
  return createBrowserRouter([{ element: <Outlet />, errorElement: <RouteErrorBoundary />, children: routes }], { future: { v7_relativeSplatPath: true } });
}
