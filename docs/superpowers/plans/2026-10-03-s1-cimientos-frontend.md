# S1 Cimientos del frontend de SIGEPP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar S1-H1…H6: registro institucional, login de los seis roles, restauración y cierre de sesión, navegación protegida y componentes base contra el API real.

**Architecture:** Un servicio de sesión independiente de React controla token en memoria, generación de identidad, versión de token y serialización de operaciones auth. Un transporte sin autenticación, un cliente protegido y TanStack Query separan HTTP, recuperación de 401 y caché. Contexto, formularios y AppShell consumen esos contratos y un único catálogo de permisos/rutas.

**Tech Stack:** React 18.3, Vite 8.3, TypeScript 5 estricto, Tailwind 3.4, React Router 6.30, TanStack Query 5, React Hook Form 7, Zod 3, Radix, ESLint 9, Vitest, Testing Library y Playwright; Node 22 desde 22.12.

**Spec:** [Especificación aprobada](../specs/2026-10-03-s1-cimientos-frontend-design.md). Es obligatoria junto con este plan; sus tablas de campos, rutas, tokens y discrepancias son normativas.

**Estado:** especificación aprobada; plan pendiente de revisión humana y elección del método de ejecución. Todas las casillas siguientes están sin ejecutar. No se ha creado `frontend/` ni instalado dependencias para elaborar el plan.

## Global Constraints

- Alcance: S1-H1 a S1-H6, RF-01, RF-02 y RF-04; no cambiar contratos, código de negocio, migraciones ni esquema del backend.
- Base del API: `http://localhost:4000/api/v1`. Origen de la SPA: `http://localhost:5173`; Vite con `strictPort: true`, sin cambiar a otro puerto automáticamente.
- React 18 permanece con StrictMode; Node rama 22, mínimo 22.12; versiones mayores y menores fijadas según la especificación y parches exactos en el lock. El ajuste Vite 5 → 8.3 se documenta.
- Token, usuario y caché privada permanecerán en memoria: no se persistirán en localStorage, sessionStorage, URL ni logs. La excepción es únicamente el booleano `sigepp.logoutPending` en sessionStorage.
- Registro solo ESTUDIANTE y TUTOR_ACADEMICO; `201 { usuario }` no inicia sesión. Login acepta los seis roles, incluidos correos empresariales. Contraseñas sin trim.
- Cookies incluidas en auth; solo primer 401 protegido admite recuperación, con una sola repetición. Login, registro, refresh y logout nunca renuevan automáticamente; `/auth/yo` sí puede hacerlo.
- Una renovación compartida por instancia/pestaña; no prometer coordinación entre pestañas, revocación inmediata de JWT ni recuperación transparente de una cookie rotada cuya respuesta se perdió.
- Query: `retry: false` en consultas y mutaciones; sin repetición por foco/reconexión; cancelación conectada a AbortSignal y limpieza al cambiar de sesión.
- Módulos futuros: «Esta sección aún no está disponible», sin consultas ni datos ficticios. Inicio y perfil usan identidad real; sin recuperación de contraseña, campana ficticia ni acciones de S2/S3.
- Inter local con Arial/sans-serif; colores, escala 12/14/16/20/24/32 px en rem, espaciado 4/8/12/16/24/32/48 px y radios 6/8 px exactos de la especificación.
- Móvil menor a 640 px, tableta de 640 a 1024 px y escritorio mayor a 1024 px; operable desde 360 px y con ampliación al 200 %; objetivos móviles de 44 px y foco de 2 px.
- JavaScript inicial de `/login` en producción: suma gzip de archivos JS únicos solicitados hasta quedar interactivo, máximo 250 000 bytes. CSS, fuentes, mapas y módulos no solicitados se informan aparte.
- Demo y E2E con API/PostgreSQL reales. Dobles de transporte solo en pruebas unitarias/componentes; no se integran fixtures en el producto.
- Git: conservar `feature/RF-01-cimientos-frontend`; Conventional Commits en español; futura revisión hacia `develop`. No hacer merge ni atribuir aprobación al compañero.
- En PowerShell, comprobar `$LASTEXITCODE` entre comandos dependientes. No usar `db:reset`; las suites destructivas existentes nunca apuntan a la base de demo.

## Review Focus

1. Respuesta HTML, JSON malformado o 204 sin cuerpo: mostrar error legible o devolver vacío, sin lanzar errores de parseo sin controlar. Pruebas en T2.
2. sessionStorage ausente o lanzando SecurityError: logout local sigue funcionando y comunica el límite al recargar. Pruebas en T4 y T9.
3. JWT renovado idéntico al anterior y 401 tardío: contar versiones, renovar una vez y no borrar una sesión más nueva. Pruebas en T4/T5.
4. Destino de retorno externo, con barras invertidas/codificadas o permitido solo a otro rol: navegar al inicio válido sin redirección abierta. Pruebas en T8.
5. Texto largo, perfiles null y cero resultados a 360 px: no romper el layout, inventar datos ni ofrecer páginas inexistentes. Pruebas en T6/T7/T9 y recorrido visual T10.

---

## Mapa de archivos y dependencias

Todas las rutas de este documento son relativas a la raíz del repositorio. No se creará código fuera de `frontend/`; los únicos cambios adicionales son documentación y exclusiones de artefactos en `.gitignore`. Se sigue la configuración de formato de la raíz.

| Área | Archivos y responsabilidad | Tarea |
|---|---|---|
| Paquete | `frontend/package.json`, `package-lock.json`, `index.html`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `eslint.config.js`, `tailwind.config.ts`, `postcss.config.js`, `.env.example` | T1 |
| Arranque y estilo | `frontend/src/main.tsx`, `app/App.tsx`, `config/env.ts`, `vite-env.d.ts`, `styles/tokens.css`, `styles/global.css`, `test/setup.ts` | T1 |
| Transporte y contrato | `frontend/src/api/errors.ts`, `transport.ts`, `features/auth/contracts.ts`, `auth-api.ts`, `test/fixtures.ts`, `test/deferred.ts` | T2 |
| Formularios | `frontend/src/features/auth/schemas.ts`, `form-errors.ts` | T3 |
| Sesión | `frontend/src/features/auth/session.ts`, `session.types.ts`, `logout-store.ts` | T4 |
| Integración | `frontend/src/api/client.ts`, `query-client.ts`, `app/runtime.ts`, `app/RuntimeContext.ts`, `app/Providers.tsx`, `features/auth/AuthProvider.tsx`, `hooks/useSession.ts`, `hooks/useRuntime.ts` | T5 |
| Controles | `frontend/src/components/Button.tsx`, `Input.tsx`, `Select.tsx`, `Textarea.tsx`, `Card.tsx`, `Badge.tsx`, `EmptyState.tsx`, `LoadingState.tsx`, `ErrorState.tsx`, `field.types.ts` | T6 |
| Interacciones | `frontend/src/components/Modal.tsx`, `Toast.tsx`, `Tabla.tsx`, `Paginador.tsx`, `hooks/useToast.ts` | T7 |
| Navegación | `frontend/src/routes/permissions.ts`, `catalog.ts`, `return-to.ts`, `ProtectedRoute.tsx`, `router.tsx`, `ErrorPage.tsx`, `RouteErrorBoundary.tsx`; `layouts/AuthLayout.tsx`, `AppShell.tsx`, `Sidebar.tsx`, `Topbar.tsx`, `MobileNav.tsx` | T8 |
| Páginas reales | `frontend/src/features/auth/LoginPage.tsx`, `RegistroPage.tsx`, `auth-hooks.ts`; `features/inicio/InicioPage.tsx`; `features/perfil/PerfilPage.tsx`, `usePerfil.ts`; `features/modulos/ModuloPage.tsx`; `app/pages.tsx` | T8 crea solo useLogout en auth-hooks; T9 lo amplía y crea páginas |
| Verificación real | `frontend/playwright.config.ts`, `playwright.production.config.ts`, `scripts/e2e.mjs`, `scripts/check-initial-size.mjs`, `e2e/fixtures.ts`, `e2e/components.html`, `e2e/components.tsx`, `e2e/auth.spec.ts`, `e2e/session.spec.ts`, `e2e/navigation.spec.ts`, `e2e/accessibility.spec.ts`, `e2e/initial-size.spec.ts`, `e2e/rate-limit.spec.ts` | T10 |
| Documentación | `README.md`, `docs/fase-2/plan-de-sprints.md`, `docs/fase-2/s1-frontend-demo.md`, `docs/fase-2/s1-frontend-verificacion.md`, `.gitignore` | T1/T10 |

