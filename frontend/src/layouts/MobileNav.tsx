import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import type { RouteDefinition } from '../routes/catalog';

export function MobileNav({ navigation }: { navigation: readonly RouteDefinition[] }) {
  const [open, setOpen] = useState(false);
  return <nav aria-label="Navegación móvil" className="sticky bottom-0 grid grid-cols-4 gap-1 border-t border-border bg-surface p-2 lg:hidden">
    {navigation.slice(0, 3).map((route) => <NavLink key={route.id} to={route.path} className={({ isActive }) => `flex min-h-[2.75rem] min-w-0 items-center justify-center rounded-control p-2 text-center text-sm ${isActive ? 'bg-primary text-surface' : 'text-primary'}`}>{route.label}</NavLink>)}
    <Modal open={open} onOpenChange={setOpen} title="Más opciones" description="Accede a las demás secciones de tu cuenta." trigger={<Button variant="fantasma">Más</Button>}>
      <div className="flex flex-col gap-2">
        {navigation.slice(3).map((route) => <NavLink key={route.id} to={route.path} onClick={() => setOpen(false)} className="flex min-h-[2.75rem] items-center rounded-control p-3 text-primary underline">{route.label}</NavLink>)}
      </div>
    </Modal>
  </nav>;
}
