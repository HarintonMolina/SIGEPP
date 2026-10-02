# Especificación de S1 Cimientos del frontend de SIGEPP

Fecha: 3 de octubre de 2026. Alcance: S1-H1 a S1-H6, RF-01, RF-02 y RF-04.

Estado: diseño conversacional aprobado por el usuario; especificación escrita pendiente de su revisión y aprobación. Este documento define el resultado esperado. No constituye el plan de implementación ni autoriza todavía la creación del frontend.

## 1. Propósito y límites

El estudiante o docente podrá registrarse con correo institucional, iniciar sesión contra el API real, recargar sin perder su sesión y cerrarla. Los seis roles existentes podrán iniciar sesión, ver su navegación y acceder únicamente a las rutas autorizadas para ellos. Los componentes y límites entre módulos quedarán preparados para el trabajo posterior del equipo.

S1 incluye infraestructura, componentes reutilizables, AppShell, enrutamiento, cliente HTTP, estado de servidor y autenticación. El backend, sus contratos, migraciones y esquema Prisma se conservan. La autorización del servidor y la comprobación de pertenencia de cada recurso siguen siendo obligatorias.

Los módulos de negocio de S2/S3 tendrán destinos de navegación protegidos con el mensaje «Esta sección aún no está disponible». Esos destinos no harán consultas del módulo, no mostrarán estadísticas o registros ficticios y no incluirán acciones de negocio. El perfil será de solo lectura mediante `/auth/yo`; el inicio mostrará identidad y accesos reales. El panel operativo WF-01, la campana, postulaciones, plazas, expediente y revisiones funcionales pertenecen a sus sprints originales.

Quedan fuera recuperación o cambio de contraseña, registro de organizaciones, administración de usuarios, evaluaciones, indicadores, documentos PDF, despliegue y cambios de seguridad del backend. «Restaurar sesión» significa usar la cookie de refresh, no recuperar una contraseña.

## 2. Base documental y decisiones

La revisión se realizó sobre el commit `ad1d2e3`, con árbol limpio y sin `frontend/`. No se encontraron archivos `AGENTS.md` aplicables. Las referencias locales consultadas fueron:

- [README](../../../README.md) y [plan de sprints de Fase 2](../../fase-2/plan-de-sprints.md), especialmente S1-H1…H6 y la definición de terminado.
- [Documento de Fase 1](../../fase-1/Primer%20Entregable%20-%20Fase%201%20-%20Ingenieria%20de%20Requisitos%20y%20Arquitectura.docx), secciones 4.1–4.3, 5.2, 6.2 y 6.6–6.7.
- [Schemas de autenticación](../../../backend/src/modules/auth/auth.schema.ts), [servicio](../../../backend/src/modules/auth/auth.service.ts), [controlador](../../../backend/src/modules/auth/auth.controller.ts), [rutas](../../../backend/src/modules/auth/auth.routes.ts) y [OpenAPI de auth](../../../backend/src/modules/auth/auth.docs.ts).
- [Matriz RBAC](../../../backend/src/middleware/rbac.ts), middleware de autenticación, errores y rate limit, rutas y servicios de organizaciones, plazas, asignaciones y planes de trabajo, configuración CORS y seed.

Se eligió un servicio de sesión independiente del ciclo de montaje de React. El contexto expone su estado y TanStack Query gestiona datos del servidor. La alternativa de concentrar también la sesión en Query requiere excepciones para rotación de cookies y restauración; separar esas responsabilidades hace explícita la coordinación y permite probarla sin montar la aplicación. No se añade Redux ni otra biblioteca global de estado.

### Compatibilidad técnica

| Elemento | Decisión de S1 | Justificación y verificación |
|---|---|---|
| React | 18.3, con React DOM y tipos de la misma versión mayor | Conserva React 18 exigido por el proyecto; StrictMode permanece habilitado. |
| Vite | 8.3, con plugin de React compatible | Ajuste aprobado frente a Vite 5 del plan; Vite 5 está fuera de soporte y el backend ya declara Vite 8.3.2. |
| Node | Rama 22 LTS, versión mínima 22.12; entorno observado 22.21 | Vite permite 20.19+/22.12+, pero Vitest 5 del lock del backend excluye Node 20. |
| TypeScript y ESLint | TypeScript 5 en modo estricto; ESLint 9 con configuración plana | Reglas de React Hooks y recarga rápida; sin desactivar comprobaciones para ocultar errores. |
| Estilos y rutas | Tailwind CSS 3.4 con PostCSS; React Router 6.30 | Conserva las versiones mayores de Fase 1 y sus rutas anidadas con carga diferida. |
| Datos y formularios | TanStack Query 5, React Hook Form 7 y Zod 3 | Zod 3 coincide con las reglas del backend; no se importará Prisma ni código servidor al navegador. |
| Accesibilidad | Primitivas Radix para Select, Dialog y Toast | Comportamientos de teclado y foco reutilizables con estilos institucionales. |
| Pruebas | Vitest, Testing Library y pruebas de navegador con Playwright | Versiones compatibles con React 18 y Node 22; parches exactos registrados en el lock al implementar. |

