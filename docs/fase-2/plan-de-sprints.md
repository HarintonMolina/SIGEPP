# SIGEPP — Plan de Sprints de la Fase 2

**Fase 2: Desarrollo Backend, Frontend y Servicios Web (30 pts)**
**Período:** jueves 1 al sábado 17 de octubre de 2026 · **Entrega:** 18 de octubre de 2026
**Equipo:** Leandro Enrique Lacayo Matus · Harinton Alberto Molina Narváez

> Nota de compatibilidad de S1 (04/10/2026): el frontend usa Node 22, mínimo 22.12, y Vite 8.3.2 en lugar del Vite 5 previsto originalmente. React 18, Tailwind 3.4 y Router 6.30 se conservan. Esta nota no cambia la planificación histórica ni aprueba historias de otros sprints. Ver [verificación S1](s1-frontend-verificacion.md) para resultados y deuda de dependencias.

---

## 1. Replanificación respecto a la Fase 1

La Tabla 7.2 del documento de la Fase 1 preveía los sprints S1 (07/09–20/09) y S2 (21/09–04/10) para los cimientos y el núcleo del negocio. Durante ese período el equipo cerró y defendió la Fase 1, y además pasó de tres a dos integrantes. Por eso se replanifica la Fase 2 en **tres sprints cortos de 5–6 días**, que concentran el alcance de S1, S2 y S3 originales, con la carga dividida en partes iguales.

| Sprint | Período | Objetivo | Entregable verificable |
|---|---|---|---|
| **S1** | jue 01/10 – mar 06/10 | Cimientos: repositorio, BD, autenticación, RBAC y armazón del frontend. | Inicio de sesión funcional en localhost contra PostgreSQL. |
| **S2** | mié 07/10 – lun 12/10 | Núcleo del negocio: organizaciones, plazas, aprobación, postulaciones y API pública. | Flujo *publicar → aprobar → buscar → postularse* completo; Swagger UI publicado. |
| **S3** | mar 13/10 – sáb 17/10 | Expediente (asignación, plan de trabajo, bitácoras), documentación y evidencias. | Flujo *postulación → bitácora* en localhost; colección Postman; anexo del documento. |

> El 18 de octubre de 2026 cae domingo (la guía dice "sábado 18"). Se planifica para tener todo listo el **sábado 17**; conviene confirmar la fecha exacta con el docente.

---

## 2. Alcance de la Fase 2

### Incluido

| Módulo | Requisitos |
|---|---|
| Usuarios y seguridad | RF-01, RF-02, RF-04 · RNF-05, RNF-07, RNF-08, RNF-13 |
| Organizaciones | RF-05, RF-06, RF-07 |
| Plazas | RF-08, RF-09, RF-10 |
| Postulaciones | RF-11, RF-12 |
| Asignaciones | RF-13 |
| Plan de trabajo | RF-14, RF-15 |
| Bitácoras | RF-16, RF-17, RF-18 (parcial) |
| Notificaciones | RF-23 (solo dentro de la aplicación) |
| Seguimiento | RF-24 |
| **Servicio web** | **RF-26 — API REST `/api/v1` + OpenAPI 3.1 (Swagger UI) + colección Postman** |

### Pospuesto a la Fase 3

RF-03 (recuperación de contraseña por correo), RF-19/RF-20 (evaluación y nota final), RF-21/RF-22 (PDF y expediente descargable), RF-23 por correo, RF-25 (indicadores), almacenamiento en Cloudinary, CI/CD y despliegue en Vercel/Render/Neon.

---

## 3. Estructura del repositorio

