import { NavLink } from 'react-router-dom';
import type { RouteDefinition } from '../routes/catalog';

export function Sidebar({ navigation }: { navigation: readonly RouteDefinition[] }) {
  return <aside className="hidden border-r border-border bg-surface p-4 lg:block">
    <p className="mb-6 text-xl font-bold text-primary">SIGEPP</p>
    <nav aria-label="Navegación principal" className="flex flex-col gap-2">
      {navigation.map((route) => <NavLink key={route.id} to={route.path} className={({ isActive }) => `flex min-h-[2.75rem] items-center rounded-control p-3 ${isActive ? 'bg-primary text-surface' : 'text-text hover:bg-background'}`}>{route.label}</NavLink>)}
    </nav>
  </aside>;
}
