export function App(): JSX.Element {
  return (
    <>
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <main id="contenido" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
        <section className="rounded-card border border-border bg-surface p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-primary">SIGEPP</h1>
          <p className="mt-3 text-lg">Sistema de Gestión del Ejercicio y Prácticas Profesionales</p>
          <p className="mt-4 text-muted">Universidad Nacional de Ingeniería</p>
        </section>
      </main>
    </>
  );
}
