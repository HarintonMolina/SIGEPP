/**
 * Genera el código Mermaid del diagrama entidad-relación y del diagrama de clases
 * a partir del esquema de Prisma, para que la documentación coincida siempre con
 * la base de datos real.
 *
 * Uso: npm run docs:diagramas
 * Las imágenes se renderizan con mermaid-cli (ver docs/fase-2/diagramas/README.md).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Prisma } from '@prisma/client';

type Modelo = (typeof Prisma.dmmf.datamodel.models)[number];
type Campo = Modelo['fields'][number];

const DESTINO = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/fase-2/diagramas');
const { models: modelos, enums } = Prisma.dmmf.datamodel;
const nombresEnums = new Set(enums.map((e) => e.name));

// ─── Utilidades ────────────────────────────────────────────────

/** PlanTrabajoVersion → PLAN_TRABAJO_VERSION (convención del diagrama de la Fase 1). */
const entidad = (nombre: string) => nombre.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();

const TIPOS_SQL: Record<string, string> = {
  String: 'string',
  Int: 'int',
  Decimal: 'decimal',
  Boolean: 'boolean',
  DateTime: 'datetime',
  Json: 'jsonb',
};

const tipoSql = (campo: Campo) => {
  const base = nombresEnums.has(campo.type) ? 'enum' : (TIPOS_SQL[campo.type] ?? campo.type);
  return campo.isList ? `${base}_array` : base;
};

/** Campos que son clave foránea en el modelo. */
const clavesForaneas = (modelo: Modelo) =>
  new Set(modelo.fields.flatMap((c) => (c.kind === 'object' ? (c.relationFromFields ?? []) : [])));

/** Etiquetas de las relaciones con el vocabulario del dominio. Clave: Modelo.campoDeRelación */
const ETIQUETAS: Record<string, string> = {
  'Estudiante.usuario': 'tiene perfil de',
  'Docente.usuario': 'tiene perfil de',
  'TutorEmpresarial.usuario': 'tiene perfil de',
  'Organizacion.representante': 'representa',
  'RefreshToken.usuario': 'mantiene sesión',
  'TutorEmpresarial.organizacion': 'emplea',
  'Plaza.organizacion': 'publica',
  'Plaza.periodo': 'enmarca',
  'Plaza.aprobadaPor': 'aprueba',
  'Postulacion.estudiante': 'envía',
  'Postulacion.plaza': 'recibe',
  'Asignacion.postulacion': 'deriva en',
  'Asignacion.estudiante': 'realiza',
  'Asignacion.plaza': 'concreta',
  'Asignacion.docente': 'supervisa (académico)',
  'Asignacion.tutorEmpresarial': 'supervisa (empresa)',
  'Asignacion.periodo': 'agrupa',
  'PlanTrabajo.asignacion': 'define',
  'PlanTrabajoVersion.plan': 'versiona',
  'Bitacora.asignacion': 'acumula',
  'Rubrica.periodo': 'habilita',
  'Evaluacion.asignacion': 'recibe',
  'Evaluacion.rubrica': 'aplica',
  'Evaluacion.evaluador': 'evalúa',
  'Documento.estudiante': 'adjunta',
  'Documento.asignacion': 'genera',
  'Documento.bitacora': 'evidencia',
  'Notificacion.usuario': 'recibe',
  'Auditoria.usuario': 'registra',
};

/** Relaciones del lado que tiene la clave foránea (hijo → padre). */
const relaciones = () =>
  modelos.flatMap((modelo) =>
    modelo.fields
      .filter((c) => c.kind === 'object' && c.relationFromFields?.length)
      .map((c) => {
        const fk = modelo.fields.find((f) => f.name === c.relationFromFields![0])!;
        return {
          padre: c.type,
          hijo: modelo.name,
          campo: c.name,
          etiqueta: ETIQUETAS[`${modelo.name}.${c.name}`] ?? c.name,
          unoAUno: fk.isUnique,
          opcional: !c.isRequired,
        };
      }),
  );

// ─── Diagrama entidad-relación ─────────────────────────────────

const generarER = () => {
  const lineas = ['erDiagram'];

  for (const r of relaciones()) {
    const ladoPadre = r.opcional ? '|o' : '||';
    const ladoHijo = r.unoAUno ? 'o|' : 'o{';
    lineas.push(
      `  ${entidad(r.padre)} ${ladoPadre}--${ladoHijo} ${entidad(r.hijo)} : "${r.etiqueta}"`,
    );
  }

  for (const modelo of modelos) {
    const fks = clavesForaneas(modelo);
    lineas.push(`  ${entidad(modelo.name)} {`);
    for (const campo of modelo.fields.filter((c) => c.kind !== 'object')) {
      const claves = [campo.isId && 'PK', fks.has(campo.name) && 'FK', campo.isUnique && 'UK']
        .filter(Boolean)
        .join(', ');
      const comentario = nombresEnums.has(campo.type) ? ` "${campo.type}"` : '';
      lineas.push(`    ${tipoSql(campo)} ${campo.name}${claves ? ` ${claves}` : ''}${comentario}`);
    }
    lineas.push('  }');
  }

  return `${lineas.join('\n')}\n`;
};

// ─── Diagrama de clases del dominio ────────────────────────────

