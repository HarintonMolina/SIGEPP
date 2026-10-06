# Verificación S1 del frontend

Fecha: 05/10/2026. Estado: T10 implementado y verificado proporcionalmente; receta final de estilos/producción/zoom exit0. Se conservan fallos y resultados históricos; no se atribuyen suites completas a fuente posterior. Gate independiente T10/global y aceptación humana pendientes. No se afirma cumplimiento WCAG completo.

## Matriz de evidencia

| Historia | Alcance verificado | Comando | Resultado |
|---|---|---|---|
| S1-H1 | Base, tipos, lint, build y fuente local | `npm run typecheck`, `npm run lint`, `npm run build` | Checks exit0; full lint95.859s/build38.321s antes T6fix2; T6fix2 build/CSS8 verificados; última producción build2132 módulos/3.25s; Inter local |
| S1-H2 | Contrato HTTP, errores y validación | `npm test`, `npm run test:e2e` | Full unit24 archivos/389 pruebas exit0/198.92s post-T9/T7/T6fix1; T6fix2 focal33/33 incluye8 CSS; contratos/API en histórico35/35 |
| S1-H3 | Registro RF-01 y login RF-02 | `npm run test:e2e`, `npm run test:e2e:production` | Ambos registros201 pasaron post-Select en dev proporcional9 (8+retry1) y production4; primario login production1 y formularios200 frescos post-T6fix2 |
| S1-H4 | Sesión, concurrencia y cierre | `npm run test:e2e` | Histórico 35/35 incluye StrictMode, expiración real, 4 requests/1 refresh y logout normal/offline; no se repite sin cambio |
| S1-H5 | Componentes y accesibilidad | `npm run test:e2e`, `npm run test:e2e:zoom` | Modal/Select primer Escape/foco afirmativos green; variantes8 dev1/1; control100/forms200 fresh2/2; shell200 anterior1pass; manual lector NO realizado |
| S1-H6 | Navegación, RBAC RF-04 y páginas | `npm run test:e2e`, `npm run test:e2e:production` | Históricos35/35 y25/25; Más móvil/Escape/Perfil y foco post-Select green en production4/dev9; no operaciones S2 añadidas |

## Entorno y aislamiento

Node22.21.0, Vite8.3.2 y Playwright1.63.0. Suite principal Chromium headless153.0.8010.12; ronda nativa Chrome154.0.8037.98. Viewports360×800,768×1024 y1280×800. Cada caso crea contexto nuevo sin storageState compartido.

Docker no está instalado en este entorno. Se usa el fallback autorizado PostgreSQL 18.0, clúster privado SCRAM/127.0.0.1:55432, en vez del PostgreSQL 16 de compose. No se modifica el servicio ajeno 5432. Cada ronda crea una DB aleatoria nueva y termina sus propios procesos; la evidencia queda en `frontend/.e2e/<id>/`. Sin resets ni suites backend. Las URLs de BD y secretos JWT solo se entregan a procesos backend; los procesos frontend reciben una lista de variables públicas/operativas.

Traces, HAR, video y capturas automáticas están deshabilitados. Se retienen capturas explícitas sin tokens ni contraseñas en pantalla. Seed se ejecuta con su línea de contraseña suprimida. Evidencia de navegación registra únicamente método/path sin query/status/pending/timings numéricos y readyState, sin headers/body/texto DOM. Stdout puede referir error-context transitorio; preserveOutput:never lo elimina, no se afirma que nunca se generó. Inventario final solo .last-run.json; perfiles zoom propios retirados después de cierre/ownership verificado.

Ruling16 añade readiness exclusivamente development: HTTP200 y body completo descartado de HTML/client/entradas, con presupuesto agregado45s, intentos1500ms. Development normal prepara main+fixture; zoom solo main. Logs solo path/status/elapsed/bodyComplete. No acredita todo el grafo ni cambia timeout/load/assertions de tests; production conserva cold initial-size. Última fixture preparada37.120s, zoom client39.690s/main39.706s. Tras esa preparación pasó la ronda real, sin demostrar causa interna precisa de los timeouts previos.

## Accesibilidad y límites

Axe comprueba reglas WCAG 2 A/AA y 2.1 AA detectables, incluido contraste en los estados recorridos. Se comprueba ancho del documento, Select, teclado, diálogo Más, foco tras navegación, skip link, paginación, orden, toast/live regions, IDs únicos al redimensionar y movimiento reducido.

