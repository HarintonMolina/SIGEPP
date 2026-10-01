# Diagramas del modelo de datos — Fase 2

| Archivo | Contenido |
|---|---|
| `diagrama-entidad-relacion.png` / `.svg` | Diagrama entidad-relación de la base de datos implementada (18 entidades, 29 relaciones) |
| `diagrama-clases.png` / `.svg` | Diagrama de clases del dominio con atributos, operaciones de negocio y multiplicidades |
| `enumeraciones.md` | Valores de cada enumeración y los campos que la usan |
| `*.mmd` | Código Mermaid de cada diagrama |
| `tema-mermaid.json` | Tema visual (mismos colores que los diagramas de la Fase 1) |

Los diagramas se **generan a partir de `backend/prisma/schema.prisma`**, de modo que coinciden campo por campo con la base de datos real.

## Cómo regenerarlos

```bash
# 1. Código Mermaid y tabla de enumeraciones desde el esquema de Prisma
cd backend
npm run docs:diagramas

# 2. Imágenes (mermaid-cli descarga un navegador sin interfaz la primera vez)
cd ../docs/fase-2/diagramas
npx -p @mermaid-js/mermaid-cli mmdc -i diagrama-entidad-relacion.mmd -o diagrama-entidad-relacion.png -c tema-mermaid.json -b white -s 2
npx -p @mermaid-js/mermaid-cli mmdc -i diagrama-clases.mmd -o diagrama-clases.png -c tema-mermaid.json -b white -s 2
```

## Convenciones

**Diagrama entidad-relación**
- Entidades en mayúsculas y tipos en minúscula, como en la Fase 1.
- `PK` clave primaria, `FK` clave foránea, `UK` valor único. En los campos `enum` se indica la enumeración.
- Cardinalidad con notación de pata de gallo: `||` exactamente uno, `|o` cero o uno, `o{` cero o muchos.

**Diagrama de clases**
- Las claves foráneas no se listan como atributos: las representan las asociaciones.
- `-` marca los atributos privados (contraseña y control de bloqueo de la cuenta).
- Las operaciones corresponden a los servicios implementados en `backend/src/modules`.
- Composición (rombo relleno) donde la parte no existe sin el todo: el plan de trabajo, sus versiones, las bitácoras y las evaluaciones dependen de su asignación.
- Se omite `RefreshToken`, que es un mecanismo técnico de la sesión y no un concepto del dominio.

## Cambios respecto al modelo de la Fase 1

| Fase 1 | Implementación | Motivo |
|---|---|---|
| Identificadores `int` autoincrementales | Identificadores `string` (CUID) | No son secuenciales ni adivinables, lo que ayuda contra IDOR (Fase 1, Tabla 5.9) |
| Entidad `CARRERA` | Atributo `Estudiante.carrera` | La implementación cubre un solo programa académico (limitación de la sección 1.5.2) |
| Entidad `CRITERIO_EVALUACION` | `Rubrica.criterios` en JSONB | Se implementa como lo define la Tabla 5.8: rúbricas versionables por período |
| — | `RUBRICA` y `AUDITORIA` | Definidas en la Tabla 5.8; la auditoría responde al RNF-13 |
| — | `PLAN_TRABAJO_VERSION` | Historial inmutable de cada versión enviada a revisión (RF-15) |
| — | `REFRESH_TOKEN` | Sesiones con rotación del token de refresco y revocación al cerrar sesión |
| — | `Organizacion.representanteId` | Vincula la organización con la cuenta de su representante (RF-05) |
| — | `Usuario.intentosFallidos`, `bloqueos`, `bloqueadoHasta` | Bloqueo temporal tras 5 intentos fallidos (RNF-08) |
| — | `Plaza.ubicacion`, `motivoRechazo` y `aprobadaPorId` | Filtro por ubicación (RF-10) y trazabilidad de la revisión académica (RF-09) |
| — | `Documento.estudianteId` y `bitacoraId` | Currículo y constancias del estudiante, y evidencias de cada bitácora |
| — | `eliminadaEn` en `Asignacion` y `Bitacora` | Borrado lógico de los registros del expediente (sección 5.4.2) |

## Restricciones que no aparecen en los diagramas

La migración `restricciones` agrega reglas que Mermaid no puede representar:

- Índice único parcial `(estudianteId, periodoId)` sobre las asignaciones activas (**RN-02**).
- `CHECK` de cupos (`cuposOcupados <= cupos`), de horas por bitácora (1 a 90), de tutorados por docente (**RN-06**), de porcentaje de avance (0 a 100) y de orden de las fechas.
- Disparadores que impiden modificar o borrar `Evaluacion` (**RN-11**) y `Auditoria` (**RNF-13**).