Las pruebas unitarias se colocan junto al módulo (`*.test.ts` o `*.test.tsx`); cada tarea enumera sus nombres exactos. Las utilidades de prueba no se importan desde código productivo.

Orden de ejecución: T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10. T3 y T6/T7 podrían trabajarse después de sus prerrequisitos con propietarios separados si se elige subagentes; nadie modifica archivos de integración compartidos en paralelo. La ruta conservadora es secuencial.

| Historia | Implementación | Cierre verificable |
|---|---|---|
| S1-H1 | T1 | Instalación, tipos, lint y build; tamaño medido en T10. |
| S1-H2 | T6 y T7 | Controles y estados; teclado, foco, anuncios y 360 px en T10. |
| S1-H3 | T8 y T9 | Seis menús y shell móvil con identidad real; navegación E2E en T10. |
| S1-H4 | T8 | Catálogo, guardas, lazy, 403/404 y retorno seguro; accesos directos E2E en T10. |
| S1-H5 | T2, T4 y T5 | Transporte, sesión, concurrencia y limpieza; cookies/expiración reales en T10. |
| S1-H6 | T3 y T9 | Formularios y perfil; registro de ambos roles y seis logins reales en T10. |

## Preparación de la ejecución

- [ ] Tras aprobación del plan y elección del método, leer la skill de ejecución seleccionada y `superpowers:using-git-worktrees`; inspeccionar adjuntos y usar aislamiento adecuado desde la rama y commit que contienen este plan, nunca desde un `develop` anterior al backend auditado. La skill determina si reutilizar o crear worktree; esta preparación no se ejecuta durante planificación.
- [ ] Confirmar `git status --short`, `git branch --show-current`, `node --version` y `npm --version`. Conservar cambios ajenos; registrar el commit de partida. Los comandos posteriores se ejecutan en ese checkout.
- [ ] Leer `superpowers:test-driven-development` antes del primer comportamiento; conservar evidencia RED → GREEN en los casos críticos. Una dependencia o configuración rota no cuenta como fallo conductual demostrado: corregir el entorno y repetir la prueba.

## T1 — Paquete reproducible y tokens de Fase 1

**Files:** crear los archivos de T1 del mapa; crear `frontend/src/config/env.test.ts`. Modificar `.gitignore` para `frontend/test-results/`, `frontend/playwright-report/` y `frontend/.e2e/`.

**Interfaces:** `readFrontendEnv(values: Record<string, string | undefined>): FrontendEnv`, donde `FrontendEnv = { apiUrl: string; institutionalDomains: readonly string[] }`. `env.ts` exporta también `env: FrontendEnv` para el runtime. `App(): JSX.Element` será inicialmente una portada mínima, sustituida por los proveedores/router en T9; no usa usuarios simulados.

- [ ] **1. Configurar el paquete y el runner.** Consultar engines/peerDependencies antes de fijar parches compatibles de las versiones de la especificación. Dependencias adicionales: `@fontsource/inter` local, `@hookform/resolvers` compatible con RHF7/Zod3, paquetes Radix select/dialog/toast y `lucide-react` para iconos. Para tests: Vitest compatible con Vite8, jsdom, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `@playwright/test` y `@axe-core/playwright`. Vitest incluye solo `src/**/*.test.{ts,tsx}`, usa jsdom, jest-dom y cleanup en setup, y suministra las dos variables públicas de ejemplo en su entorno antes de importar módulos. No descubre suites Playwright. Guardar lock mediante instalación normal, sin `--force` ni `--legacy-peer-deps`; registrar desviaciones antes de cambiar una versión mayor aprobada.
- [ ] **2. Escribir `env.test.ts`.** Probar normalización y fallos de configuración con las siguientes aserciones.

```ts
expect(readFrontendEnv({ VITE_API_URL: 'http://localhost:4000/api/v1/',
  VITE_DOMINIOS_INSTITUCIONALES: ' UNI.EDU.NI, std.uni.edu.ni ' }))
  .toEqual({ apiUrl: 'http://localhost:4000/api/v1',
    institutionalDomains: ['uni.edu.ni', 'std.uni.edu.ni'] });
expect(() => readFrontendEnv({})).toThrow('Configuración');
expect(() => readFrontendEnv({ VITE_API_URL: 'javascript:alert(1)',
  VITE_DOMINIOS_INSTITUCIONALES: 'uni.edu.ni' })).toThrow('Configuración');
```

- [ ] **3. Ejecutar RED:** desde `frontend`, `npm test -- src/config/env.test.ts`. Debe fallar por contrato no implementado; el runner debe iniciar correctamente.
- [ ] **4. Implementar configuración, entrada y estilos.** Validar URL HTTP(S) sin credenciales y lista de dominios no vacía; mensajes en español. `index.html` con `lang="es"`. Vite `host: 'localhost', port: 5173, strictPort: true`. TS `strict: true`, sin emit para typecheck; tests incluidos en revisión de tipos. Tailwind usa variables CSS de tokens; colores exactos de especificación, fuentes 400/500/600/700 locales. Breakpoint escritorio desde 1025 px; estilos de foco, movimiento reducido y texto largo. No escribir tests que solo repitan valores de CSS/configuración.
- [ ] **5. Definir y ejecutar scripts:** `dev` = `vite`; `build` = `npm run typecheck && vite build`; `typecheck` = `tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json`; `lint` = `eslint .`; `test` = `vitest run`; `test:watch` = `vitest`. tsconfig de aplicación incluye src, tests y futuro e2e; tsconfig.node revisa las configuraciones TS con tipos Node. `npm ci`, prueba de env, typecheck, lint y build deben salir con código 0. Resolver advertencias de dependencias pares.
- [ ] **6. Registrar:** `git add -- frontend .gitignore` y commit `chore(frontend): preparar Vite React y tokens institucionales (S1-H1)`, después de inspeccionar que no incluya artefactos ni secretos.

