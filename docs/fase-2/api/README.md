# Documentación del servicio web — Fase 2

El API REST de SIGEPP se documenta con dos estándares modernos:

| Archivo | Contenido |
|---|---|
| `openapi.json` | Especificación **OpenAPI 3.1** completa (29 rutas), generada desde los esquemas de validación Zod |
| `SIGEPP.postman_collection.json` | Colección **Postman** con 54 peticiones organizadas como un recorrido completo del proceso, con pruebas automáticas |
| `SIGEPP-local.postman_environment.json` | Entorno de Postman para el servidor local (URL, cuentas del seed y variables de sesión) |

La documentación interactiva (Swagger UI) está disponible con el servidor encendido en **http://localhost:4000/api/docs**.

## Colección de Postman

Las carpetas siguen el orden del proceso de prácticas y cada petición guarda en el entorno los datos que necesitan las siguientes (tokens, identificadores):

| Carpeta | Peticiones | Qué demuestra |
|---|---|---|
| 0. Salud del servicio | 1 | API y base de datos en línea |
| 1. Autenticación | 10 | Inicio de sesión de los 6 roles, registro con correo institucional y errores |
| 2. Organizaciones | 8 | Registro público, verificación del convenio y alta/baja de tutores |
| 3. Plazas | 14 | Publicación, revisión académica (RN-04), rechazo y corrección, búsqueda y filtros |
| 4. API pública | 1 | Consulta sin autenticación con CORS abierto (RF-26) |
| 5. Asignaciones | 7 | Confirmación de la asignación y expediente según el rol (RN-02, RN-05, RN-06) |
| 6. Plan de trabajo | 11 | Observación, nueva versión y aprobación de ambos tutores (RN-07) |
| 7. Auditoría | 2 | Bitácora de operaciones críticas (RNF-13) |

Además, a nivel de colección se verifica en cada respuesta que:

- los errores sigan el formato `{ error: { codigo, mensaje, detalles } }`;
- las consultas `GET` respondan en menos de 500 ms (RNF-01).

### Ejecución

1. Importa en Postman la colección y el entorno, y selecciona el entorno **SIGEPP — Local**.
2. Restablece los datos de prueba: `cd backend && npm run db:reset`.
3. Inicia el API con `npm run dev` y usa **Run collection**.

Desde la terminal:

```bash
npx newman run docs/fase-2/api/SIGEPP.postman_collection.json \
  -e docs/fase-2/api/SIGEPP-local.postman_environment.json
```

El API limita a 100 peticiones por minuto por IP (RNF-08) y la colección hace 54: entre dos ejecuciones completas hay que esperar un minuto.

**Resultado de referencia:** 54 peticiones, 144 aserciones, 0 fallos, tiempo de respuesta promedio de 61 ms. El reporte está en `docs/fase-2/evidencias/reporte-postman.html`.

## Regenerar la especificación OpenAPI

```bash
cd backend
npm run docs:openapi
```
