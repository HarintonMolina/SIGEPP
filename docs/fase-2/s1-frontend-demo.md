# Demo S1 del frontend

Alcance: S1-H1…S1-H6, RF-01, RF-02 y RF-04. Ejecutar los pasos de arranque del README con API y PostgreSQL reales. La demo usa su propia base; no ejecutar los tests backend destructivos ni el runner E2E mientras ocupa los puertos 4000/5173.

1. Abrir `/registro`. Crear un estudiante con correo institucional y carnet nuevos, o seleccionar Tutor académico y completar departamento. Un registro correcto vuelve a `/login`, muestra el aviso y conserva el correo; todavía no hay sesión.
2. Iniciar sesión con la cuenta recién creada. Visitar Perfil y comprobar que los datos corresponden a la cuenta registrada.
3. Recargar la página. La cookie HttpOnly permite recuperar la sesión; el token de acceso y el usuario viven en memoria, no en almacenamiento web.
4. Cerrar sesión y recargar. Se conserva el formulario de login sin sesión. Para demostrar cierre pendiente, desconectar la red después de login, cerrar, reconectar, recargar y pulsar Reintentar cierre de sesión.
5. Recorrer los seis roles del seed en contextos separados, cerrando sesión entre cuentas. Las credenciales públicas del seed están en README.

| Rol | Correo seed | Destino inicial |
|---|---|---|
| Estudiante | maria.gonzalez@std.uni.edu.ni | /inicio |
| Tutor académico | jose.martinez@uni.edu.ni | /inicio |
| Tutor empresarial | pedro.lopez@solucionesdigitales.example | /inicio |
| Organización | rrhh@solucionesdigitales.example | /org/inicio |
| Coordinador | coordinacion.sistemas@uni.edu.ni | /panel |
| Administrador | admin@uni.edu.ni | /inicio |

Plazas, postulaciones, organizaciones, candidatos y áreas de organización previstas para S2 llevan a páginas informativas. Expediente, tutorados, practicantes, revisiones, asignaciones y auditoría muestran «Esta sección aún no está disponible». No cargan datos ficticios ni implementan esas operaciones. El Panel del coordinador también es informativo. Inicio y Perfil muestran identidad real.

En móvil, los enlaces restantes están en Más. Probar teclado, Escape, retorno de foco, el enlace Saltar al contenido y navegación a un destino sin permiso (403). Una ruta desconocida muestra 404. El retorno tras login se limita a rutas conocidas permitidas por rol.

Para la revisión al 200%, ejecutar la ronda separada `npm run test:e2e:zoom` con Chrome instalado y los puertos de demo libres.
Las evidencias esperadas son `zoom200-login-fixed.png`, `zoom200-registro-fixed.png` y `zoom200-shell-fixed.png`, junto a
las métricas de zoom nativo y el resultado de la ronda. Una imagen parcial o una calibración con HTML aislado no aprueba esta demo.
La ronda proporcional final del 05/10 pasó colores de las ocho variantes, primario en producción y control100/formularios200.
Login y registro tienen capturas frescas de `91bed5952752`; shell conserva la captura aprobada de `70aeacd285bf`, anterior
al fix de variantes, y no se atribuye a la ronda nueva. Consultar la matriz para distinguir esos resultados de las suites históricas.
Narrator existe como ejecutable, pero la escucha manual no se realizó por falta de control de UI nativa; no se acredita auditoría WCAG completa.

Esta demo no demuestra coordinación entre pestañas, revocación inmediata de JWT ni recuperación de una respuesta de rotación perdida. La aceptación del compañero y cualquier publicación/merge siguen siendo acciones separadas.
