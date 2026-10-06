# SIGEPP

**Sistema de Gestión del Ejercicio Profesional y Prácticas Profesionales**
Programa Académico de Ingeniería en Sistemas — UNI, Recinto Universitario Simón Bolívar.

Proyecto de la asignatura *Diseño de Sistemas en Internet* (2026).
Integrantes: Leandro Enrique Lacayo Matus · Harinton Alberto Molina Narváez.

## Arquitectura

| Capa | Tecnología |
|---|---|
| Frontend (SPA) | React 18 · Vite · TypeScript · Tailwind CSS · TanStack Query |
| Backend (API REST) | Node.js 22 · Express 4 · TypeScript · Zod · JWT |
| Base de datos | PostgreSQL 16 · Prisma ORM |
| Documentación del API | OpenAPI 3.1 (Swagger UI) · colección Postman |

```
sigepp/
├── backend/            API REST (/api/v1)
├── frontend/           SPA
├── docs/               documentación por fase, diagramas, manual y evidencias
└── docker-compose.yml  PostgreSQL local
```

## Requisitos

- Node.js 22 (mínimo 22.12; anterior a 23); verificado con 22.21.0
- Docker Desktop (para PostgreSQL), o un PostgreSQL 16 instalado localmente

## Puesta en marcha del backend

```bash
# 1. Levantar PostgreSQL (crea las bases sigepp y sigepp_test)
docker compose up -d

# 2. Instalar dependencias y configurar variables de entorno
cd backend
npm ci
cp .env.example .env

# 3. Crear las tablas y cargar datos de prueba
npm run db:migrate
npm run db:seed

# 4. Iniciar el servidor en modo desarrollo
npm run dev
```

El API queda en `http://localhost:4000`. Verificación: `GET http://localhost:4000/api/health`.

## Puesta en marcha del frontend S1

Con el backend iniciado, abre otra terminal:

```powershell
cd frontend
npm ci
Copy-Item .env.example .env
npm run dev
```

La SPA usa `http://localhost:5173` con puerto estricto y el API base `http://localhost:4000/api/v1`.
El entorno público define `VITE_API_URL` y `VITE_DOMINIOS_INSTITUCIONALES=uni.edu.ni,std.uni.edu.ni`.
No pongas secretos ni URLs de BD en variables `VITE_*`.
En backend, `CORS_ORIGIN=http://localhost:5173` y `DOMINIOS_INSTITUCIONALES=uni.edu.ni,std.uni.edu.ni` deben coincidir.
Los correos empresariales del seed sirven para login; el registro abierto acepta estudiantes y tutores académicos institucionales.
Inter se distribuye localmente mediante `@fontsource/inter`, sin peticiones a Google Fonts.

### Verificación del frontend

```powershell
cd frontend
npm run typecheck
npm run lint
npm test
npm run build
node node_modules/@playwright/test/cli.js install chromium
npm run test:e2e
npm run test:e2e:production
npm run check:initial-size
npm run test:e2e:rate-limit
```

Los E2E requieren puertos 4000 y 5173 libres; detén tus servidores de demo antes de ejecutarlos.
El orquestador inicia sus propios servidores y crea una DB nueva `sigepp_e2e_<12 hex>`, migra y carga el seed existente.
No ejecuta tests backend ni resetea la demo. Cierra sus procesos y conserva la DB identificada en `.e2e/<id>/run.json`.
No hay limpieza automática de bases; una limpieza posterior debe indicar el nombre exacto.
`result.json` registra el estado y exit code después del cierre de procesos propios, también si la ronda falla.
En development, readiness comparte un presupuesto total de 45 s para HTTP200 y body completo de `/login`,
`/@vite/client`, `/src/main.tsx` y la entrada de fixture; zoom prepara solo la entrada de aplicación.
Cada intento conserva el límite de 1500 ms. Esto prepara respuestas de entrada, sin certificar todo el grafo.
Production conserva la medición inicial fría y cada prueba mantiene su timeout de 45 s.
Docker Compose/PostgreSQL 16 es la ruta habitual. En Windows sin Docker puede usarse PostgreSQL privado:

```powershell
$env:E2E_POSTGRES_BIN='C:/Program Files/PostgreSQL/18/bin'
npm run test:e2e
```

Este modo crea un clúster en `.e2e`, escucha solo en `127.0.0.1:55432`, usa SCRAM y no toca servicios en 5432.
La contraseña aleatoria no se guarda; una inspección posterior de esa DB requiere recuperar explícitamente el acceso.
En un sandbox que bloquee `initdb` con token restringido 87 se necesita autorizar su ejecución fuera del sandbox.
`npm run test:e2e:zoom` ejecuta una ronda separada con Chrome instalado y un perfil temporal nuevo para zoom nativo 200%.
Esa ronda separa control 100%, formularios 200% y shell 200%, con el mismo timeout de 45 s por caso.
Guarda métricas/versión/etapas en `.e2e/<id>/zoom-<caso>/proof.json` antes de las capturas; las imágenes usan
el clip DIP de CDP calibrado para conservar el documento completo con zoom nativo. La ruta se recalibra si cambia Chrome.
Verificación del 05/10: variantes visuales 1/1, login primario production 1/1, JS inicial 133506/250000 bytes gzip
y control100/formularios200 2/2 aprobados. Shell200 tiene evidencia anterior separada. Las suites completas
35/35 development y 25/25 production son históricas; las selecciones actuales40/26 no se acreditan como full finales.
La suite principal usa API `NODE_ENV=test` (sin límite IP); `rate-limit` crea otro API `development` para comprobar el intento 21.
La ronda production prueba el build de la SPA con Vite preview, no un despliegue HTTPS ni cookies `Secure` de un API de producción.