Windows Narrator está disponible como ejecutable; la escucha manual de anuncios **NO SE REALIZÓ** porque el control de UI nativa no está disponible en esta sesión. Las comprobaciones semánticas no sustituyen esa revisión. Zoom200 forms aprobado en91bed5952752: inner640×400/DPR2, raíz/cuerpo clientWidth=scrollWidth640, CSSzoom=visualViewport.scale1; control1001280×800/DPR1. Preferencia nativa usa perfil nuevo, sin CSSzoom/DSF/CDP Emulation para simular zoom.

La ronda inicial de zoom falló tras tres capturas parciales. Calibración aislada Chrome154.0.8037.93 reprodujo clipping Playwright fullPage sin overflow; CDP contentSize DIP/scale1 conservó documento, sin acreditar app. App fresh91bed5952752 usa Chrome154.0.8037.98 y captura login1280×1090/registro1280×2420, métricas/rects guardadas temprano. Shell1280×954 conserva evidencia70aeacd285bf. PNG antiguos parciales no aprueban UI. `contentSize` es legacy/deprecated: recalibrar si cambia Chrome. Dos perfiles nuevos de última ronda terminaron profile-removed; cero perfiles propios al cierre.

Los fallos de primer Escape Modal+Toast y Select+Toast motivaron fixes revisados T7/T6. Browser9b944b3a42ed confirma Modal cerrado/focoactivador/callback1 y Select abierto antes de Toast tardío cerrado al primer Escape/fococombobox/Modal aún abierto. RED separados conservados, expectativas intactas. QA posterior detectó purga Tailwind Button/Badge; T6fix2 literaliza ocho clases y añade regresión CSS. Devd4b9c9aa0146 verifica ocho colores computados y producción35ba68b89286 verifica primario real; no mocks ni fixture en dist/router.

Una renovación se comparte por instancia/pestaña; no existe coordinación entre pestañas. Logout revoca refresh, pero un JWT emitido puede seguir válido hasta expirar. No se promete recuperación transparente de una cookie rotada cuya respuesta se perdió. TTL 5s solo en E2E; la demo conserva el TTL del backend. La suite principal desactiva el límite IP mediante NODE_ENV=test; la ronda rate-limit usa development y TTL ordinario.

## Discrepancias y deuda