/** Clases técnicas que no forman parte del modelo de dominio. */
const EXCLUIDAS_CLASES = new Set(['RefreshToken']);

/** Campos sensibles que se muestran como privados. */
const PRIVADOS = new Set(['hashContrasena', 'intentosFallidos', 'bloqueos', 'bloqueadoHasta']);

/** Operaciones de negocio implementadas en los servicios del backend. */
const OPERACIONES: Record<string, string[]> = {
  Usuario: [
    '+registrar(datos) Usuario',
    '+iniciarSesion(correo, contrasena) Sesion',
    '-bloquearPorIntentos()',
  ],
  Organizacion: [
    '+registrar(datos, representante) Organizacion',
    '+verificar(estado, convenioVigenteHasta)',
    '+tieneConvenioVigente() boolean',
    '+darDeAltaTutor(datos) TutorEmpresarial',
  ],
  TutorEmpresarial: ['+darDeBaja()', '+reactivar()'],
  Docente: ['+tieneCupo() boolean'],
  Plaza: [
    '+publicar(datos) Plaza',
    '+aprobar(coordinador)',
    '+rechazar(motivo)',
    '+corregir(datos)',
    '+cuposDisponibles() int',
  ],
  Postulacion: ['+preseleccionar()', '+rechazar()', '+retirar()'],
  Asignacion: [
    '+confirmar(postulacion, docente, tutor) Asignacion',
    '+hitos() Hito[]',
    '+progreso() Progreso',
  ],
  PlanTrabajo: [
    '+actualizar(objetivos, actividades)',
    '+enviarARevision() PlanTrabajoVersion',
    '+aprobar(tutor)',
    '+observar(tutor, observacion)',
  ],
  Bitacora: ['+enviar()', '+revisar(decision, observacion)'],
  Notificacion: ['+marcarLeida()'],
};

/** Composiciones: la parte no existe sin el todo. */
const COMPOSICIONES = new Set([
  'PlanTrabajo.asignacion',
  'PlanTrabajoVersion.plan',
  'Bitacora.asignacion',
  'Evaluacion.asignacion',
]);

const tipoClase = (campo: Campo) => `${campo.type}${campo.isList ? '[]' : ''}`;

const generarClases = () => {
  const lineas = ['classDiagram', '  direction LR'];
  const incluidos = modelos.filter((m) => !EXCLUIDAS_CLASES.has(m.name));

  for (const modelo of incluidos) {
    const fks = clavesForaneas(modelo);
    lineas.push(`  class ${modelo.name} {`);
    for (const campo of modelo.fields) {
      // Las claves foráneas se representan con las asociaciones, no como atributos.
      if (campo.kind === 'object' || fks.has(campo.name)) continue;
      const visibilidad = PRIVADOS.has(campo.name) ? '-' : '+';
      lineas.push(`    ${visibilidad}${tipoClase(campo)} ${campo.name}`);
    }
    for (const operacion of OPERACIONES[modelo.name] ?? []) lineas.push(`    ${operacion}`);
    lineas.push('  }');
  }

  for (const r of relaciones()) {
    if (EXCLUIDAS_CLASES.has(r.hijo) || EXCLUIDAS_CLASES.has(r.padre)) continue;
    const multPadre = r.opcional ? '0..1' : '1';
    const multHijo = r.unoAUno ? '0..1' : '0..*';
    const flecha = COMPOSICIONES.has(`${r.hijo}.${r.campo}`) ? '*--' : '--';
    lineas.push(`  ${r.padre} "${multPadre}" ${flecha} "${multHijo}" ${r.hijo} : ${r.etiqueta}`);
  }

  return `${lineas.join('\n')}\n`;
};

/** Tabla de enumeraciones: más legible en el documento que un diagrama sin relaciones. */
const generarEnumeraciones = () => {
  const usos = new Map<string, string[]>();
  for (const modelo of modelos) {
    for (const campo of modelo.fields.filter((c) => nombresEnums.has(c.type))) {
      usos.set(campo.type, [...(usos.get(campo.type) ?? []), `${modelo.name}.${campo.name}`]);
    }
  }

  const filas = enums.map(
    (e) =>
      `| \`${e.name}\` | ${e.values.map((v) => `\`${v.name}\``).join(', ')} | ${(usos.get(e.name) ?? []).join(', ')} |`,
  );
  return [
    '# Enumeraciones del modelo de datos',
    '',
    'Generado por `npm run docs:diagramas` a partir de `backend/prisma/schema.prisma`.',
    '',
    '| Enumeración | Valores | Usada en |',
    '|---|---|---|',
    ...filas,
    '',
  ].join('\n');
};

// ─── Escritura ─────────────────────────────────────────────────

mkdirSync(DESTINO, { recursive: true });
writeFileSync(resolve(DESTINO, 'diagrama-entidad-relacion.mmd'), generarER());
writeFileSync(resolve(DESTINO, 'diagrama-clases.mmd'), generarClases());
writeFileSync(resolve(DESTINO, 'enumeraciones.md'), generarEnumeraciones());

console.info(
  `Diagramas generados en ${DESTINO}: ${modelos.length} entidades, ${relaciones().length} relaciones, ${enums.length} enumeraciones`,
);