Consulta el [guion de demo](docs/fase-2/s1-frontend-demo.md) y la [evidencia y limitaciones](docs/fase-2/s1-frontend-verificacion.md).

### Scripts del backend

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor con recarga automática |
| `npm test` | Pruebas unitarias y de integración (usa la base `sigepp_test`) |
| `npm run lint` · `npm run typecheck` | Verificación de estilo y de tipos |
| `npm run db:migrate` | Aplica migraciones en desarrollo |
| `npm run db:seed` | Carga datos de prueba |
| `npm run db:reset` | Borra la base, reaplica migraciones y vuelve a cargar el seed |
| `npm run db:studio` | Abre Prisma Studio para explorar los datos |

### Cuentas de prueba (seed)

Todas usan la contraseña **`Sigepp2026`**.

| Rol | Correo |
|---|---|
| Administrador | `admin@uni.edu.ni` |
| Coordinador | `coordinacion.sistemas@uni.edu.ni` |
| Tutor académico | `jose.martinez@uni.edu.ni` |
| Organización | `rrhh@solucionesdigitales.example` |
| Tutor empresarial | `pedro.lopez@solucionesdigitales.example` |
| Estudiante | `maria.gonzalez@std.uni.edu.ni` |
| Estudiante con 74 % de avance (no cumple RN-01) | `diego.morales@std.uni.edu.ni` |

## API REST

Documentación interactiva (Swagger UI): **http://localhost:4000/api/docs**
Especificación OpenAPI 3.1: `http://localhost:4000/api/docs/openapi.json`

La especificación se genera a partir de los mismos esquemas Zod que validan cada petición, por lo que no puede quedar desactualizada respecto al código.

| Método | Ruta | Descripción | Rol |
|---|---|---|---|
| POST | `/api/v1/auth/registro` | Registro de estudiante o docente con correo institucional | Público |
| POST | `/api/v1/auth/login` | Devuelve `accessToken` (15 min) y la cookie de refresco `sigepp_rt` | Público |
| POST | `/api/v1/auth/refresh` | Renueva el token de acceso usando la cookie | Sesión |
| POST | `/api/v1/auth/logout` | Cierra la sesión | Sesión |
| GET | `/api/v1/auth/yo` | Usuario autenticado | Autenticado |
| POST | `/api/v1/organizaciones` | Registro de organización receptora (queda PENDIENTE) | Público |
| GET | `/api/v1/organizaciones` | Listado con filtro por estado | Coord., Admin. |
| GET | `/api/v1/organizaciones/mia` | Organización del representante | Organización |
| PATCH | `/api/v1/organizaciones/{id}/verificar` | Verificar y registrar vigencia del convenio | Coord., Admin. |
| GET · POST | `/api/v1/organizaciones/{id}/tutores` | Listar y dar de alta tutores empresariales | Organización |
| PATCH | `/api/v1/organizaciones/{id}/tutores/{tutorId}` | Dar de baja o reactivar un tutor | Organización |
| GET | `/api/v1/plazas` | Búsqueda con filtros, orden y paginación | Autenticado |
| GET | `/api/v1/plazas/filtros` | Opciones para el panel de filtros | Autenticado |
| GET | `/api/v1/plazas/mias` | Plazas de mi organización en todos sus estados | Organización |
| GET | `/api/v1/plazas/{id}` | Detalle de una plaza | Autenticado |
| POST | `/api/v1/plazas` | Publicar plaza (queda EN_REVISION) | Organización |
| PUT | `/api/v1/plazas/{id}` | Corregir una plaza en revisión o rechazada | Organización |
| PATCH | `/api/v1/plazas/{id}/aprobar` · `/rechazar` | Revisión académica de la plaza | Coord., Admin. |
| GET | `/api/v1/publico/plazas` | Plazas vigentes para sistemas externos | Público |
| GET | `/api/v1/asignaciones/candidatos` | Postulaciones preseleccionadas por asignar | Coord. |
| GET | `/api/v1/asignaciones/docentes` | Docentes con su carga de tutorados | Coord. |
| POST | `/api/v1/asignaciones` | Confirmar asignación y designar tutor académico | Coord. |
| GET | `/api/v1/asignaciones` | Asignaciones en las que participa el usuario | Partes, Coord. |
| GET | `/api/v1/asignaciones/actual` | Expediente activo del estudiante | Estudiante |
| GET | `/api/v1/asignaciones/{id}` | Expediente con línea de tiempo y progreso de horas | Partes, Coord. |
| GET · POST | `/api/v1/asignaciones/{id}/plan` | Consultar o crear el plan de trabajo | Partes · Estudiante |
| PUT | `/api/v1/planes-trabajo/{id}` | Editar el plan en borrador u observado | Estudiante |
| POST | `/api/v1/planes-trabajo/{id}/enviar` | Enviar a revisión (guarda una versión) | Estudiante |
| PATCH | `/api/v1/planes-trabajo/{id}/aprobar` · `/observar` | Revisión de cada tutor | Tutores |
| GET | `/api/v1/auditoria` | Bitácora de auditoría con filtros | Admin. |

Errores con formato uniforme:

```json
{ "error": { "codigo": "VALIDACION", "mensaje": "Los datos enviados no son válidos", "detalles": ["correo: Correo no válido"] } }
```

## Flujo de trabajo

- Ramas: `main` ← `develop` ← `feature/RF-XX-descripcion`
- Commits: [Conventional Commits](https://www.conventionalcommits.org/es/) (`feat(plazas): ...`, `fix(auth): ...`)
- Todo PR hacia `develop` es revisado por el otro integrante.

Plan detallado: [`docs/fase-2/plan-de-sprints.md`](docs/fase-2/plan-de-sprints.md).
