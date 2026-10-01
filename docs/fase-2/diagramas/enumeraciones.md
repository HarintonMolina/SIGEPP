# Enumeraciones del modelo de datos

Generado por `npm run docs:diagramas` a partir de `backend/prisma/schema.prisma`.

| Enumeración | Valores | Usada en |
|---|---|---|
| `Rol` | `ESTUDIANTE`, `TUTOR_ACADEMICO`, `TUTOR_EMPRESARIAL`, `ORGANIZACION`, `COORDINADOR`, `ADMIN` | Usuario.rol |
| `EstadoUsuario` | `ACTIVO`, `INACTIVO` | Usuario.estado |
| `EstadoVerificacion` | `PENDIENTE`, `VERIFICADA`, `RECHAZADA` | Organizacion.estadoVerificacion |
| `Modalidad` | `PRESENCIAL`, `REMOTA`, `HIBRIDA` | Plaza.modalidad |
| `EstadoPlaza` | `EN_REVISION`, `APROBADA`, `RECHAZADA`, `CERRADA` | Plaza.estado |
| `EstadoPostulacion` | `POSTULADA`, `PRESELECCIONADA`, `RECHAZADA`, `RETIRADA`, `ASIGNADA` | Postulacion.estado |
| `EstadoAsignacion` | `ASIGNADA`, `EN_CURSO`, `FINALIZADA`, `CANCELADA` | Asignacion.estado |
| `EstadoPlan` | `BORRADOR`, `EN_REVISION`, `OBSERVADO`, `APROBADO` | PlanTrabajo.estado |
| `EstadoBitacora` | `BORRADOR`, `ENVIADA`, `OBSERVADA`, `APROBADA` | Bitacora.estado |
| `TipoEvaluador` | `ACADEMICO`, `EMPRESARIAL` | Rubrica.tipoEvaluador, Evaluacion.tipoEvaluador |
| `TipoDocumento` | `CARTA_PRESENTACION`, `CONSTANCIA_PRACTICAS`, `ACTA_APROBACION`, `CONSTANCIA_ACADEMICA`, `CURRICULO`, `EVIDENCIA` | Documento.tipo |
