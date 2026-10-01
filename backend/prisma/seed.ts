/**
 * Datos de prueba para el entorno de desarrollo.
 * Todas las personas y organizaciones son ficticias.
 * Contraseña de todas las cuentas: Sigepp2026
 */
import { PrismaClient, type Rol } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();
const CONTRASENA = 'Sigepp2026';

async function main() {
  if ((await prisma.usuario.count()) > 0) {
    console.info('La base ya tiene datos. Ejecuta "npm run db:reset" para recrearla desde cero.');
    return;
  }

  const hashContrasena = await bcrypt.hash(CONTRASENA, 12);
  const usuario = (rol: Rol, correo: string, nombres: string, apellidos: string) => ({
    rol,
    correo,
    nombres,
    apellidos,
    hashContrasena,
  });

  // ─── Período ───
  const periodo = await prisma.periodo.create({
    data: {
      nombre: 'II Semestre 2026',
      anio: 2026,
      semestre: 2,
      fechaInicio: new Date('2026-08-15T00:00:00-06:00'),
      fechaFin: new Date('2026-12-15T23:59:59-06:00'),
      horasMinimas: 240,
      convocatoriaAbierta: true,
      activo: true,
    },
  });

  // ─── Administración ───
  await prisma.usuario.create({
    data: usuario('ADMIN', 'admin@uni.edu.ni', 'Administrador', 'SIGEPP'),
  });
  await prisma.usuario.create({
    data: usuario(
      'COORDINADOR',
      'coordinacion.sistemas@uni.edu.ni',
      'Marta Elena',
      'Ruiz Castillo',
    ),
  });

  // ─── Docentes (tutores académicos) ───
  const docentes = [
    ['jose.martinez@uni.edu.ni', 'José Antonio', 'Martínez López', 'Desarrollo de Software'],
    ['carla.mendoza@uni.edu.ni', 'Carla Patricia', 'Mendoza Ríos', 'Bases de Datos'],
    ['luis.rivera@uni.edu.ni', 'Luis Fernando', 'Rivera Solís', 'Redes y Seguridad'],
  ] as const;
  for (const [correo, nombres, apellidos, especialidad] of docentes) {
    await prisma.usuario.create({
      data: {
        ...usuario('TUTOR_ACADEMICO', correo, nombres, apellidos),
        docente: { create: { departamento: 'Ingeniería en Sistemas', especialidad } },
      },
    });
  }

  // ─── Organizaciones receptoras ───
  const convenioHasta = new Date('2027-12-31T23:59:59-06:00');

  const orgSoftware = await prisma.organizacion.create({
    data: {
      razonSocial: 'Soluciones Digitales del Pacífico, S.A.',
      ruc: 'J0310000000001',
      sector: 'Tecnología',
      direccion: 'Managua, Carretera a Masaya km 5',
      sitioWeb: 'https://example.com',
      estadoVerificacion: 'VERIFICADA',
      convenioVigenteHasta: convenioHasta,
      representante: {
        create: usuario(
          'ORGANIZACION',
          'rrhh@solucionesdigitales.example',
          'Gabriela',
          'Torres Aguilar',
        ),
      },
    },
  });

  const orgAgro = await prisma.organizacion.create({
    data: {
      razonSocial: 'Cooperativa Agroindustrial Los Robles, R.L.',
      ruc: 'J0310000000002',
      sector: 'Agroindustria',
      direccion: 'Matagalpa, salida a Jinotega',
      estadoVerificacion: 'VERIFICADA',
      convenioVigenteHasta: convenioHasta,
      representante: {
        create: usuario('ORGANIZACION', 'talento@losrobles.example', 'Ricardo', 'Hernández Mejía'),
      },
    },
  });

  // Organización pendiente de verificación, para demostrar RF-06 y RN-12
  await prisma.organizacion.create({
    data: {
      razonSocial: 'Servicios Financieros Horizonte, S.A.',
      ruc: 'J0310000000003',
      sector: 'Finanzas',
      direccion: 'León, del parque central 2 c. al norte',
      representante: {
        create: usuario('ORGANIZACION', 'contacto@horizonte.example', 'Sofía', 'Navarro Blandón'),
      },
    },
  });

  // ─── Tutores empresariales ───
  const tutores = [
    [
      'pedro.lopez@solucionesdigitales.example',
      'Pedro José',
      'López Cruz',
      'Líder de desarrollo',
      orgSoftware.id,
    ],
    ['karla.ortiz@losrobles.example', 'Karla Vanessa', 'Ortiz Pineda', 'Jefa de TI', orgAgro.id],
  ] as const;
  for (const [correo, nombres, apellidos, cargo, organizacionId] of tutores) {
    await prisma.usuario.create({
      data: {
        ...usuario('TUTOR_EMPRESARIAL', correo, nombres, apellidos),
        tutorEmpresarial: { create: { cargo, organizacionId } },
      },
    });
  }

  // ─── Estudiantes ───
  // El avance de 74 % de Diego permite demostrar el rechazo por RN-01 (mínimo 80 %).
  const estudiantes = [
    ['maria.gonzalez@std.uni.edu.ni', 'María José', 'González Rocha', '2022-0101U', 92],
    ['carlos.ramirez@std.uni.edu.ni', 'Carlos Andrés', 'Ramírez Duarte', '2022-0102U', 88],
    ['valeria.flores@std.uni.edu.ni', 'Valeria', 'Flores Membreño', '2022-0103U', 85],
    ['kevin.castro@std.uni.edu.ni', 'Kevin Josué', 'Castro Úbeda', '2021-0104U', 81],
    ['diego.morales@std.uni.edu.ni', 'Diego Alejandro', 'Morales Vega', '2022-0105U', 74],
  ] as const;
  for (const [correo, nombres, apellidos, carnet, avance] of estudiantes) {
    await prisma.usuario.create({
      data: {
        ...usuario('ESTUDIANTE', correo, nombres, apellidos),
        estudiante: {
          create: {
            carnet,
            carrera: 'Ingeniería en Sistemas',
            anio: 5,
            porcentajeAvance: avance,
            avanceVerificado: true,
          },
        },
      },
    });
  }

  // ─── Plazas ───
  const coordinador = await prisma.usuario.findUniqueOrThrow({
    where: { correo: 'coordinacion.sistemas@uni.edu.ni' },
  });
  const aprobada = {
    estado: 'APROBADA' as const,
    aprobadaPorId: coordinador.id,
    publicadaEn: new Date(),
  };

  await prisma.plaza.createMany({
    data: [
      {
        organizacionId: orgSoftware.id,
        periodoId: periodo.id,
        titulo: 'Desarrollador Web Jr.',
        descripcion:
          'Apoyo en el desarrollo de una aplicación web con React y Node.js para clientes del sector comercio.',
        area: 'Desarrollo de software',
        modalidad: 'HIBRIDA',
        ubicacion: 'Managua',
        cupos: 2,
        horario: 'Lunes a viernes, 8:00 a 12:00',
        competencias: ['JavaScript', 'React', 'Git', 'SQL'],
        ...aprobada,
      },
      {
        organizacionId: orgSoftware.id,
        periodoId: periodo.id,
        titulo: 'Analista de Control de Calidad (QA)',
        descripcion: 'Diseño y ejecución de casos de prueba manuales y automatizados.',
        area: 'Calidad de software',
        modalidad: 'REMOTA',
        ubicacion: 'Managua',
        cupos: 1,
        horario: 'Lunes a viernes, 13:00 a 17:00',
        competencias: ['Pruebas de software', 'Postman', 'Redacción técnica'],
        ...aprobada,
      },
      {
        organizacionId: orgAgro.id,
        periodoId: periodo.id,
        titulo: 'Asistente de Inteligencia de Negocios',
        descripcion:
          'Construcción de tableros de indicadores de producción y limpieza de datos operativos.',
        area: 'Datos e inteligencia de negocios',
        modalidad: 'PRESENCIAL',
        ubicacion: 'Matagalpa',
        cupos: 1,
        horario: 'Lunes a viernes, 7:00 a 11:00',
        competencias: ['SQL', 'Power BI', 'Excel avanzado'],
        ...aprobada,
      },
      {
        organizacionId: orgAgro.id,
        periodoId: periodo.id,
        titulo: 'Soporte de Infraestructura y Redes',
        descripcion: 'Mantenimiento de la red de planta y del inventario de equipos.',
        area: 'Redes e infraestructura',
        modalidad: 'PRESENCIAL',
        ubicacion: 'Matagalpa',
        cupos: 1,
        horario: 'Lunes a viernes, 8:00 a 12:00',
        competencias: ['Redes', 'Windows Server', 'Cableado estructurado'],
        estado: 'EN_REVISION',
      },
    ],
  });

  // ─── Rúbricas del período (RN-10: 60 % empresarial, 40 % académica) ───
  await prisma.rubrica.createMany({
    data: [
      {
        periodoId: periodo.id,
        nombre: 'Evaluación del tutor empresarial',
        tipoEvaluador: 'EMPRESARIAL',
        criterios: [
          { criterio: 'Calidad del trabajo', peso: 30 },
          { criterio: 'Responsabilidad y puntualidad', peso: 25 },
          { criterio: 'Trabajo en equipo', peso: 20 },
          { criterio: 'Iniciativa y aprendizaje', peso: 25 },
        ],
      },
      {
        periodoId: periodo.id,
        nombre: 'Evaluación del tutor académico',
        tipoEvaluador: 'ACADEMICO',
        criterios: [
          { criterio: 'Cumplimiento del plan de trabajo', peso: 40 },
          { criterio: 'Calidad de las bitácoras', peso: 30 },
          { criterio: 'Aplicación de conocimientos de la carrera', peso: 30 },
        ],
      },
    ],
  });

  console.info(`Datos de prueba creados. Contraseña de todas las cuentas: ${CONTRASENA}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