```
sigepp/
├── backend/            # Node.js 20 + Express 4 + TypeScript + Prisma 5
│   ├── prisma/         # schema.prisma, migraciones, seed
│   └── src/
│       ├── modules/    # auth, organizaciones, plazas, postulaciones, asignaciones,
│       │               # planes-trabajo, bitacoras, notificaciones
│       │               #   └── *.routes.ts · *.controller.ts · *.service.ts · *.schema.ts
│       ├── middleware/ # auth, rbac, validate, error, rate-limit, auditoria
│       ├── docs/       # registro OpenAPI
│       └── app.ts · server.ts
├── frontend/           # React 18 + Vite 5 + TypeScript + Tailwind + TanStack Query
│   └── src/
│       ├── api/  components/  features/  layouts/  routes/  hooks/
├── docs/               # documento, diagramas, manual, capturas, postman
├── docker-compose.yml  # PostgreSQL 16 local
└── README.md
```

---

## 4. Convenciones de trabajo colaborativo

- **Ramas:** `main` (entregable) ← `develop` (integración) ← `feature/RF-XX-descripcion`.
- **Commits:** Conventional Commits en español: `feat(plazas): filtro por modalidad`, `fix(auth): ...`, `docs: ...`, `test: ...`, `chore: ...`.
- **Pull requests:** toda rama `feature/*` entra a `develop` por PR **revisado por el otro integrante**. El PR referencia el RF y la tarea (p. ej. `S2-H3 · RF-10`).
- **Commits pequeños y frecuentes:** al menos uno por día de trabajo. El historial es parte de la evaluación.
- **Tablero:** GitHub Projects con columnas *Pila · Por hacer · En curso (máx. 2 por persona) · En revisión · Terminado*. Una tarjeta por tarea de este plan.
- **Sincronización:** reunión breve (15 min) al iniciar cada sprint y revisión/demo al cerrarlo.

### Definición de terminado

1. Compila en modo estricto sin errores y pasa el linter.
2. El endpoint valida la entrada con Zod, verifica rol **y** pertenencia del recurso, y está documentado en OpenAPI.
3. La pantalla funciona desde 360 px de ancho y consume el API real (sin datos simulados).
4. Las reglas de negocio involucradas tienen al menos una prueba (Vitest + Supertest).
5. El PR fue revisado y aprobado por el otro integrante.

---

## 5. Backlog por sprint

Estimación en puntos de historia (1 punto ≈ 1–2 h).
**L** = Leandro Lacayo · **H** = Harinton Molina.

### Sprint 1 — Cimientos (01/10 – 06/10)

| ID | Tarea | Req. | Resp. | Pts |
|---|---|---|---|---|
| S1-L1 | Monorepo, `.gitignore`, `.editorconfig`, ESLint/Prettier, README base | RNF-12 | L | 2 |
| S1-L2 | `docker-compose.yml` con PostgreSQL 16 y `.env.example` | — | L | 1 |
| S1-L3 | Armazón del backend: Express + TS estricto, capas, manejador de errores uniforme `{ error: { codigo, mensaje, detalles } }`, Helmet, CORS, rate-limit, `/api/health` | RNF-06/08 | L | 3 |
| S1-L4 | `schema.prisma` completo (16 entidades, enums de estado, UNIQUE/CHECK de la sección 5.4.2, índices, CUID) y migración inicial | — | L | 5 |
| S1-L5 | Seed: período activo, admin, coordinador, 3 docentes, 2 organizaciones, tutores, 5 estudiantes | — | L | 2 |
| S1-L6 | Auth: registro con dominio institucional, login JWT (15 min) + refresh en cookie HttpOnly (7 días), bcrypt 12, bloqueo tras 5 intentos | RF-01, RF-02 | L | 5 |
| S1-L7 | Middleware `requireRole` (matriz RBAC, Tabla 4.2) y middleware `validate(zodSchema)` | RF-04 | L | 2 |
| S1-H1 | Armazón del frontend: Vite + React 18 + TS, Tailwind con tokens del sistema de diseño, ESLint | RNF-12 | H | 3 |
| S1-H2 | Componentes base: Button, Input, Select, Textarea, Card, Badge de estado, Modal y Toast (Radix), Tabla, Paginador, EmptyState | RNF-04 | H | 5 |
| S1-H3 | AppShell mobile-first: menú lateral filtrado por rol, barra superior, navegación inferior en móvil | RNF-03 | H | 3 |
| S1-H4 | React Router: rutas anidadas, carga diferida, `ProtectedRoute` por rol, páginas 403/404 | RF-04 | H | 2 |
| S1-H5 | Cliente HTTP + TanStack Query: token en memoria, interceptor de refresco, manejo uniforme de errores | RF-02 | H | 3 |
| S1-H6 | Pantallas Login y Registro (React Hook Form + Zod) conectadas al API; contexto de sesión | RF-01, RF-02 | H | 4 |
| | | | **L: 20 · H: 20** | |