Fuentes de compatibilidad consultadas el 3 de octubre: [versiones soportadas de Vite](https://vite.dev/releases), [requisitos de Vite](https://vite.dev/guide/), [Tailwind 3 con Vite](https://v3.tailwindcss.com/docs/guides/vite) y [documentación de React Router 6](https://reactrouter.com/6.30.3/start/overview). Las versiones de parches y dependencias pares deberán comprobarse antes de instalar; no se usará una plantilla que cambie silenciosamente React a otra versión mayor.

## 3. Organización y responsabilidades

La aplicación será un paquete independiente en `frontend/`, con su propio `package.json`, lock, configuración, `.env.example` y scripts. Se respetarán `.editorconfig` y Prettier existentes. No se convertirá el repositorio a otro gestor de monorepo.

| Área prevista en `frontend/src/` | Responsabilidad y contrato |
|---|---|
| `app/` y `main.tsx` | Componer proveedores estables de sesión, Query, Toast y router; arrancar la aplicación. |
| `api/transport.ts` | Ejecutar fetch, aceptar AbortSignal, procesar JSON o respuesta vacía y normalizar errores. No conoce React ni inicia refresh. |
| `api/client.ts` | Añadir Bearer, coordinar recuperación de un 401 y descartar resultados de otra sesión. Usa transporte y servicio de sesión. |
| `api/query-client.ts` | Configuración única de consultas, mutaciones, caché y cancelación. |
| `features/auth/` | Tipos públicos, schemas, serialización de formularios, llamadas auth, servicio de sesión, proveedor, login y registro. El servicio no depende de React, del router ni de Query. |
| `features/inicio/`, `features/perfil/` | Bienvenida y perfil de solo lectura con datos reales. |
| `features/modulos/` | Página reutilizable de módulo aún no disponible; metadatos de futura incorporación S2/S3. |
| `components/` | Controles base, tabla, paginación, estados de carga, vacío y error. No deciden permisos de negocio. |
| `layouts/` | AuthLayout y AppShell responsive; reciben identidad y navegación autorizada. |
| `routes/` | Catálogo tipado, permisos, destinos iniciales, rutas anidadas, ProtectedRoute y páginas 403/404. |
| `hooks/` | Acceso a sesión y Toast y adaptadores reutilizables; sin duplicar el estado canónico. |
| `styles/` | Tokens, fuente Inter local y estilos globales. |

El servicio de sesión expondrá suscripción, lectura de estado, inicialización, login, refresh coordinado y logout. El coordinador de proveedores conectará sus invalidaciones con cancelación y limpieza de Query. La inicialización y los listeners compartidos deben ser idempotentes bajo StrictMode. Las nuevas funcionalidades consumirán estos contratos; no accederán directamente a un token mutable.

## 4. Contrato HTTP y representación del usuario

Base del API: `http://localhost:4000/api/v1`. Origen de la SPA: `http://localhost:5173`. Se utilizará el API directamente y el CORS existente con credenciales; el servidor Vite fijará el puerto con `strictPort` para evitar un origen alternativo inadvertido.

| Operación | Entrada | Salida y efecto |
|---|---|---|
| `POST /auth/registro` | JSON del rol institucional seleccionado | `201 { usuario }`, sin access token ni sesión nueva. |
| `POST /auth/login` | `{ correo, contrasena }` | `200 { accessToken, usuario }` y cookie `sigepp_rt`. |
| `POST /auth/refresh` | Cookie; sin Bearer obligatorio | `200 { accessToken, usuario }` y rotación de la cookie. |
| `POST /auth/logout` | Cookie; sin Bearer obligatorio | `204`, sin cuerpo; revoca refresh y elimina cookie. |
| `GET /auth/yo` | `Authorization: Bearer <accessToken>` | `200 { usuario }`. Sigue la recuperación de 401 del cliente protegido. |

Las peticiones auth usarán `credentials: 'include'`. La cookie es HttpOnly, SameSite Strict, con path `/api/v1/auth` y Secure solamente en producción. El código cliente no la leerá ni intentará borrarla. Se mantendrá `localhost` en ambos servicios, sin mezclarlo con `127.0.0.1`.

`Usuario` contendrá `id`, `nombres`, `apellidos`, `correo`, `rol`, `estado`, `telefono`, `creadoEn` y los perfiles anulables `estudiante`, `docente`, `tutorEmpresarial` y `organizacion`. `estado` será ACTIVO o INACTIVO; `telefono` será string o null y `creadoEn` una fecha ISO. Los roles exactos serán ESTUDIANTE, TUTOR_ACADEMICO, TUTOR_EMPRESARIAL, ORGANIZACION, COORDINADOR y ADMIN.

El perfil estudiante incluirá id, carnet, carrera, anio, porcentajeAvance como string y avanceVerificado; docente incluirá id, departamento y especialidad anulable; tutor empresarial incluirá id, organizacionId y cargo; organización incluirá id, razonSocial y estadoVerificacion. No se supondrá que un perfil existe basándose únicamente en el rol ni se convertirán datos ausentes en estadísticas.

Los errores del API tienen forma `{ error: { codigo, mensaje, detalles: string[] } }`. El cliente conservará status, código, mensaje y detalles. Un error de red o respuesta ilegible tendrá un mensaje local en español y una categoría distinta de una denegación del servidor. Un 204 no intentará parsearse como JSON. Abortos intencionales por logout o navegación no generarán Toast de error.

## 5. Sesión y concurrencia

### Estado y almacenamiento

El estado observable distinguirá `restaurando`, `autenticada`, `anonima` y `errorRecuperable`. Las operaciones expondrán además su estado de carga. Token, usuario y caché privada permanecerán en memoria: no se persistirán en localStorage, sessionStorage, URL ni logs. La única persistencia de sesión prevista es un indicador booleano de cierre remoto pendiente, descrito más abajo; no contiene credenciales ni identidad.

La generación de sesión cambia al cerrar o reemplazar la identidad. La versión de token cambia tras cada refresh exitoso, aunque el JWT recibido sea idéntico al anterior. Cada solicitud privada captura generación y versión. Respuestas de una generación anterior se descartan antes de modificar sesión, caché o avisos de la interfaz.

### Arranque

Al iniciar, una promesa de bootstrap conservada fuera del montaje del proveedor llama a refresh y comparte la misma renovación que usa el cliente HTTP. Se memoriza también su resolución: montar dos veces en StrictMode no duplica un bootstrap ya finalizado, incluso si terminó sin sesión. El desmontaje de un proveedor no aborta la renovación compartida.

Durante la restauración se muestra un estado accesible de carga y no se redirige a login. Refresh exitoso publica token y usuario. Un 401 resuelve como anónimo; un 403 de refresh resuelve sin sesión y conserva el mensaje de cuenta inactiva. Red, 5xx, 429 o respuesta inválida producen error recuperable con acción explícita para reintentar o ir al login. Las consultas privadas no se habilitan mientras la restauración esté pendiente o fallida. El login espera a que termine la operación auth activa; elegir login no deja una renovación pendiente capaz de sobrescribirlo.

### Renovación de peticiones protegidas

1. El transporte de login, registro, refresh y logout nunca inicia renovación. Esta exclusión es por operación concreta: `/auth/yo` sí utiliza el cliente protegido.
2. Solo el primer 401 de una petición protegida admite recuperación. Un 403, 400, 409, 429, fallo de red o 5xx no dispara refresh por sí mismo.
3. Si cambió la generación, la petición termina sin usar credenciales de otro usuario ni invalidar su sesión.
4. Si cambió únicamente la versión de token, se utiliza el token actual para la única repetición permitida. Esto cubre los 401 tardíos de solicitudes enviadas antes de una renovación ya finalizada.
5. Si sigue vigente la misma versión, se comparte una sola promesa de refresh para ese grupo de solicitudes. Su resultado habilita una repetición por solicitud, con cuerpo JSON recreable y el mismo AbortSignal del consumidor.
6. Un fallo del refresh queda registrado para esa generación y versión. Las solicitudes concurrentes o tardías observan el mismo fallo; no arrancan sucesivas renovaciones. Red, 5xx y 429 requieren una acción explícita para otro intento.
7. Si la repetición devuelve 401, no hay otra renovación. Solo se invalida el acceso si su generación y versión siguen siendo las actuales. Los 403 de negocio conservan la sesión.

Login, refresh y logout se serializan porque el navegador procesa `Set-Cookie` independientemente de las escrituras de estado en React. Se impide el doble envío del formulario. Ninguna de estas operaciones ni el registro tiene reintentos automáticos.

### Logout y respuestas pendientes

Logout marca el cierre pendiente, cambia la generación, bloquea nuevas renovaciones y elimina inmediatamente token y usuario. Cancela consultas privadas mediante los AbortSignal conectados al transporte, limpia el caché de consultas y mutaciones y lleva a la vista pública. La limpieza también se aplica al invalidar definitivamente una sesión o reemplazarla. Las mutaciones remotas ya enviadas pueden continuar en el servidor, pero sus respuestas no repueblan la sesión ni muestran avisos tardíos.

Después de la operación auth que ya estuviera en curso, se envía logout con la cookie vigente. El cierre remoto solo se confirma al recibir 204. Si falla, permanece el indicador `sigepp.logoutPending` en sessionStorage: recargar esa pestaña no restaurará la cookie anterior. La interfaz informará «Sesión cerrada en esta pestaña; no pudimos completar el cierre en el servidor» y ofrecerá reintento explícito. Antes de un nuevo login se completará ese cierre pendiente; solo el 204 elimina el indicador. Si sessionStorage no está disponible, se conserva el bloqueo en memoria y se informa que la persistencia del cierre al recargar no pudo garantizarse.

### Límites del contrato actual

La garantía de renovación única de S1 cubre solicitudes concurrentes dentro de una instancia/pestaña y el doble montaje de StrictMode. No se garantiza coordinación entre pestañas: comparten cookie y el backend invalida sesiones cuando detecta reutilización. El endurecimiento de ese caso requiere coordinación adicional entre documentos o cambios en el servidor; se documentará como limitación de S1.

Una respuesta de refresh perdida puede haber rotado el token en el servidor. Por eso no se repite automáticamente; un reintento manual puede terminar requiriendo login. Logout revoca refresh, pero no invalida inmediatamente los JWT ya emitidos. El frontend no prometerá modificar estas propiedades del backend.

## 6. Registro, login y errores de formulario

El formulario de registro ofrece únicamente «Estudiante» y «Tutor académico». Al cambiar de rol se excluyen del payload los campos del rol anterior. Se conservan los datos comunes introducidos y se recalculan los errores pertinentes.

| Campo | Regla del cliente y del payload |
|---|---|
| nombres y apellidos | Trim, mínimo 2 y máximo 80 caracteres cada uno. |
| correo | Trim, minúsculas y formato email válido. En registro, dominio exacto presente en la lista institucional configurada; no sufijos ni subdominios implícitos. |
| contraseña de registro | 8–72 caracteres, una letra ASCII `[A-Za-z]` y un dígito. No se recorta ni se exigen símbolos o mayúsculas adicionales. |
| confirmación | Igualdad exacta con contraseña; solo cliente, nunca se envía. |
| teléfono | Opcional; trim y regex `^\+?[\d\s-]{8,15}$`. Vacío se omite, no se envía como null. |
| carnet de estudiante | Trim, mayúsculas y regex `^\d{4}-\d{4}[A-Z]$`. |
| carrera de estudiante | Trim, 3–100 caracteres. Campo de texto, porque el API no ofrece catálogo de carreras. |
| año de estudiante | Selección de entero 1–5; se envía como número. |
| departamento de docente | Trim, 3–100 caracteres. |
| especialidad de docente | Opcional, trim y máximo 100 caracteres. Vacío se omite, aunque el backend también acepta cadena vacía. |

Ambos roles usan la misma lista de dominios. La configuración pública del frontend se alineará con `DOMINIOS_INSTITUCIONALES` del backend; no hay endpoint para descubrirla. El ejemplo local incluirá `uni.edu.ni,std.uni.edu.ni`. El servidor conserva la decisión definitiva sobre la validez del dominio.

Registro exitoso muestra una confirmación accesible y navega a login, sin llamar automáticamente a login ni almacenar el usuario registrado como sesión. El correo puede precargarse mediante estado transitorio del router; las contraseñas se eliminan del formulario y no se transportan al destino.

Login valida email y contraseña de 1–72 caracteres sin trim, conforme al schema real. No aplica la restricción institucional ni la política de contraseña del registro. Muestra una sola solicitud por envío explícito y permite los seis roles, incluidas cuentas empresariales.

Los detalles `campo: mensaje` conocidos se asocian a controles; los restantes aparecen en un resumen accesible. Se conserva lo escrito durante errores recuperables. Los duplicados 409 se presentan sin atribuir siempre el conflicto al correo: también puede ser carnet. El 401 de credenciales incorrectas no renueva sesión. El 429 CUENTA_BLOQUEADA muestra el mensaje del servidor sin inventar una fecha de desbloqueo. Se distingue del 429 DEMASIADAS_PETICIONES. Tras cinco contraseñas equivocadas, el quinto intento todavía devuelve 401 y el siguiente devuelve bloqueo, según el código actual.

## 7. Navegación y permisos

El catálogo de rutas define path, etiqueta, roles o permiso, destino inicial, presencia en menú y estado de disponibilidad. Menú, navegación móvil y guardas lo consumen; no habrá listas de roles independientes en cada componente. Los tipos de rol desconocidos se rechazan de forma segura. No se deriva autorización de campos manipulables de una URL ni se considera ADMIN un superusuario universal.

La siguiente tabla define acceso a destinos de presentación: una pantalla específica puede ser más restrictiva que la operación del API que utilizará después. No modifica permisos del servidor. Por ejemplo, `/asignaciones` y `/org/tutores` usan roles explícitos de presentación; no reutilizan directamente `asignaciones:ver` ni `organizaciones:gestionarTutores`. Estudiantes y tutores disponen de sus destinos específicos, y ADMIN administrará tutores desde organizaciones.

| Destino de la SPA | Acceso | Resultado en S1 |
|---|---|---|
| `/login`, `/registro` | Público; autenticados van a su inicio | Formularios reales. |
| `/` | Resuelve sesión | Login si anónimo; destino inicial de su rol si autenticado. |
| `/inicio` | Los seis roles | Bienvenida con identidad real; inicio predeterminado excepto coordinador y organización. |
| `/panel` | COORDINADOR, ADMIN | Armazón de aprobaciones; inicio del coordinador. |
| `/org/inicio` | ORGANIZACION | Bienvenida real de organización. |
| `/perfil` | Los seis roles | Consulta real de `/auth/yo`, sin edición. |
| `/org/perfil` | ORGANIZACION | Redirección interna a `/perfil`. |
| `/plazas`, `/plazas/:id` | Los seis roles | Armazón S2. El API aplicará además visibilidad por estado y pertenencia cuando se implemente. |
| `/postulaciones` | ESTUDIANTE | Armazón S2. |
| `/candidatos` | TUTOR_EMPRESARIAL | Armazón S2; API de postulaciones aún pendiente. |
| `/org/plazas`, `/org/plazas/nueva`, `/org/plazas/:id`, `/org/tutores` | ORGANIZACION | Armazón S2 para recursos propios. |
| `/organizaciones` | COORDINADOR, ADMIN | Armazón S2; futura administración usa estas rutas, no los endpoints exclusivos `/mia` o `/mias`. |
| `/expediente`, `/expediente/plan`, `/expediente/bitacoras` | ESTUDIANTE | Armazón S3. |
| `/tutorados` | TUTOR_ACADEMICO | Armazón S3. |
| `/practicantes` | TUTOR_EMPRESARIAL | Armazón S3. |
| `/revisiones` | TUTOR_ACADEMICO, TUTOR_EMPRESARIAL | Armazón S3 de planes y bitácoras. |
| `/asignaciones` | COORDINADOR, ADMIN | Armazón S3; ADMIN solo tendrá consulta, no confirmación. |
| `/asignaciones/:id` | ESTUDIANTE, ambos tutores, COORDINADOR, ADMIN | Armazón S3; la futura consulta requerirá pertenencia validada por el API. |
| `/admin/auditoria` | ADMIN | Armazón para incorporación posterior; no consulta en S1. |
| `/403` y cualquier ruta desconocida | Página de error accesible | Explicación y enlace a inicio o login según sesión; sin contenido privado. |

Las rutas de detalle no aparecen como enlaces sin identificador. El menú presenta los destinos principales aprobados: estudiante (inicio, plazas, postulaciones, expediente); académico (inicio, tutorados, revisiones); empresarial (inicio, candidatos, practicantes); organización (inicio, mis plazas, tutores); coordinador (panel, plazas, organizaciones, asignaciones); administrador (inicio, plazas, organizaciones, asignaciones, auditoría). Todos disponen de perfil y logout. Un acceso permitido puede omitirse del menú principal por relevancia, pero nunca mostrarse a un rol denegado.

El AppShell usa rutas hijas y Outlet; las páginas se cargan de forma diferida con fallback accesible y límite de error recuperable. En móvil hay tres accesos prioritarios por rol más «Más», que abre navegación accesible al resto. En roles con pocos destinos, perfil completa los accesos pertinentes. Ningún enlace habilitado usa `#`, un identificador ficticio o un destino inexistente.

ProtectedRoute espera el bootstrap, redirige al anónimo a login y devuelve 403 al rol no permitido. Conserva la ruta interna solicitada para volver tras login solo si existe y está autorizada para el usuario nuevo. Se descartan URLs externas, esquemas, destinos auth y rutas inválidas; se usa el inicio del rol como alternativa. Una URL desconocida termina en 404 sin disparar consultas privadas.

### Discrepancias documentadas

| Fuente documental | Comportamiento real que gobierna S1 |
|---|---|
| Fase 1 permite al coordinador crear/editar plazas | `plazas:crear` permite ORGANIZACION y ADMIN. |
| Fase 1 concede confirmación de asignaciones a ADMIN | `asignaciones:crear` solo permite COORDINADOR; ADMIN sí puede consultar. |
| Fase 1 amplía preselección y revisión de bitácoras | RBAC declara preselección solo empresarial y revisión solo para ambos tutores; sus APIs aún no existen. |
| Fase 1 describe acceso general del administrador y practicantes de organización | No hay herencia universal; ORGANIZACION no accede a asignaciones o planes. |
| README limita publicación y gestión de tutores a organización | ADMIN también puede operar; COORDINADOR puede consultar tutores. Los servicios mantienen controles de pertenencia. |
| Fase 1 contempla indicadores parciales y auditoría parcial para otros actores | RBAC limita indicadores a COORDINADOR/ADMIN y auditoría a ADMIN. Indicadores quedan fuera de S1. |
| README afirma que OpenAPI no puede desactualizarse | Los schemas de entrada son compartidos, pero descripciones, respuestas y reglas de servicio son manuales. Dominios, permisos y bloqueos requieren contrastar código. |
| OpenAPI describe 15 minutos/7 días y no enumera todos los errores generales | TTL configurables; refresh/logout/yo también pueden recibir rate limit. `/yo` puede devolver 404 para usuario eliminado. |
| `env.ts` usa solo `uni.edu.ni` por defecto | `.env.example` agrega `std.uni.edu.ni`; frontend y backend deberán configurarse de forma coincidente. |

## 8. Diseño visual y componentes

| Token | Valor o comportamiento |
|---|---|
| Identidad | Primario `#1F3864`, secundario/información `#2E5496`. |
| Estados | Éxito `#00B050`, advertencia `#ED7D31`, error `#C00000`; siempre texto e icono además del color. |
| Neutros | Texto `#202020`, secundario `#595959`, borde `#D9D9D9`, fondo `#F7F7F9`, superficies blancas. |
| Tipografía | Inter servida localmente, Arial/sans-serif como alternativa. Escala equivalente en rem a 12/14/16/20/24/32 px; interlineado 1.5. |
| Espaciado y forma | Escala 4/8/12/16/24/32/48 px; controles de radio 6 px y tarjetas de 8 px; sombra solo en elementos flotantes. |
| Adaptación | Móvil menor a 640 px, tableta de 640 a 1024 px y escritorio mayor a 1024 px. Operable a 360 px y con ampliación al 200 %. |
| Interacción | Altura móvil mínima 44 px, foco visible de 2 px, enlace para saltar al contenido, respeto a movimiento reducido. |

El contraste calculado de blanco con verde es aproximadamente 2.87:1 y con naranja 2.77:1. Se usarán esas superficies con texto `#202020` (aproximadamente 5.68:1 y 5.88:1), o variantes de tinta que cumplan AA. Se conserva la paleta y se corrige la afirmación de Fase 1 de que cualquier combinación ya superaba 4.6:1. Los bordes de controles y focos usarán variantes con contraste suficiente para identificar la interacción; el gris decorativo no será su única señal.

Button tendrá variantes primaria, secundaria, peligro y fantasma, estados de carga/deshabilitado y nombre accesible. Input, Select y Textarea admitirán etiqueta, ayuda, error, required y ref para formularios; mantendrán asociaciones de aria-describedby y aria-invalid. Card dará estructura semántica sin convertirla siempre en un elemento interactivo. Badge asociará estado, etiqueta e icono mediante una tabla de variantes.

Modal tendrá título y descripción accesibles, foco inicial, contención de foco, cierre por Escape y retorno al activador; usará Radix Dialog. Toast usará Radix, distinguirá confirmaciones y errores, ofrecerá cierre accesible y no será el único lugar donde permanezca un error de formulario. El menú «Más» usará el mismo comportamiento de diálogo para asegurar teclado y foco.

Tabla será genérica y controlada mediante columnas, filas e identidad de fila; incluirá cabeceras semánticas y orden accesible cuando se solicite. A 360 px se presentarán tarjetas con etiquetas de campo, sin duplicar contenido accesible. El orden y paginación de futuras listas de servidor pertenecerán a sus consumidores. Paginador manejará primera/última página y cero resultados, emitirá cambios válidos y anunciará la página actual. EmptyState tendrá título, explicación y acción opcional con destino real. Se comprobarán también estados de carga y error.

Los formularios usarán una columna en móvil y agrupación legible en pantallas amplias; el login no contendrá enlaces de recuperación o registro empresarial que no funcionen. La barra superior mostrará nombre, rol legible y logout. No habrá campana con un contador ficticio. Los ejemplos de componentes y datos controlados para pruebas se mantendrán en el entorno de pruebas, fuera de las pantallas de demo.

## 9. Consultas, mutaciones y configuración

QueryClient será único por instancia. En S1 se usará `retry: false` tanto para consultas como mutaciones y se desactivará la repetición automática por foco o reconexión; un botón explícito permitirá recuperar consultas fallidas. Esto evita que Query multiplique intentos de autenticación o de renovación fallida. El cliente HTTP conserva exclusivamente su repetición acotada tras un 401 autorizado.

La consulta de perfil se habilita solo con sesión autenticada, usa una clave asociada a identidad/generación y transmite AbortSignal. Login, registro y logout tendrán mutaciones con estados pendiente, éxito y error, sin reintentos automáticos. Los cambios de sesión limpian consultas y mutaciones anteriores. Los errores de consulta se muestran en la página con reintento; los de formularios permanecen en el formulario, evitando avisos globales duplicados por cada solicitud concurrente.

| Variable de frontend | Valor del ejemplo local | Regla |
|---|---|---|
| `VITE_API_URL` | `http://localhost:4000/api/v1` | URL pública validada al arrancar; no contiene secretos. |
| `VITE_DOMINIOS_INSTITUCIONALES` | `uni.edu.ni,std.uni.edu.ni` | Lista normalizada no vacía, igual a la configuración del servidor. |

README documentará Node 22, `npm ci`, copia de los ejemplos de entorno, PostgreSQL, migraciones, seed y arranque de ambos paquetes. Explicará el puerto fijo, CORS, la configuración de dominios y la fuente local. Las claves JWT y URLs privadas de BD nunca se expondrán como variables `VITE_*`.

## 10. Criterios de aceptación y verificación

La siguiente matriz especifica resultados exigidos, no resultados ya obtenidos. El plan posterior detallará archivos de prueba, comandos, fixtures y orden de TDD.

| ID | Criterio verificable | Evidencia prevista |
|---|---|---|
| S1-H1 | Instalación reproducible, React 18, TS estricto, estilos institucionales y origen 5173 fijo | `npm ci`, build, typecheck y lint; revisión del lock/configuración; carga de la SPA. |
| S1-H2 | Los once componentes solicitados tienen estados y comportamiento accesible | Testing Library y navegador: teclado, foco/retorno del Modal, Toast, Select, orden, paginación y vacío. |
| S1-H3 | Los seis roles ven su menú y todos sus enlaces resuelven | Matriz automatizada rol/destino; recorridos con cuentas seed; capturas a 360 px y escritorio. |
| S1-H4 | Rutas privadas esperan bootstrap; anónimo va a login; rol indebido recibe 403; desconocida recibe 404 | Tests de router y navegación directa, recarga y retorno interno seguro después de login. |
| S1-H5 | Token solo en memoria, una renovación por grupo y sin bucles; logout elimina datos privados | Pruebas de concurrencia/StrictMode y aislamiento de sesión; evidencia de red contra API real. |
| S1-H6 | Registro de estudiante y docente reproduce contrato; login funciona para seis roles | Tests de schemas/payloads y recorridos reales de registro, login y errores. |

Comportamientos críticos cubiertos con TDD:

- Un solo bootstrap bajo StrictMode, incluso tras resolución anónima; reintento explícito de restauración fallida.
- Varios 401 simultáneos producen un refresh; un 401 tardío usa la nueva versión; un JWT idéntico igualmente avanza la versión; cada petición se repite como máximo una vez.
- Login inválido, 403 de negocio y 429 no desencadenan renovación; `/auth/yo` sí puede recuperarse de 401. Fallo del refresh no inicia una cascada de nuevos intentos.
- Logout durante refresh/login respeta el orden de cookies, limpia inmediatamente el estado y descarta respuestas de consultas y mutaciones antiguas. Un 401 antiguo no invalida una sesión nueva.
- Cierre sin red conserva el indicador al recargar; confirmar 204 lo elimina; cambiar de usuario no recupera caché privada anterior.
- Validaciones de ambos roles, normalización de correo/carnet, omisión de opcionales vacíos, exclusión de confirmación y campos del otro rol; login empresarial sin filtro institucional.
- Menú y rutas derivan del mismo catálogo; tabla rol/ruta prueba permisos permitidos y denegados.

La demo y los recorridos integrados usarán el API y PostgreSQL reales, sin interceptar respuestas exitosas ni reemplazar datos. Las pruebas unitarias podrán usar transporte controlado para reproducir de forma determinista concurrencia, fallos y respuestas tardías. Esto no sustituye evidencia real de integración.

La verificación real incluirá registro de ambos perfiles, duplicados de correo y carnet, las seis cuentas seed, navegación directa sin sesión y con rol indebido, recarga, expiración de access token, refresh concurrente, logout, validación del servidor, bloqueo de cuenta y fallo de red. Para expiración se usará un proceso de API de prueba con TTL corto y base aislada; no se falsificará el token en la demo. Para bloqueo se usará una cuenta de prueba dedicada: el quinto fallo produce 401 y el siguiente 429. Un contexto real de navegador sin red comprobará recuperación y cierre pendiente. Se registrará por separado la comprobación de límites de tasa si el proceso usa `NODE_ENV=test`, donde esos límites están desactivados.

Las suites que migran o truncan tablas se ejecutarán únicamente contra `sigepp_test` o una base desechable identificada, nunca contra la base de demo o datos personales. No se ejecutará `db:reset` para preparar una verificación ordinaria. Las cuentas seed de los seis roles podrán cargarse en la base de prueba mediante el seed existente; las cuentas de registro y bloqueo serán exclusivas de la ejecución.

Se ejecutarán `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` y la suite de navegador documentada del frontend. El límite de JavaScript inicial de Fase 1 se comprobará en el build de producción: suma de bytes gzip de todos los archivos JS únicos necesarios para mostrar `/login` interactivo, con caché vacía y sesión anónima, incluidos los chunks compartidos y el chunk de login. El umbral será 250 000 bytes; módulos diferidos no solicitados, mapas de fuente, CSS y fuentes quedan fuera de esa suma y se informarán por separado. Si se supera, se optimizará la carga antes de aceptar el criterio; una desviación sin resolver se declarará pendiente. Cualquier medición de carga con red 4G describirá condiciones reales, sin deducir rendimiento únicamente del build.

La revisión visual cubrirá 360 px, tableta, escritorio, ampliación al 200 %, foco visible y ausencia de desbordamiento horizontal. Las comprobaciones automatizadas de accesibilidad no se presentarán como certificación completa WCAG ni sustituto de teclado/lector de pantalla; se registrará qué comprobaciones manuales se realizaron y en qué navegador.

## 11. Entrega y revisión

El resultado de implementación incluirá el paquete frontend, pruebas relevantes, instrucciones de instalación y demo en README, variables públicas de ejemplo, diferencias de permisos documentadas y un informe de evidencia que separe comprobaciones aprobadas, fallidas y no ejecutadas. La información de este diseño se trasladará al plan verificable S1-H1…H6 después de su aprobación.

Se respetarán ramas `feature/RF-XX-descripcion`, Conventional Commits en español y revisión hacia `develop`. La referencia local de `origin/develop` estaba nueve commits detrás de `main` durante esta revisión; no se ha consultado de nuevo el remoto. Se conservará el backend auditado y se revisará la base de integración antes de preparar el PR, evitando mezclar silenciosamente cambios ajenos con S1. No se integra ni publica código como parte de la redacción de esta especificación.

Antes de declarar la implementación técnicamente lista se aplicarán `superpowers:requesting-code-review` y `superpowers:verification-before-completion`. Si aparecen fallos se aplicará `superpowers:systematic-debugging`. La aprobación del compañero seguirá pendiente hasta que la persona correspondiente la emita; ni los tests ni la revisión de agentes la sustituyen.

## 12. Estado de la revisión y siguiente paso

El usuario aprobó los seis bloques de diseño para redactar esta especificación. Su revisión escrita debe resolver si estos contratos, límites y criterios representan correctamente lo acordado. Después de la aprobación explícita se invocará `superpowers:writing-plans`; el usuario revisará ese plan y elegirá ejecución mediante `superpowers:executing-plans` o `superpowers:subagent-driven-development` antes de implementar.

En la exploración inicial no había dependencias instaladas ni `.env` del backend, y la consulta de `/api/health` agotó el tiempo de espera. Son observaciones del entorno, no fallos verificados del producto. Durante esta etapa solo se revisa documentación: no se han ejecutado build, pruebas funcionales ni demo de frontend.