## T2 — Transporte HTTP y contratos públicos

**Files:** crear archivos de T2 del mapa, `frontend/src/api/transport.test.ts`, `frontend/src/features/auth/auth-api.test.ts` y `contracts.test.ts`.

**Interfaces:** las estructuras de `Usuario`, `Rol`, `RegistroInput`, `LoginInput` y `SesionResponse = { accessToken: string; usuario: Usuario }` reproducen las secciones 4 y 6 de la especificación, incluidos perfiles null y `porcentajeAvance: string`. `RegistroInput` excluye confirmación. Exportar schemas de respuesta Zod y `ROLES` como tupla de los seis roles.

```ts
type ApiErrorKind = 'http' | 'network' | 'invalid-response' | 'stale-session';
// ApiError extends Error: kind, status: number | null, codigo: string, detalles: string[].
// Constructor: { kind: ApiErrorKind; status?: number; codigo: string;
//   mensaje: string; detalles?: string[] }; mensaje alimenta Error.message.
type RequestOptions = { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  json?: unknown; signal?: AbortSignal; headers?: Record<string, string>;
  credentials?: RequestCredentials };
type Transport = { request<T>(path: string, options?: RequestOptions): Promise<T> };
createTransport(config: FrontendEnv, fetchImpl?: typeof fetch): Transport;
type AuthApi = {
  registro(input: RegistroInput): Promise<Usuario>;
  login(input: LoginInput): Promise<SesionResponse>;
  refresh(): Promise<SesionResponse>;
  logout(): Promise<void>;
};
createAuthApi(transport: Transport): AuthApi;
```

- [ ] **1. Crear fixtures y pruebas RED.** `makeUsuario(rol: Rol = 'ESTUDIANTE', overrides?: Partial<Usuario>): Usuario` y `makeSesionResponse(rol?: Rol, accessToken?: string): SesionResponse` usan datos ficticios solo de prueba. `deferred<T>()` devuelve `{ promise, resolve, reject }` para ordenar respuestas sin sleeps. Probar:

| Preparación y nombre de caso | Aserción literal esperada |
|---|---|
| `logout 204 no parsea JSON` — fetch devuelve Response sin cuerpo, status 204 | `expect(await api.logout()).toBeUndefined()` |
| `error uniforme conserva detalles` — 400 con código VALIDACION y detalle `correo: Correo no válido` | `expect(error).toMatchObject({ status: 400, codigo: 'VALIDACION', detalles: ['correo: Correo no válido'] })` |
| `HTML o JSON incompleto` — 502 con HTML y 200 con `{` | `expect(error.kind).toBe('invalid-response')`; conservar status recibido, mensaje en español. |
| `red y cancelación distintas` — TypeError frente a AbortError | Red produce kind `network`; `expect(aborted.name).toBe('AbortError')`. |
| `auth no renueva ni reintenta` — login devuelve 401 | `expect(fetchMock).toHaveBeenCalledTimes(1)` y credentials `include`. |
| `contrato usuario` — perfiles null y avance `'92'`; otro caso con rol desconocido | `expect(usuarioSchema.safeParse(valid).success).toBe(true)`; rol desconocido produce `false`. |

- [ ] **2. Ejecutar RED:** `npm test -- src/api/transport.test.ts src/features/auth/auth-api.test.ts src/features/auth/contracts.test.ts`.
- [ ] **3. Implementar `errors.ts` y `transport.ts`.** Admitir únicamente paths relativos al API previsto, JSON serializable y AbortSignal. No adjuntar tokens automáticamente. No leer JSON en 204; no convertir abortos en fallos de red. Sin importaciones de React, sesión, Prisma ni Query. No registrar bodies, credenciales o tokens.
- [ ] **4. Implementar schemas/tipos y `createAuthApi`.** Las cuatro funciones usan transporte con cookies incluidas y parsean la respuesta esperada; fallos de schema se convierten a `invalid-response`. No hay interceptor dentro de auth-api ni llamadas protegidas de perfil en este archivo.
- [ ] **5. Ejecutar GREEN** con el mismo comando y typecheck/lint. Comprobar que los 401 auth no invocan refresh y que solo se emite una petición por operación.
- [ ] **6. Commit:** `feat(api): definir transporte y contratos de autenticacion (S1-H5)` con los archivos de esta tarea y sus tests.

## T3 — Validaciones y payloads de registro y login

**Files:** crear `frontend/src/features/auth/schemas.ts`, `schemas.test.ts`, `form-errors.ts`, `form-errors.test.ts`.

**Interfaces:** `createRegistroFormSchema(domains: readonly string[])` devuelve el schema Zod de la unión discriminada por rol, con `confirmacion`. Exportar `RegistroFormValues` como entrada Zod y `RegistroFormParsed` como salida Zod de ese schema, manteniendo explícita la conversión del año; `toRegistroInput(values: RegistroFormParsed): RegistroInput` elimina confirmación y opcionales vacíos. El submit de RHF entrega la salida validada, no valores crudos. `loginFormSchema` produce `LoginInput`. `splitFormErrors(error: ApiError, allowedFields: readonly string[]): { fields: Record<string, string>; general: string[] }` no interpreta claves fuera de esa lista.

- [ ] **1. Escribir casos RED con fixtures locales completos de ambos roles.** Los ejemplos válidos usan nombres `Ana Lucía`, apellidos `Pérez Gómez`, contraseña `Segura2026`, carnet `2022-0802U`, carrera/departamento `Ingeniería en Sistemas` y año 5. Las reglas exactas se copian de la tabla de campos de la especificación, sin fortalecerlas.

```ts
expect(schema.parse({ ...estudiante, correo: ' ANA@STD.UNI.EDU.NI ',
  carnet: ' 2022-0802u ' }).carnet).toBe('2022-0802U');
expect(toRegistroInput({ ...docente, telefono: ' ', especialidad: '' }))
  .not.toHaveProperty('telefono');
expect(toRegistroInput(docente)).not.toHaveProperty('confirmacion');
expect(schema.safeParse({ ...estudiante, confirmacion: 'Distinta2026' }).success).toBe(false);
expect(schema.safeParse({ ...docente, correo: 'a@eviluni.edu.ni' }).success).toBe(false);
expect(loginFormSchema.parse({ correo: 'rrhh@empresa.example', contrasena: 'x' }))
  .toEqual({ correo: 'rrhh@empresa.example', contrasena: 'x' });
```

- [ ] **2. Completar límites en las mismas suites:** nombres 1/2/80/81, contraseña 7/8/72/73 y ausencia de letra o dígito; año 0/1/5/6/fracción; carnet incorrecto; departamento/carrera 2/3/100/101; teléfono válido/vacío/inválido; especialidad 100/101. Verificar exclusión de especialidad vacía y campos del rol anterior. Para errores, `correo: ...` se asocia a correo; detalles desconocidos, sin separador o con varios `:` permanecen legibles sin crear campos arbitrarios; duplicado de carnet no se atribuye a correo.
- [ ] **3. Ejecutar RED:** `npm test -- src/features/auth/schemas.test.ts src/features/auth/form-errors.test.ts`.
- [ ] **4. Implementar schemas, serializador y partición de errores.** Usar dominio exacto tras normalización, mismo allowlist para ambos roles. Contraseña sin trim; confirmar únicamente en el cliente. Los campos numéricos se convierten de forma compatible con RHF y se envían como enteros. Mensajes de validación en español.
- [ ] **5. Ejecutar GREEN** y typecheck. No importar schema backend con extensiones OpenAPI al bundle.
- [ ] **6. Commit:** `feat(auth): validar registro institucional y credenciales (S1-H6)`.