- El catálogo frontend protege destinos por rol. El backend admite GET `/plazas` para cualquier autenticado aunque algunos menús no lo ofrecen; ocultar un enlace no sustituye autorización backend. Las páginas futuras no consultan esos endpoints.
- La descripción OpenAPI anuncia acceso de 15 minutos; el TTL es configurable, y aquí es 5s exclusivamente para expiración real. No se alteró OpenAPI/backend.
- Los conflictos de registro 409 por correo/carnet no incluyen detalles de campo: el formulario muestra el mensaje general y enfoca el resumen.
- Se conserva Tailwind 3.4 y Router 6.30 según aprobación. Auditoría previa: 7 vulnerabilidades (5 high de tooling, 2 moderate Router), sin `audit fix --force`. No se declara audit limpio ni despliegue sin deuda. Advisories: [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [Router](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6), [Router adicional](https://github.com/advisories/GHSA-337j-9hxr-rhxg). No hay SSR y el retorno externo pasa por rutas conocidas/roles, comprobadas con barras/codificaciones.
- ESLint 9 se conserva según versión aprobada pese a deprecación de soporte. Chrome for Testing completo 153 tiene fallo side-by-side 14001 en este equipo; funciona su headless shell. La ronda adicional usa Chrome instalado sin alterar instalaciones/políticas ni perfiles personales.
- Escrituras Git fueron denegadas previamente; no hay commits T10 ni merge/publicación. La revisión humana se prepara con archivos locales y evidencia.

## Ejecuciones registradas

| Ronda | Run / fecha | Resultado real | Estado respecto a fixes |
|---|---|---|---|
| Development completo | c2786e4d756f, 04/10 | 35/35; Playwright 1.5 min, total 118.8 s; exit 0 | Histórico anterior a T7/T6 fix; selección actual40, sin full40 atribuido |
| Production completo | 9d7135668820, 04/10 | 25/25; 25.2 s, total 48.9 s; exit 0 | Histórico; selección actual26, sin full26 atribuido |
| JS inicial /login histórico | 04/10 | 6 JS únicos, 133439/250000 bytes gzip; exit0 | Antes de fixes; medición posterior133460 y final133506 |
| Rate-limit independiente | 9f2958de67df, 04/10 | 1/1; 9.1 s, total 30.0 s; exit 0; intento21: 429 DEMASIADAS_PETICIONES | API development nueva; no afectado por fixes visuales |
| Focal post-Modal / RED Select | 00526ff5a8ed, 04/10 | 5 pass/1 fail; 13.3 s, total 30.5 s; exit 1 | Modal green; Select fallido motivó fix revisado |
| Zoom nativo inicial | 57dfc034738a, 04/10 | 1 fallo timeout45s, total66.5s, exit1 | Evidencia parcial; perfiles propios retirados, no aprobación |
| Unit completo | 05/10 | 24 archivos/389 pruebas,198.92s,exit0 | Post-T9/T7/T6fix1; anterior a T6fix2; focal T6fix2 dueño33/33 incluye8 CSS, sin full nuevo inventado |
| Tipos/lint/build | 05/10 | Fullchecks exit0; lint95.859s/build38.321s; types inicial duración no instrumentada | Coveringchecks harness posteriores exit0; node--check225ms/lint runner6954ms tras Ruling16 |
| Development proporcional | 9b944b3a42ed | 8pass/1fail; PW2.0min,total192.949s,exit1 | Modal/Select/registros green; fallo goto frío inicial antes assertions |
| Retry único teclado | e66c8cfe5f45 | 1/1; PW29.2s,total58.353s,exit0 | Junto a8pases previos cubre selección9, sin full40 |
| Production proporcional | 27fd656a0bc6 | 4/4; PW16.3s,total76.719s,exit0 | Ambos registros/Más/coldsize post-Select, anterior a T6fix2 |
| Zoom antes T6fix2 | 70aeacd285bf | 2pass/1fail; PW1.6min,total130.342s,exit1 | Forms/shell200green; control100 goto45falló; cleanup propio manual confirmado |
| Estilos RED sin instrumento | 651167dbbf0e | 0pass/1fail,total86.104s,exit1 | Goto fixture45falló antes colores; downstream detenido |
| Estilos RED instrumentado | 786b3af7b978 | 0pass/1fail,goto45,total78.014s,exit1 | HTML200/interactive, client+entry pending; no prueba causa interna exacta |
| Estilos GREEN post-Ruling16 | d4b9c9aa0146 | 1/1 ocho variantes; PW3.5s,total65.620s,exit0 | Fixture bodycomplete37.120s dentro mismo budgetweb45 |
| Production colores/manifiesto | 35ba68b89286 | 1/1; PW2.8s,total41.273s,exit0; build2132 módulos/3.25s | Primario navy/blanco y cold-manifest nuevos post-T6fix2 |
| JS inicial final | 35ba68b89286 | 6JS únicos,**133506/250000 bytes gzip**,checkexit0/183ms | Cold /login final, sin inferir del tamaño main |
| Zoom final seleccionado | 91bed5952752 | 2/2 control100/forms200; PW11.2s,total76.847s,exit0 | Main bodycomplete39.706s; perfilesremoved; shell200 no repetido |

El informe incremental detallado está en `.superpowers/sdd/2026-10-03-s1-cimientos-frontend/task-10-report.md` (local, ignorado por Git). Los intentos de despacho Oct5 quedaron esperando permiso del sistema y se abortaron sin iniciar runner; no cuentan como pruebas ejecutadas.

Receta final del controlador sesión50818 completa exit0, con autorización OS: development1→production1→size→zoom2, fuente T6fix2 revisada sobre BASE185. QA visual real del controlador de PNGfresh confirma login1280×1090/registro1280×2420 completos, primario navy/blanco y extremos sin recorte/overflow; reducción de vista del viewer no altera RAW. Shell200 es evidencia separada anterior, no captura fresca de esta receta. LIST ONLY confirma40dev/26prod, no fulls40/26 ejecutados. Backend71/frontendsrc86 hashes iguales a BASE; dist sin fixture, inventory0 perfiles propios. No nuevas suites/test/build duplicados, Gitwrites ni procesos propios pendientes. Gate independiente y aceptación humana permanecen siguientes.
