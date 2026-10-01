# SIGEPP

**Sistema de Gestión del Ejercicio Profesional y Prácticas Profesionales**
Programa Académico de Ingeniería en Sistemas — UNI, Recinto Universitario Simón Bolívar.

Proyecto de la asignatura *Diseño de Sistemas en Internet* (2026).
Integrantes: Leandro Enrique Lacayo Matus · Harinton Alberto Molina Narváez.

## Arquitectura

| Capa | Tecnología |
|---|---|
| Frontend (SPA) | React 18 · Vite · TypeScript · Tailwind CSS · TanStack Query |
| Backend (API REST) | Node.js 20+ · Express 4 · TypeScript · Zod · JWT |
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

- Node.js 20 o superior
- Docker Desktop (para PostgreSQL), o un PostgreSQL 16 instalado localmente

## Puesta en marcha del backend

```bash
# 1. Levantar PostgreSQL (crea las bases sigepp y sigepp_test)
docker compose up -d

# 2. Instalar dependencias y configurar variables de entorno
cd backend
npm install
cp .env.example .env

# 3. Crear las tablas y cargar datos de prueba
npm run db:migrate
npm run db:seed

# 4. Iniciar el servidor en modo desarrollo
npm run dev
```

El API queda en `http://localhost:4000`. Verificación: `GET http://localhost:4000/api/health`.

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