## T4 — Servicio de sesión independiente de React

**Files:** crear `frontend/src/features/auth/session.types.ts`, `session.ts`, `session.test.ts`, `logout-store.ts`, `logout-store.test.ts`.

**Interfaces:** `SessionSnapshot` es una unión discriminada por `status` (`restaurando`, `autenticada`, `anonima`, `errorRecuperable`), con `usuario` solo no nulo en autenticada, `error: ApiError | null`, `generation`, `tokenVersion`, `logoutPending` y `logoutPersistenceAvailable`. Ningún snapshot expone el token. `SessionIdentity = { generation: number; tokenVersion: number }`; `SessionAccess = SessionIdentity & { accessToken: string }`.

```ts
type LogoutStore = { read(): boolean; write(pending: boolean): void; isPersistent(): boolean };
createLogoutStore(storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>): LogoutStore;
type SessionService = {
  getSnapshot(): SessionSnapshot;
  subscribe(listener: () => void): () => void;
  getAccess(): SessionAccess | null;
  initialize(): Promise<void>;
  retryRestore(): Promise<void>;
  login(input: LoginInput): Promise<void>;
  refresh(expected: SessionIdentity): Promise<SessionAccess>;
  invalidate(expected: SessionIdentity): Promise<void>;
  logout(): Promise<void>;
};
createSessionService(deps: { api: AuthApi; logoutStore: LogoutStore;
  onInvalidate: () => Promise<void> }): SessionService;
```

`initialize` y `retryRestore` resuelven después de publicar su estado, también ante errores HTTP/red; no dejan rechazos sin manejar en efectos. Login, refresh y logout sí rechazan con ApiError para sus consumidores. `invalidate` no hace nada si generación o versión ya cambiaron. El snapshot conserva referencia entre cambios, como exige `useSyncExternalStore`.

- [ ] **1. Crear suites RED usando `deferred` y AuthApi falso tipado.** En `session.test.ts` definir `createSessionHarness()` que devuelve `{ session, api, logoutStore, onInvalidate }` con métodos `vi.fn` y sin React. Probar la matriz siguiente; no usar temporizadores arbitrarios para ordenar promesas.

| Caso y preparación | Aserción principal |
|---|---|
| Dos initialize durante y después de bootstrap anónimo | `expect(api.refresh).toHaveBeenCalledTimes(1)`; estado `anonima`. |
| Bootstrap 200, 401, 403, 429, 500 y fallo de red | Estados respectivamente `autenticada`, `anonima`, `anonima`, `errorRecuperable`, `errorRecuperable`, `errorRecuperable`; 403 conserva mensaje. |
| Varios refresh de la misma identidad | Un api.refresh; todos obtienen misma versión nueva. |
| Dos respuestas con igual accessToken | `expect(after.tokenVersion).toBe(before.tokenVersion + 1)`. |
| Refresh fallido, otro refresh tardío y retryRestore explícito | Sin llamada nueva para el tardío; exactamente una llamada adicional tras retryRestore. |
| Logout durante refresh o login | Estado/token limpios antes de resolver pendiente; `onInvalidate` invocado; logout remoto ocurre después; respuesta pendiente no autentica. |
| Login tras logout pendiente | `expect(order).toEqual(['logout', 'login'])`; si logout falla, login no se envía. |
| Almacenamiento lanza SecurityError | Logout sigue en memoria; `expect(store.isPersistent()).toBe(false)` sin excepción escapada. |
| Logout remoto falla y nueva instancia usa el mismo store | Bootstrap no llama refresh; marcador sigue true; solo logout 204 lo elimina. |
| Invalidación de generación/versión anterior | Snapshot de sesión nueva intacto y limpieza no invocada por ese evento obsoleto. |

- [ ] **2. Ejecutar RED:** `npm test -- src/features/auth/session.test.ts src/features/auth/logout-store.test.ts`.
- [ ] **3. Implementar `createLogoutStore`.** Clave exacta `sigepp.logoutPending`; lectura/escritura protegidas contra errores; fallback en memoria. Nunca almacenar token/usuario. Una lectura con marcador true impide restauración; un fallo de escritura se comunica mediante `isPersistent`.
- [ ] **4. Implementar `createSessionService`.** Cola serial de login/refresh/logout; bootstrap memoizado; refresh compartido y resultado fallido memorizado por identidad; generaciones separadas de versiones. Limpiar token, usuario y avanzar generación síncronamente al iniciar cierre/reemplazo; esperar limpieza del consumidor antes de publicar una identidad nueva. Logout bloquea nuevas renovaciones antes de esperar la cola. La cola y bootstrap no se llaman recursivamente ni dependen del cliente protegido.
- [ ] **5. Verificar GREEN** y typecheck; repetir únicamente casos que requieran corregir una carrera. Comprobar en tests que login/refresh terminados después del logout no publican tokens aunque el navegador todavía procese su cookie; la llamada logout posterior revoca la cookie vigente.
- [ ] **6. Commit:** `feat(auth): coordinar restauracion y cierre de sesion (S1-H5)`.

## T5 — Cliente protegido, Query y proveedor de sesión

**Files:** crear archivos de T5 del mapa, `frontend/src/api/client.test.ts`, `app/runtime.test.ts`, `features/auth/AuthProvider.test.tsx`.

**Interfaces:** `createHttpClient(transport: Transport, session: SessionService): HttpClient`; `HttpClient.request<T>(path: string, options?: Omit<RequestOptions, 'credentials'>): Promise<T>` exige sesión y añade Bearer/cookies según corresponda. `createQueryClient(): QueryClient`. `createRuntime({ env, fetchImpl?, storage? }): AppRuntime`, donde `AppRuntime = { authApi: AuthApi; session: SessionService; http: HttpClient; queryClient: QueryClient }`; exportar singleton `runtime` para la aplicación. Los argumentos son FrontendEnv, typeof fetch y el almacenamiento aceptado por createLogoutStore. `Providers({ runtime, children })` suministra RuntimeContext y compone Query/Auth; `useRuntime(): AppRuntime` lee ese contexto. `AuthProvider({ service, children })` y `useSession(): { snapshot: SessionSnapshot; service: SessionService }` usan `useSyncExternalStore` y un contexto estable. Páginas/hooks consumen useRuntime; solo la composición de entrada importa el singleton, lo que permite pruebas con runtime inyectado.

- [ ] **1. Escribir suites RED.** Usar transporte real con fetch controlado y promesas diferidas, no simular el método `refresh` que se está probando. Cubrir:

| Escenario | Aserción principal |
|---|---|
| Cuatro `/auth/yo` reciben 401 y refresh funciona | `expect(refreshCalls).toBe(1)`; las cuatro peticiones terminan con usuario real del fixture; cada original tiene dos intentos como máximo. |
| Un 401 llega después del refresh, o refresh repite cadena JWT | Se usa la nueva versión sin otro refresh. |
| 403 protegido y 401 de login/registro | `expect(refreshCalls).toBe(0)` para esas operaciones. |
| Repetición también devuelve 401 | Dos intentos totales; no bucle; invalidación solo si la identidad sigue vigente. |
| Refresh falla y hay peticiones tardías | Una renovación total, error compartido, sin reintentos Query/foco/reconexión. |
| AbortSignal se cancela mientras espera refresh | Ese consumidor acaba con AbortError y no se repite; otro consumidor obtiene resultado; refresh compartido no se aborta. |
| Respuesta 200 o 401 de A después de login B | Rechazo `stale-session`; no entrega datos de A ni invalida B. |
| Logout con consulta privada y mutación pendientes | `expect(signal.aborted).toBe(true)`; cachés query/mutation vacíos; resolución tardía no añade datos ni avisos. |
| Proveedor montado en StrictMode, desmontado y montado con el mismo runtime | Una restauración, sin doble listener activo ni actualización después de unsubscribe. |

- [ ] **2. Ejecutar RED:** `npm test -- src/api/client.test.ts src/app/runtime.test.ts src/features/auth/AuthProvider.test.tsx`.
- [ ] **3. Implementar `createHttpClient`.** Capturar acceso/identidad, ejecutar transporte y comprobar generación antes de entregar cualquier resultado. Aplicar exactamente los siete pasos de recuperación de la sección 5 de la especificación. Volver a comprobar señal y generación antes de la repetición. Un cliente privado sin sesión rechaza sin pedir refresh indefinidamente; inicialización pertenece al runtime/proveedor. Cuerpos JSON recreables, sin admitir streams reutilizables en S1.
- [ ] **4. Implementar Query y runtime.** Crear QueryClient antes de sesión e inyectar `onInvalidate` que cancele consultas y luego limpie query y mutation caches. Defaults de la especificación; consultas privadas con clave de identidad/generación y AbortSignal. No cachear snapshots auth en Query ni instanciar runtime en el render. Transporte → authApi → sesión → cliente; sin importación circular de `auth-api` a `client`. Cuando no se inyecte storage, obtener window.sessionStorage dentro de try/catch: el acceso a la propiedad puede fallar antes de invocar sus métodos; también ese caso usa fallback en memoria.
- [ ] **5. Implementar proveedores y hook.** El efecto de AuthProvider invoca initialize idempotente; cleanup solo libera su suscripción, nunca aborta bootstrap. Añadir ToastProvider en T7. Exponer métodos mediante service, no duplicar usuario/token con useState.
- [ ] **6. Ejecutar GREEN, typecheck y lint**; inspeccionar que los módulos de sesión no importan React/Query/router. Commit `feat(api): integrar cliente protegido y estado de servidor (S1-H5)`.

## T6 — Campos, estados y componentes visuales

**Files:** crear archivos de T6 del mapa y `frontend/src/components/fields.test.tsx`, `states.test.tsx`. Modificar solo tokens/estilos si la implementación accesible necesita variantes de contraste.

**Interfaces:** Button extiende props nativas con `variant: 'primario' | 'secundario' | 'peligro' | 'fantasma'` opcional y `loading?: boolean`; ref HTMLButtonElement. `FieldProps = { label: string; help?: string; error?: string }`; Input y Textarea combinan FieldProps con props/ref nativos. Select usa Radix, FieldProps, `name`, `value`, `options: readonly { value: string; label: string }[]`, `onValueChange(value: string): void`, `onBlur`, `disabled`, `required`, `id` y ref del trigger. Card recibe atributos HTML y children; Badge `tone: 'exito' | 'advertencia' | 'error' | 'informacion'`, label e icono asociado; no impone estados de módulos aún no implementados. EmptyState recibe título, descripción y acción opcional `{ label, href }`; LoadingState recibe label; ErrorState recibe message y `onRetry?: () => void`.

- [ ] **1. Escribir tests RED de interacción.** `getByLabelText('Correo')` identifica el input; error crea `aria-invalid="true"` y relación `aria-describedby`; ayuda y error conservan ids distintos entre campos repetidos. Select se abre, recorre y elige con teclado, llama `onValueChange` una vez y acepta foco por ref. Button en carga impide doble click y anuncia estado. Badge tiene texto además de icono/color; EmptyState sin acción no produce enlace vacío. Probar etiquetas y nombres de 120 caracteres, sin cortar su valor accesible.
- [ ] **2. Ejecutar RED:** `npm test -- src/components/fields.test.tsx src/components/states.test.tsx`.
- [ ] **3. Implementar las interfaces en sus archivos.** Usar useId para ayudas/errores, forwardRef compatible con React 18 y etiquetas externas asociadas al control. Button por defecto `type="button"`; submit se pide explícitamente. Select controlado para Controller de RHF. No introducir reglas de dominio en componentes.
- [ ] **4. Aplicar tokens y estados.** Verde/naranja con texto `#202020`; bordes interactivos con contraste suficiente, 44 px móvil, foco 2 px, wrap de texto largo, rem y movimiento reducido. Card no es interactiva sin necesidad.
- [ ] **5. Ejecutar GREEN, typecheck y lint.** No añadir snapshots masivos de HTML o tests que solo reproduzcan clases CSS; la geometría se verifica en navegador T10.
- [ ] **6. Commit:** `feat(ui): agregar campos y estados institucionales (S1-H2)`.

## T7 — Modal, Toast, tabla y paginación

**Files:** crear archivos de T7 del mapa, `frontend/src/components/Modal.test.tsx`, `Toast.test.tsx`, `Tabla.test.tsx`, `Paginador.test.tsx`. Modificar `app/Providers.tsx` para instalar ToastProvider una sola vez.

**Interfaces:** `Modal({ open, onOpenChange, title, description, trigger?, children })` usa Radix Dialog; trigger conserva ref/return focus. `ToastProvider({ children })`, `useToast(): { notify(input: { title: string; description?: string; tone: 'exito' | 'error' | 'informacion' }): void }`. `Column<T> = { id: string; header: string; render(row: T): ReactNode; sortable?: boolean }`; `SortState = { columnId: string; direction: 'asc' | 'desc' }`; `Tabla<T>({ caption, rows, columns, getRowId, sort?, onSortChange?, loading?, error?, onRetry?, empty })`. `Paginador({ pagina, totalPaginas, onPageChange })` usa base 1 y admite totalPaginas 0; no emite una página inexistente.

- [ ] **1. Escribir suites RED.** Modal abierto tiene dialog con nombre/descripción, captura foco, Escape cierra y devuelve foco al trigger. Toast anuncia confirmación de forma no intrusiva, error de forma inmediata y permite cierre por teclado. Tabla tiene caption, th/scope, orden con `aria-sort` y callback, estado vacío sin filas falsas. Paginador no emite 0 ni total+1; con cero resultados muestra «Sin páginas» y navegación deshabilitada.

```ts
expect(screen.getByRole('dialog', { name: 'Menú' })).toBeVisible();
await user.keyboard('{Escape}');
expect(trigger).toHaveFocus();
expect(onPageChange).not.toHaveBeenCalled(); // click en Anterior de página 1
expect(screen.getByText('Sin páginas')).toBeVisible(); // totalPaginas = 0
```