**Demo de cierre:** registrarse con correo institucional, iniciar sesión y ver el menú correspondiente al rol.

### Sprint 2 — Núcleo del negocio (07/10 – 12/10)

| ID | Tarea | Req. | Resp. | Pts |
|---|---|---|---|---|
| S2-L1 | OpenAPI 3.1 generado desde Zod + Swagger UI en `/api/docs` (incluye auth Bearer) | RF-26 | L | 3 |
| S2-L2 | API Organizaciones: registro, verificación y vigencia de convenio, alta/baja de tutores empresariales | RF-05/06/07, RN-12 | L | 3 |
| S2-L3 | API Plazas: crear en `EN_REVISION`, aprobar/rechazar, listar con búsqueda de texto, filtros, orden y paginación (`meta`), detalle | RF-08/09/10, RN-04 | L | 5 |
| S2-L4 | Endpoint público `GET /api/v1/publico/plazas` (sin auth, rate-limit propio) | RF-26 | L | 2 |
| S2-L5 | Front WF-07: publicar plaza y listado "Mis plazas" de la organización | RF-08 | L | 3 |
| S2-L6 | Front WF-06: bandeja del coordinador — aprobar plazas y verificar organizaciones | RF-06, RF-09 | L | 3 |
| S2-L7 | Pruebas de plazas y organizaciones (RN-04, RN-12) | RNF-12 | L | 2 |
| S2-H1 | API Postulaciones: crear con validación RN-01, RN-02, RN-03 (422) y duplicado/cupos (409); mis postulaciones; retirar | RF-11 | H | 5 |
| S2-H2 | API candidatos del tutor empresarial + preseleccionar/rechazar | RF-12 | H | 3 |
| S2-H3 | Front WF-02: bolsa de plazas con filtros, búsqueda y paginación | RF-10 | H | 4 |
| S2-H4 | Front WF-03: detalle de plaza, ficha de la organización y formulario de postulación con mensajes de reglas de negocio | RF-11 | H | 3 |
| S2-H5 | Front: "Mis postulaciones" (estados, retirar) y vista de candidatos del tutor empresarial | RF-11, RF-12 | H | 3 |
| S2-H6 | Pruebas de postulaciones (RN-01, RN-02, RN-03) y documentación OpenAPI de sus endpoints | RNF-12, RF-26 | H | 3 |
| | | | **L: 21 · H: 21** | |

**Demo de cierre:** la organización publica una plaza → el coordinador la aprueba → el estudiante la encuentra y se postula → el tutor empresarial lo preselecciona. Swagger UI accesible en `http://localhost:4000/api/docs`.

### Sprint 3 — Expediente, documentación y entrega (13/10 – 17/10)

