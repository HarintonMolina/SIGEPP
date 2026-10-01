-- Restricciones de integridad que Prisma no puede declarar en schema.prisma
-- (Fase 1, sección 5.4.2). Se aplican como una migración propia después de "init".

-- RN-02: un estudiante no puede tener más de una asignación activa en el mismo período.
CREATE UNIQUE INDEX "Asignacion_estudiante_periodo_activa_key"
  ON "Asignacion" ("estudianteId", "periodoId")
  WHERE "estado" IN ('ASIGNADA', 'EN_CURSO') AND "eliminadaEn" IS NULL;

-- Los cupos ocupados nunca superan los cupos de la plaza.
ALTER TABLE "Plaza"
  ADD CONSTRAINT "Plaza_cupos_check" CHECK ("cupos" > 0 AND "cuposOcupados" >= 0 AND "cuposOcupados" <= "cupos");

-- Horas de una bitácora quincenal entre 1 y 90.
ALTER TABLE "Bitacora"
  ADD CONSTRAINT "Bitacora_horas_check" CHECK ("horas" > 0 AND "horas" <= 90);

-- RN-06: un tutor académico supervisa como máximo a su cupo (8 por defecto).
ALTER TABLE "Docente"
  ADD CONSTRAINT "Docente_cupo_check" CHECK ("cupoOcupado" >= 0 AND "cupoOcupado" <= "cupoMaximo");

-- Avance académico expresado como porcentaje.
ALTER TABLE "Estudiante"
  ADD CONSTRAINT "Estudiante_avance_check" CHECK ("porcentajeAvance" >= 0 AND "porcentajeAvance" <= 100);

-- Fechas coherentes.
ALTER TABLE "Periodo"
  ADD CONSTRAINT "Periodo_fechas_check" CHECK ("fechaFin" > "fechaInicio");
ALTER TABLE "Asignacion"
  ADD CONSTRAINT "Asignacion_fechas_check" CHECK ("fechaFin" > "fechaInicio");
ALTER TABLE "Bitacora"
  ADD CONSTRAINT "Bitacora_fechas_check" CHECK ("fechaFin" >= "fechaInicio");

-- RN-11 y RNF-13: las evaluaciones y la bitácora de auditoría son inmutables.
CREATE FUNCTION "impedir_modificacion"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'La tabla % es inmutable: no se permite %', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Evaluacion_inmutable"
  BEFORE UPDATE OR DELETE ON "Evaluacion"
  FOR EACH ROW EXECUTE FUNCTION "impedir_modificacion"();

CREATE TRIGGER "Auditoria_inmutable"
  BEFORE UPDATE OR DELETE ON "Auditoria"
  FOR EACH ROW EXECUTE FUNCTION "impedir_modificacion"();