- [ ] **2. Ejecutar RED:** `npm test -- src/components/Modal.test.tsx src/components/Toast.test.tsx src/components/Tabla.test.tsx src/components/Paginador.test.tsx`.
- [ ] **3. Implementar Modal y Toast.** Reutilizar Radix para foco, portales y anuncios; duración 5 segundos para confirmación, 10 para error, cierre explícito y pausa por interacción. El error persistente de un formulario no depende del Toast. Proveedor global evita perder éxito al navegar del registro al login.
- [ ] **4. Implementar Tabla y Paginador controlados.** No ordenar ni paginar datos de servidor internamente. Tarjetas etiquetadas en móvil; ocultar semánticamente la representación inactiva mediante CSS responsive, sin duplicar ids. Con total 0 mostrar «Sin páginas» sin emitir cambios; con páginas disponibles limitar la página presentada al intervalo 1…totalPaginas, sin llamar automáticamente al padre al normalizar props. Agregar caso de página recibida fuera de rango. El orden comunica la columna y dirección elegidas.
- [ ] **5. Ejecutar GREEN, typecheck y lint.** Foco real, anuncios y adaptación visual se vuelven a comprobar en navegador T10; jsdom no prueba geometría ni lector de pantalla.
- [ ] **6. Commit:** `feat(ui): agregar dialogos avisos y tablas accesibles (S1-H2)`.

## T8 — Catálogo de rutas, permisos y AppShell

**Files:** crear archivos T8 del mapa, `frontend/src/features/auth/auth-hooks.ts` con useLogout, y `frontend/src/routes/catalog.test.ts`, `return-to.test.ts`, `ProtectedRoute.test.tsx`, `layouts/AppShell.test.tsx`. El arranque final de rutas reales ocurre en T9; las pruebas de router inyectan páginas de prueba explícitas.

**Interfaces:** `RouteId` identifica cada fila/destino de la tabla de rutas de la especificación. `RouteDefinition = { id: RouteId; path: string; roles: readonly Rol[] | 'public'; page: PageKey; label: string; availability: 'activa' | 'S2' | 'S3'; menuRoles: readonly Rol[] }`. Alias y rutas de error tienen metadatos explícitos y no aparecen en menú. `PageKey = 'login' | 'registro' | 'inicio' | 'perfil' | 'modulo'`; `PageRegistry = Record<PageKey, () => Promise<{ default: ComponentType }>>`. `canAccess(routeId: RouteId, rol: Rol): boolean`, `getHomePath(rol: Rol): string`, `getNavigation(rol: Rol): readonly RouteDefinition[]`, `getSafeReturnTo(value: unknown, rol: Rol): string`, `createAppRouter(pages: PageRegistry): ReturnType<typeof createBrowserRouter>`. `ProtectedRoute({ routeId })` devuelve Outlet, fallback, Navigate o 403. Shell usa `useSession`, `getNavigation` y Outlet.

- [ ] **1. Escribir tests RED con una matriz de resultados esperados independiente del catálogo.** Cubrir las seis filas de menú y todos los paths de la tabla de la especificación, incluidos alias y detalles. Comprobar que ADMIN no accede a `/expediente`, ORGANIZACION no accede a `/asignaciones/:id`, ambos tutores sí acceden a `/revisiones`, y COORDINADOR/ADMIN acceden a `/panel`. Los enlaces del menú no contienen `#` ni `:id` sin resolver.
- [ ] **2. Añadir casos de retorno seguro y guardas.** Restaurando no navega a login; anónimo conserva destino interno; rol inválido recibe 403; path desconocido recibe 404 sin consultas privadas. Un usuario autenticado va a `/panel` si coordinador, `/org/inicio` si organización y `/inicio` en los demás casos.

```ts
for (const target of ['https://evil.example', '//evil.example', '/\\evil.example',
  '/%2f%2fevil.example', '/login', '/registro', '/inexistente', '/admin/auditoria']) {
  expect(getSafeReturnTo(target, 'ESTUDIANTE')).toBe('/inicio');
}
expect(getSafeReturnTo('/plazas?area=software', 'ESTUDIANTE'))
  .toBe('/plazas?area=software');
```

- [ ] **3. Ejecutar RED:** `npm test -- src/routes src/layouts/AppShell.test.tsx`.
- [ ] **4. Implementar `permissions.ts`, catálogo y retorno.** Reflejar la matriz del backend y distinguir permisos de operación frente a roles de presentación. Expandir en el catálogo cada path de la tabla de la especificación, preservando aliases, destinos de notificaciones previstos y roles exactos. Aplicar match de rutas conocidas y validación de URL de mismo origen; nunca retornar una URL arbitraria recibida en query/state.
- [ ] **5. Implementar router, guardas y errores.** Rutas anidadas, React.lazy/Suspense mediante PageRegistry y RouteErrorBoundary con mensaje recuperable; no importar páginas inexistentes en esta tarea. `/403` y 404 no exponen contenido privado; página error ofrece inicio/login según sesión. AuthLayout para rutas públicas; la tabla de permisos sigue siendo la única fuente para guardas y navegación.
- [ ] **6. Implementar shell y pruebas de menú.** Sidebar de escritorio, Topbar con nombre/rol/logout, navegación móvil con tres destinos prioritarios y Más que usa Modal. Todos los destinos principales definidos en la especificación y perfil disponibles; no mostrar funcionalidades inventadas. Incluir skip link y foco de encabezado al cambiar de página. Crear `useLogout(): UseMutationResult<void, ApiError, void>` en auth-hooks, con mutationFn del servicio obtenido de useRuntime y sin reintentos. Topbar usa ese hook; el estado del servicio conserva el error de cierre pendiente para la vista pública de T9.
- [ ] **7. Ejecutar GREEN, typecheck y lint.** Commit `feat(routes): proteger navegacion y armazon por rol (S1-H3 S1-H4)`.

## T9 — Login, registro y perfil contra los contratos reales

**Files:** crear archivos T9 del mapa salvo auth-hooks existente; crear `frontend/src/features/auth/LoginPage.test.tsx`, `RegistroPage.test.tsx`, `frontend/src/features/perfil/PerfilPage.test.tsx`; modificar `features/auth/auth-hooks.ts`, `app/App.tsx` y `main.tsx` para completar hooks y arranque final.

**Interfaces:** `useLogin(): UseMutationResult<void, ApiError, LoginInput>` y `useRegistro(): UseMutationResult<Usuario, ApiError, RegistroInput>` amplían auth-hooks; se conserva useLogout de T8. Sus mutationFn usan `session.login`, `authApi.registro` y `session.logout`, respectivamente, obtenidos de useRuntime. No duplicar login/logout HTTP fuera del servicio. `usePerfil(): UseQueryResult<Usuario, ApiError>` consulta `{ usuario: Usuario }` mediante `runtime.http.request('/auth/yo', { signal })`, valida `usuarioSchema` y convierte fallos de schema en ApiError de tipo invalid-response. Usa clave `['privada', generation, usuario?.id ?? null, 'perfil']` y enabled únicamente con estado autenticada, sin desreferenciar usuario null durante logout. Páginas exportan default sin props; reciben dependencias por contexto/runtime. `app/pages.tsx` exporta PageRegistry con cinco imports dinámicos reales.