| ID | Tarea | Req. | Resp. | Pts |
|---|---|---|---|---|
| S3-L1 | API Asignaciones: confirmar y designar tutor académico (RN-02, RN-05, RN-06); expediente con autorización por recurso (anti-IDOR) | RF-13 | L | 5 |
| S3-L2 | API Plan de trabajo: crear y versionar; aprobación de cada tutor (RN-07) | RF-14, RF-15 | L | 4 |
| S3-L3 | Front: confirmar asignación en `/panel`; editor del plan de trabajo, historial de versiones y vista de aprobación para tutores | RF-13/14/15 | L | 4 |
| S3-L4 | Middleware de auditoría de escrituras críticas | RNF-13 | L | 2 |
| S3-L5 | Colección Postman (entorno local, variables de token, pruebas básicas) + exportación de `openapi.json` | RF-26 | L | 2 |
| S3-L6 | **Documento:** diagrama de clases y diagrama ER actualizados al esquema Prisma real | Entregable 3 | L | 3 |
| S3-H1 | API Bitácoras: registrar/enviar (exige plan aprobado, horas 1–90), revisar (aprobar/observar), horas acumuladas, marca de atraso | RF-16/17/18 | H | 5 |
| S3-H2 | API Notificaciones dentro de la aplicación: listar, marcar como leída; emisión en cambios de estado | RF-23 | H | 2 |
| S3-H3 | Front WF-04: expediente con línea de tiempo de 6 hitos, bitácoras (lista, nueva, detalle) y revisión por tutor | RF-16/17, RF-24 | H | 5 |
| S3-H4 | Front WF-01: panel de inicio por rol + campana de notificaciones | RF-23, RF-24 | H | 3 |
| S3-H5 | **Documento:** Manual de Usuario (borrador) por rol, con capturas | Entregable 3 | H | 3 |
| S3-H6 | **Documento:** evidencias Frontend ↔ Backend ↔ BD (pestaña Red del navegador, Swagger, Postman, Prisma Studio/psql) | Entregable 3 | H | 2 |
| | | | **L: 20 · H: 20** | |

**Tareas conjuntas (cierre del 17/10):** integrar `develop` → `main` con PR revisado por ambos, README con instrucciones de instalación, ensayo de la demo y anexo de la Fase 2 en el documento (incluida la actualización de la Tabla 7.3 de roles a dos integrantes).

---

## 6. Resumen de la distribución

| Integrante | S1 | S2 | S3 | Total | Enfoque |
|---|---|---|---|---|---|
| Leandro Lacayo | 20 | 21 | 20 | **61** | Base del backend y BD, seguridad, organizaciones/plazas, asignaciones/plan de trabajo, OpenAPI y Postman, diagramas |
| Harinton Molina | 20 | 21 | 20 | **61** | Base del frontend y sistema de diseño, postulaciones, bitácoras, notificaciones, expediente, manual y evidencias |

Cada integrante entrega **módulos completos (API + pantallas + pruebas)** desde el Sprint 2, de modo que ambos dejan commits en backend, frontend y documentación.

---

## 7. Correspondencia con la rúbrica y los entregables

| Criterio / entregable | Dónde se cubre |
|---|---|
| Calidad del código / frontend (10) | S1-H1…H6, S2-H3…H5, S2-L5/L6, S3-L3, S3-H3/H4 |
| Lógica de negocio / backend y BD (10) | S1-L3…L7, S2-L2/L3, S2-H1/H2, S3-L1/L2/L4, S3-H1/H2 · pruebas de RN-01…RN-07 y RN-12 |
| Servicio web / API y su documentación (10) | S2-L1, S2-L4, S2-H6, S3-L5 (OpenAPI 3.1 + Swagger UI + Postman) |
| 1. Repositorio con historial colaborativo | Sección 4: ramas, PR con revisión cruzada, commits diarios |
| 2. Evidencia del servicio web | `/api/docs`, `openapi.json`, colección Postman, `/api/v1/publico/plazas` |
| 3. Documento avanzado | S3-L6 (diagramas), S3-H5 (manual), S3-H6 (capturas) |

---

## 8. Riesgos específicos de la Fase 2

| Riesgo | Mitigación |
|---|---|
| El frontend se bloquea esperando endpoints | Acordar al inicio del sprint los esquemas Zod / contratos OpenAPI; el frontend puede avanzar contra el contrato. |
| Conflictos de merge en `schema.prisma` | Solo Leandro modifica el esquema; los cambios que necesite Harinton se piden por PR pequeño o issue. |
| Aportes desiguales en el historial | Tareas balanceadas por puntos y revisión cruzada obligatoria de PR. |
| Falta de tiempo en S3 | Prioridad: asignación → plan → bitácoras. Si algo no entra, notificaciones y auditoría pasan a la Fase 3. |
