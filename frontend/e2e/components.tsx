import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '../src/styles/tokens.css';
import '../src/styles/global.css';
import { Button } from '../src/components/Button';
import { Badge } from '../src/components/Badge';
import { Tabla, type SortState } from '../src/components/Tabla';
import { Paginador } from '../src/components/Paginador';
import { Modal } from '../src/components/Modal';
import { ToastProvider } from '../src/components/Toast';
import { useToast } from '../src/hooks/useToast';
import { Select } from '../src/components/Select';

export function Components() {
  const [open, setOpen] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [sort, setSort] = useState<SortState>();
  const [empty, setEmpty] = useState(false);
  const [selection, setSelection] = useState('a');
  const [pendingToast, setPendingToast] = useState(false);
  const [closeRequests, setCloseRequests] = useState(0);
  const { notify } = useToast();
  useEffect(() => {
    if (!pendingToast) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      if (!document.querySelector('[role="listbox"]')) return;
      observer.disconnect();
      timer = setTimeout(() => {
        notify({ title: 'Aviso posterior al Select', description: 'La lista ya estaba montada antes de este aviso', tone: 'informacion' });
        setPendingToast(false);
      }, 0);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); if (timer !== undefined) clearTimeout(timer); };
  }, [pendingToast, notify]);
  return <main className="mx-auto grid max-w-[64rem] gap-4 p-4">
    <h1 className="text-2xl">Componentes reales S1</h1>
    <section aria-label="Variantes visuales" className="flex flex-wrap gap-4">
      <Button variant="primario">Variante Button primario</Button>
      <Button variant="secundario">Variante Button secundario</Button>
      <Button variant="peligro">Variante Button peligro</Button>
      <Button variant="fantasma">Variante Button fantasma</Button>
      <Badge tone="exito" label="Variante Badge éxito" />
      <Badge tone="advertencia" label="Variante Badge advertencia" />
      <Badge tone="error" label="Variante Badge error" />
      <Badge tone="informacion" label="Variante Badge información" />
    </section>
    <Tabla caption="Resultados" rows={empty ? [] : [{ id: 'fila-unica', texto: 'X'.repeat(120) }]} getRowId={row => row.id}
      columns={[{ id: 'nombre', header: 'Nombre', sortable: true, render: row => <span id={row.id}>{row.texto}</span> }]}
      sort={sort} onSortChange={setSort} empty={<p role="status">Sin resultados</p>} />
    <Button onClick={() => setEmpty(value => !value)}>Alternar filas vacías</Button>
    <Paginador pagina={pagina} totalPaginas={empty ? 0 : 3} onPageChange={setPagina} />
    <Button onClick={() => notify({ title: 'Aviso de prueba', description: 'Y'.repeat(120), tone: 'informacion' })}>Mostrar aviso</Button>
    <output aria-label="Solicitudes de cierre">{closeRequests}</output>
    <Modal open={open} onOpenChange={value => { setOpen(value); if (!value) setCloseRequests(count => count + 1); }} title="Diálogo de prueba" description={'Descripción '.repeat(12)} trigger={<Button>Abrir diálogo</Button>}>
      <p>{'Z'.repeat(120)}</p>
      <Button onClick={() => notify({ title: 'Aviso superpuesto', description: 'Diagnóstico de Escape con Modal abierto', tone: 'informacion' })}>Mostrar aviso dentro del diálogo</Button>
      <Button onClick={() => setPendingToast(true)}>{pendingToast ? 'Aviso programado para la lista' : 'Programar aviso al abrir Select'}</Button>
      <Select label="Selección de prueba" value={selection} onValueChange={setSelection} options={[{ value: 'a', label: 'Opción A' }, { value: 'b', label: 'Opción B' }]} />
    </Modal>
  </main>;
}
if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<ToastProvider><Components /></ToastProvider>);