- [ ] **1. Escribir suites RED montadas con Providers y MemoryRouter.** Mockear fetch en tests, conservando schemas, servicios, hooks y formularios reales. Probar:

| Flujo | Aserción principal |
|---|---|
| Registro válido de cada rol | Payload exacto sin confirmación ni opcionales vacíos; una llamada a registro; `expect(loginCalls).toBe(0)`; navega a login y conserva aviso de éxito. |
| Cambio estudiante → docente | Se conservan datos comunes y se excluyen carnet/carrera/año; aparecen departamento/especialidad. |
| Validaciones y error servidor 400/409 | Campo correcto asociado o resumen general; foco al primer error; datos escritos conservados. |
| Login empresarial y doble submit | Una solicitud; no filtro institucional; destino permitido por rol. |
| Credenciales incorrectas, inactivo, bloqueo y red | Mensajes en español; no refresh causado por ese fallo ni reintento automático; controles se rehabilitan. |
| Logout remoto pendiente y storage bloqueado | Aviso persistente en vista pública, reintento explícito, advertencia de persistencia solo si falla almacenamiento. |
| Perfil con campos/perfiles null y nombres largos | Datos ausentes como «No disponible»; no excepciones ni números inventados; reintento manual en error de consulta. |
| Mutación antigua termina después de otra identidad | Ningún Toast/navegación o dato de la operación anterior se publica. |

- [ ] **2. Ejecutar RED:** `npm test -- src/features/auth/LoginPage.test.tsx src/features/auth/RegistroPage.test.tsx src/features/perfil/PerfilPage.test.tsx`.
- [ ] **3. Implementar hooks y formularios.** RHF con resolver Zod compatible; Controller para Select, valores por rol, autocompletado `email`, `current-password`/`new-password`; botón submit en carga, nombre accesible y validación en español. Usar `splitFormErrors`. Éxito de registro: borrar contraseñas, Toast global y navigate a login con solo correo en state. Verificar generación capturada antes de callbacks de mutaciones que puedan mostrar Toast/navegar.
- [ ] **4. Implementar páginas de inicio, perfil y módulo.** Inicio muestra sesión real; perfil de solo lectura renderiza todos los datos públicos pertinentes sin asumir perfiles presentes; módulo muestra exactamente «Esta sección aún no está disponible». No consultar endpoints S2/S3. Errores recuperables de restauración ofrecen reintento explícito y acceso a login sin arrancar otra renovación.
- [ ] **5. Conectar `App` y `main`.** Una instancia de runtime y router; Providers envuelve RouterProvider y Toast global; StrictMode en raíz. Sustituir portada inicial por aplicación completa. Usar solo imports de páginas diferidos, sin barrel que los incluya de forma anticipada.
- [ ] **6. Ejecutar GREEN, todas las pruebas unitarias, typecheck, lint y build.** Criterio: formularios consumen rutas exactas y no existen fixtures importados en `src` fuera de tests. Commit `feat(auth): conectar login registro y perfil al API (S1-H6)`.

## T10 — Verificación real, accesibilidad y entrega para revisión

**Files:** crear archivos T10 del mapa; modificar `frontend/package.json` para scripts E2E/medición y actualizar su lock si se incorporan herramientas; modificar README y el plan de Fase 2 únicamente para instrucciones/nota de compatibilidad, sin marcar otras historias terminadas. Crear documentos de demo y evidencia; el informe no contendrá casillas aprobadas por anticipado.

**Interfaces:** `scripts/e2e.mjs` es el orquestador Node con opciones `--mode=development|production|rate-limit`; crea un proceso de API y un frontend supervisados y espera sus healthchecks. Playwright consume `baseURL=http://localhost:5173`, `workers: 1`, `retries: 0` y Chromium como navegador inicial; cualquier navegador adicional se ejecuta en una ronda separada. `e2e/fixtures.ts` exporta cuentas seed de README, `loginAs(page: Page, rol: Rol): Promise<Response>` para obtener la respuesta login, `waitForAccessExpiry(loginResponse: Response): Promise<void>` y `collectAuthRequests(page: Page): { entries: { method: string; path: string; status: number }[]; stop(): void }` sin persistir/loguear credenciales/tokens. `scripts/check-initial-size.mjs` lee `.e2e/initial-assets.json` con paths únicos de JS solicitados en production y calcula gzip de los archivos correspondientes de dist; valida que todos existan y permanezcan dentro de dist.

- [ ] **1. Preparar aislamiento verificable.** Añadir al orquestador: validar puertos 4000/5173 libres y fallar si otro proceso los ocupa; no terminar servicios ajenos ni cambiar puertos. Crear DB nueva `sigepp_e2e_<12 hex aleatorios>` en el PostgreSQL del compose, validando nombre; rechazar nombres de demo/test general. Generar secreto JWT solo en memoria del proceso. Establecer en el entorno del hijo API `DATABASE_URL` y `DATABASE_URL_TEST` a la misma URL E2E, `NODE_ENV=test`, `JWT_ACCESS_TTL=5s`, CORS y dominios de los ejemplos; migrar y ejecutar el seed existente con la URL E2E antes de registrar usuarios. Las variables privadas no se propagan a Vite ni a Playwright; esos procesos reciben únicamente configuración pública y operativa, sin JWT secret ni URL de BD. Escribir en `.e2e/` solo identificación de ejecución/DB, nunca secreto/token.

Comandos que reproduce el orquestador, con paths resueltos desde la raíz y argumentos sin interpolación insegura:

```powershell
docker compose up -d --wait db
# El nombre lo genera y valida el orquestador; no proviene del usuario.
docker compose exec -T db psql -U sigepp -d postgres -v ON_ERROR_STOP=1 -c 'CREATE DATABASE "sigepp_e2e_012345abcdef"'
# En cwd backend, con entorno E2E explícito heredado por estos procesos:
node node_modules/prisma/build/index.js migrate deploy
node --import tsx prisma/seed.ts
node --import tsx src/server.ts
```

El nombre mostrado es ilustrativo; cada ejecución genera uno nuevo. No reutilizar una DB poblada: el seed omite datos si encuentra usuarios. No ejecutar los tests backend sobre esa DB. Mantener la DB de evidencia al terminar e identificarla; cualquier limpieza posterior se documentará por nombre exacto y se hará como acción explícita, nunca con comodines. El orquestador termina solo procesos que creó; en Windows los helpers se inician sin ventana visible. Si Docker/PostgreSQL no está disponible, registrar el bloqueo real y completar solo comprobaciones independientes.

