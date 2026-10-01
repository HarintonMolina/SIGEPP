-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ESTUDIANTE', 'TUTOR_ACADEMICO', 'TUTOR_EMPRESARIAL', 'ORGANIZACION', 'COORDINADOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "EstadoVerificacion" AS ENUM ('PENDIENTE', 'VERIFICADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "Modalidad" AS ENUM ('PRESENCIAL', 'REMOTA', 'HIBRIDA');

-- CreateEnum
CREATE TYPE "EstadoPlaza" AS ENUM ('EN_REVISION', 'APROBADA', 'RECHAZADA', 'CERRADA');

-- CreateEnum
CREATE TYPE "EstadoPostulacion" AS ENUM ('POSTULADA', 'PRESELECCIONADA', 'RECHAZADA', 'RETIRADA', 'ASIGNADA');

-- CreateEnum
CREATE TYPE "EstadoAsignacion" AS ENUM ('ASIGNADA', 'EN_CURSO', 'FINALIZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "EstadoPlan" AS ENUM ('BORRADOR', 'EN_REVISION', 'OBSERVADO', 'APROBADO');

-- CreateEnum
CREATE TYPE "EstadoBitacora" AS ENUM ('BORRADOR', 'ENVIADA', 'OBSERVADA', 'APROBADA');

-- CreateEnum
CREATE TYPE "TipoEvaluador" AS ENUM ('ACADEMICO', 'EMPRESARIAL');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('CARTA_PRESENTACION', 'CONSTANCIA_PRACTICAS', 'ACTA_APROBACION', 'CONSTANCIA_ACADEMICA', 'CURRICULO', 'EVIDENCIA');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "hashContrasena" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "estado" "EstadoUsuario" NOT NULL DEFAULT 'ACTIVO',
    "telefono" TEXT,
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueos" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "revocadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estudiante" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "carnet" TEXT NOT NULL,
    "carrera" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "porcentajeAvance" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "avanceVerificado" BOOLEAN NOT NULL DEFAULT false,
    "constanciaUrl" TEXT,

    CONSTRAINT "Estudiante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Docente" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "departamento" TEXT NOT NULL,
    "especialidad" TEXT,
    "cupoMaximo" INTEGER NOT NULL DEFAULT 8,
    "cupoOcupado" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Docente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organizacion" (
    "id" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "sitioWeb" TEXT,
    "estadoVerificacion" "EstadoVerificacion" NOT NULL DEFAULT 'PENDIENTE',
    "convenioVigenteHasta" TIMESTAMP(3),
    "representanteId" TEXT NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorEmpresarial" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TutorEmpresarial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Periodo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "semestre" INTEGER NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "horasMinimas" INTEGER NOT NULL DEFAULT 240,
    "convocatoriaAbierta" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Periodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plaza" (
    "id" TEXT NOT NULL,
    "organizacionId" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "modalidad" "Modalidad" NOT NULL,
    "ubicacion" TEXT NOT NULL,
    "cupos" INTEGER NOT NULL,
    "cuposOcupados" INTEGER NOT NULL DEFAULT 0,
    "horario" TEXT NOT NULL,
    "competencias" TEXT[],
    "estado" "EstadoPlaza" NOT NULL DEFAULT 'EN_REVISION',
    "motivoRechazo" TEXT,
    "aprobadaPorId" TEXT,
    "publicadaEn" TIMESTAMP(3),
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plaza_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Postulacion" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "plazaId" TEXT NOT NULL,
    "cartaMotivacion" TEXT NOT NULL,
    "estado" "EstadoPostulacion" NOT NULL DEFAULT 'POSTULADA',
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltaEn" TIMESTAMP(3),

    CONSTRAINT "Postulacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asignacion" (
    "id" TEXT NOT NULL,
    "postulacionId" TEXT NOT NULL,
    "estudianteId" TEXT NOT NULL,
    "plazaId" TEXT NOT NULL,
    "docenteId" TEXT NOT NULL,
    "tutorEmpresarialId" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,
    "estado" "EstadoAsignacion" NOT NULL DEFAULT 'ASIGNADA',
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "horasAcumuladas" INTEGER NOT NULL DEFAULT 0,
    "notaFinal" DECIMAL(5,2),
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eliminadaEn" TIMESTAMP(3),

    CONSTRAINT "Asignacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanTrabajo" (
    "id" TEXT NOT NULL,
    "asignacionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "objetivos" TEXT NOT NULL,
    "actividades" JSONB NOT NULL,
    "horasPrevistas" INTEGER NOT NULL,
    "estado" "EstadoPlan" NOT NULL DEFAULT 'BORRADOR',
    "aprobadoDocenteEn" TIMESTAMP(3),
    "aprobadoEmpresaEn" TIMESTAMP(3),
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanTrabajo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanTrabajoVersion" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "objetivos" TEXT NOT NULL,
    "actividades" JSONB NOT NULL,
    "horasPrevistas" INTEGER NOT NULL,
    "observacionDocente" TEXT,
    "observacionEmpresa" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanTrabajoVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bitacora" (
    "id" TEXT NOT NULL,
    "asignacionId" TEXT NOT NULL,
    "quincena" INTEGER NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "actividades" TEXT NOT NULL,
    "horas" INTEGER NOT NULL,
    "estado" "EstadoBitacora" NOT NULL DEFAULT 'BORRADOR',
    "observacionTutor" TEXT,
    "extemporanea" BOOLEAN NOT NULL DEFAULT false,
    "enviadaEn" TIMESTAMP(3),
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eliminadaEn" TIMESTAMP(3),

    CONSTRAINT "Bitacora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rubrica" (
    "id" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoEvaluador" "TipoEvaluador" NOT NULL,
    "criterios" JSONB NOT NULL,
    "puntajeMaximo" INTEGER NOT NULL DEFAULT 100,
    "vigente" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Rubrica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluacion" (
    "id" TEXT NOT NULL,
    "asignacionId" TEXT NOT NULL,
    "rubricaId" TEXT NOT NULL,
    "evaluadorId" TEXT NOT NULL,
    "tipoEvaluador" "TipoEvaluador" NOT NULL,
    "respuestas" JSONB NOT NULL,
    "puntaje" DECIMAL(5,2) NOT NULL,
    "observaciones" TEXT,
    "enviadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evaluacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "estudianteId" TEXT,
    "asignacionId" TEXT,
    "bitacoraId" TEXT,
    "tipo" "TipoDocumento" NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "hashSha256" TEXT NOT NULL,
    "codigoVerificacion" TEXT,
    "generadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "enlace" TEXT,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "valoresAnteriores" JSONB,
    "valoresNuevos" JSONB,
    "ip" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_correo_key" ON "Usuario"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_usuarioId_idx" ON "RefreshToken"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Estudiante_usuarioId_key" ON "Estudiante"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Estudiante_carnet_key" ON "Estudiante"("carnet");

-- CreateIndex
CREATE UNIQUE INDEX "Docente_usuarioId_key" ON "Docente"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Organizacion_ruc_key" ON "Organizacion"("ruc");

-- CreateIndex
CREATE UNIQUE INDEX "Organizacion_representanteId_key" ON "Organizacion"("representanteId");

-- CreateIndex
CREATE UNIQUE INDEX "TutorEmpresarial_usuarioId_key" ON "TutorEmpresarial"("usuarioId");

-- CreateIndex
CREATE INDEX "TutorEmpresarial_organizacionId_idx" ON "TutorEmpresarial"("organizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "Periodo_anio_semestre_key" ON "Periodo"("anio", "semestre");

-- CreateIndex
CREATE INDEX "Plaza_estado_periodoId_area_idx" ON "Plaza"("estado", "periodoId", "area");

-- CreateIndex
CREATE INDEX "Plaza_organizacionId_idx" ON "Plaza"("organizacionId");

-- CreateIndex
CREATE INDEX "Postulacion_plazaId_estado_idx" ON "Postulacion"("plazaId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "Postulacion_estudianteId_plazaId_key" ON "Postulacion"("estudianteId", "plazaId");

-- CreateIndex
CREATE UNIQUE INDEX "Asignacion_postulacionId_key" ON "Asignacion"("postulacionId");

-- CreateIndex
CREATE INDEX "Asignacion_estado_periodoId_idx" ON "Asignacion"("estado", "periodoId");

-- CreateIndex
CREATE INDEX "Asignacion_docenteId_periodoId_idx" ON "Asignacion"("docenteId", "periodoId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanTrabajo_asignacionId_key" ON "PlanTrabajo"("asignacionId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanTrabajoVersion_planId_version_key" ON "PlanTrabajoVersion"("planId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Bitacora_asignacionId_quincena_key" ON "Bitacora"("asignacionId", "quincena");

-- CreateIndex
CREATE UNIQUE INDEX "Evaluacion_asignacionId_tipoEvaluador_key" ON "Evaluacion"("asignacionId", "tipoEvaluador");

-- CreateIndex
CREATE UNIQUE INDEX "Documento_codigoVerificacion_key" ON "Documento"("codigoVerificacion");

-- CreateIndex
CREATE INDEX "Documento_asignacionId_idx" ON "Documento"("asignacionId");

-- CreateIndex
CREATE INDEX "Documento_estudianteId_idx" ON "Documento"("estudianteId");

-- CreateIndex
CREATE INDEX "Notificacion_usuarioId_leida_idx" ON "Notificacion"("usuarioId", "leida");

-- CreateIndex
CREATE INDEX "Auditoria_entidad_entidadId_idx" ON "Auditoria"("entidad", "entidadId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estudiante" ADD CONSTRAINT "Estudiante_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Docente" ADD CONSTRAINT "Docente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organizacion" ADD CONSTRAINT "Organizacion_representanteId_fkey" FOREIGN KEY ("representanteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorEmpresarial" ADD CONSTRAINT "TutorEmpresarial_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorEmpresarial" ADD CONSTRAINT "TutorEmpresarial_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plaza" ADD CONSTRAINT "Plaza_organizacionId_fkey" FOREIGN KEY ("organizacionId") REFERENCES "Organizacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plaza" ADD CONSTRAINT "Plaza_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "Periodo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plaza" ADD CONSTRAINT "Plaza_aprobadaPorId_fkey" FOREIGN KEY ("aprobadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postulacion" ADD CONSTRAINT "Postulacion_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postulacion" ADD CONSTRAINT "Postulacion_plazaId_fkey" FOREIGN KEY ("plazaId") REFERENCES "Plaza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asignacion" ADD CONSTRAINT "Asignacion_postulacionId_fkey" FOREIGN KEY ("postulacionId") REFERENCES "Postulacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asignacion" ADD CONSTRAINT "Asignacion_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asignacion" ADD CONSTRAINT "Asignacion_plazaId_fkey" FOREIGN KEY ("plazaId") REFERENCES "Plaza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asignacion" ADD CONSTRAINT "Asignacion_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "Docente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asignacion" ADD CONSTRAINT "Asignacion_tutorEmpresarialId_fkey" FOREIGN KEY ("tutorEmpresarialId") REFERENCES "TutorEmpresarial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asignacion" ADD CONSTRAINT "Asignacion_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "Periodo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanTrabajo" ADD CONSTRAINT "PlanTrabajo_asignacionId_fkey" FOREIGN KEY ("asignacionId") REFERENCES "Asignacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanTrabajoVersion" ADD CONSTRAINT "PlanTrabajoVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PlanTrabajo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bitacora" ADD CONSTRAINT "Bitacora_asignacionId_fkey" FOREIGN KEY ("asignacionId") REFERENCES "Asignacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rubrica" ADD CONSTRAINT "Rubrica_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "Periodo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluacion" ADD CONSTRAINT "Evaluacion_asignacionId_fkey" FOREIGN KEY ("asignacionId") REFERENCES "Asignacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluacion" ADD CONSTRAINT "Evaluacion_rubricaId_fkey" FOREIGN KEY ("rubricaId") REFERENCES "Rubrica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluacion" ADD CONSTRAINT "Evaluacion_evaluadorId_fkey" FOREIGN KEY ("evaluadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_estudianteId_fkey" FOREIGN KEY ("estudianteId") REFERENCES "Estudiante"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_asignacionId_fkey" FOREIGN KEY ("asignacionId") REFERENCES "Asignacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_bitacoraId_fkey" FOREIGN KEY ("bitacoraId") REFERENCES "Bitacora"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auditoria" ADD CONSTRAINT "Auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