- [ ] **2. Escribir los recorridos E2E.** `auth.spec.ts`: registros estudiante/docente con correos y carnets exclusivos por ejecución, duplicados por ambos campos, seis logins y bloqueo con cuenta dedicada (cinco 401 y luego 429). `navigation.spec.ts`: cada enlace habilitado de cada rol tiene destino, acceso directo anónimo, denegado, 404, retorno seguro y perfil real. Contexto de navegador nuevo por caso, sin compartir storageState/cookie entre roles; seed previo y carnet exclusivo mediante contador validado contra los datos seed. Capturar requests/responses del API para verificar contrato y ausencia de login automático tras registro; no usar route.fulfill ni respuestas exitosas simuladas. En auth.spec agregar prueba explícita de contrato con APIRequestContext para entradas inválidas que el formulario bloquea antes de enviar; etiquetarla como contrato del servidor, no como recorrido UI.
- [ ] **3. Escribir `session.spec.ts` con servidor real.** Una recarga bajo StrictMode produce una sola renovación; cookie HttpOnly con path y SameSite esperados; token/usuario no aparecen en storage. Esperar expiración real usando `exp` del JWT recibido por login, leído solo en memoria del runner, más margen de reloj; no usar reloj falso del navegador ni firmar tokens. Para probar concurrencia importar desde `page.evaluate` el módulo canónico `/src/app/runtime.ts` servido por Vite y lanzar cuatro `runtime.http.request('/auth/yo')` en Promise.all. Debe haber exactamente un refresh y cuatro resultados correctos. No crear globals/test hooks en la aplicación ni usar bare fetch como sustituto del interceptor. Separar este test de la ejecución production. Verificar logout, recarga sin sesión, pérdida de red con `context.setOffline`, cierre pendiente y reintento tras reconexión. Restaurar red antes de recargar el documento y comprobar que el marcador impide refresh aunque el servidor ya esté disponible. Los ordenamientos imposibles de estabilizar en red real quedan además cubiertos determinísticamente en T4/T5.
- [ ] **4. Escribir `accessibility.spec.ts`.** Login, registro y shell a 360×800, 768×1024 y 1280×800, sin scroll horizontal: `expect(scrollWidth).toBeLessThanOrEqual(clientWidth)`. Operar formularios, Select, Más/Modal y logout con teclado; comprobar retorno del foco, skip link, encabezado tras navegación y avisos. Usar axe para problemas detectables y comprobar la semántica de live regions. Crear `e2e/components.html` y `e2e/components.tsx`: entrada de pruebas servida únicamente por Vite dev, que monta Tabla/Paginador/Modal/Toast reales con sus estilos y ToastProvider, casos controlados, filas vacías y textos de 120 caracteres; no monta sesión ni llama al API. Playwright visita `/e2e/components.html`; la entrada no pertenece al router ni a los inputs del build y no aparece en dist. No requiere plugin experimental de component testing. Hacer comprobación manual de anuncios con lector de pantalla si está disponible y registrar herramienta/resultado; si no, declararla no realizada. Verificar ampliación real 200 % en el navegador y movimiento reducido; documentar resultado y capturas.
- [ ] **5. Ejecutar suites y registrar evidencia real.** Desde backend ejecutar `npm ci` y generar Prisma si hace falta antes del orquestador; ninguna variable E2E se guarda en `.env` de demo. Desde frontend ejecutar `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e` (script = `node scripts/e2e.mjs --mode=development`). El orquestador tiene timeouts de health/readiness y propaga fallo/exit code de cualquier subproceso. No ejecutar suites con TRUNCATE en paralelo a la demo. Informar números de pruebas reales, duración y fallos; aplicar systematic-debugging si hay errores, y volver a ejecutar solo los controles afectados más los checks necesarios del cambio.
- [ ] **6. Medir producción y tasa por separado.** Scripts `test:e2e:production` y `test:e2e:rate-limit` ejecutan el orquestador con su modo homónimo; `check:initial-size` ejecuta `node scripts/check-initial-size.mjs`. La configuración development selecciona auth/session/navigation/accessibility; production selecciona auth/navigation/initial-size y arranca API E2E más Vite preview en 5173 con puerto estricto tras build. Production no visita el fixture de componentes ni importa `/src`. `initial-size.spec.ts` registra los paths únicos .js solicitados desde contexto nuevo hasta login interactivo en `.e2e/initial-assets.json`; check:initial-size calcula gzip, lista tamaños y falla sobre 250 000 bytes. CSS/fuentes aparte, sin secretos en el manifiesto. Rate-limit ejecuta solamente `rate-limit.spec.ts`, sobre proceso nuevo `NODE_ENV=development`, TTL ordinario y DB E2E, con 21 intentos a un correo inexistente: comprueba `429 DEMASIADAS_PETICIONES`, distinto del bloqueo por cuenta; se informa que la suite principal test desactiva esa limitación por IP. No ejecutar esas llamadas sobre el API de demo.
- [ ] **7. Actualizar documentación y evidencias.** README: requisitos de Node, `npm ci`, entorno público, frontend/backend, fuente local, CORS, dominios, scripts y demo. `s1-frontend-demo.md`: registro → login, seis cuentas existentes, recarga, cierre y destinos de módulos futuros. `s1-frontend-verificacion.md`: tabla S1-H1…H6 con comandos y resultados reales, navegador/viewports, contraste, lector de pantalla, limitaciones multi-tab/JWT, discrepancias RBAC/OpenAPI y cualquier bloqueo pendiente. Registrar ajuste Vite y Node en Fase 2 sin reescribir planificación histórica. No incluir logs con contraseñas, tokens o secretos; desactivar trazas de red persistentes que los capturen.
- [ ] **8. Revisión y cierre técnico.** Aplicar `superpowers:requesting-code-review` y una revisión independiente de toda la rama contra especificación y plan; corregir hallazgos aceptados y verificar los cambios. Aplicar verification-before-completion y registrar `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` y suites E2E realmente completadas. Inspeccionar diff para confirmar que backend/Prisma no cambió y no entraron fixtures, credenciales ni artefactos generados. Una prueba no ejecutada se reporta como pendiente.
- [ ] **9. Commit y preparación de revisión humana.** Commit `test(frontend): verificar S1 contra API real y documentar demo`. Actualizar referencias remotas solo cuando corresponda preparar integración; comprobar el desfase previamente observado de nueve commits de `origin/develop` frente a main. Preparar descripción de entrega con S1-H1…H6 y RF-01/02/04, evidencia y limitaciones. No mezclar ni integrar esos commits ajenos silenciosamente. La aprobación del compañero y cualquier publicación/merge quedan separadas del estado «verificado técnicamente».

## Comprobación del plan y entrega a ejecución

Autorrevisión documental realizada el 3 de octubre de 2026 contra la especificación aprobada: las 12 secciones tienen tareas responsables, S1-H1…H6 están cubiertas por la matriz de trazabilidad y los cinco focos de revisión tienen pruebas asignadas. Se corrigieron dependencias entre tareas, inyección del runtime, tipos de formularios, aislamiento de E2E y entradas de pruebas excluidas del build. Las casillas del plan describen trabajo futuro; no acreditan verificación del producto. La revisión y selección humana del método siguen pendientes.

Métodos disponibles tras revisar este documento:

- **Ejecución directa en esta sesión, recomendada para este plan:** el agente principal implementa T1–T10 y una revisión independiente final inspecciona la rama. Mantiene juntas las interfaces estrechamente relacionadas de sesión, HTTP, Query y router y reduce el coste de cambios de contexto.
- **Ejecución mediante subagentes:** un implementador y revisores por tarea verifican cumplimiento y calidad antes de continuar; revisión de la rama al final. Ofrece más revisiones intermedias y requiere más contextos.

La selección del método todavía no se ha recibido. Después de aprobar el plan y elegir uno se carga la skill correspondiente y se comienza la preparación de ejecución; no se interpreta la aprobación de la especificación como permiso para saltar esta revisión.
