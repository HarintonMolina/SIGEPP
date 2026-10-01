/**
 * Exporta la especificación OpenAPI 3.1 a docs/fase-2/api/openapi.json para
 * importarla en Postman, Insomnia u otras herramientas sin levantar el servidor.
 * Uso: npm run docs:openapi
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarDocumentoOpenApi } from '../src/docs/openapi.js';

const destino = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/fase-2/api/openapi.json',
);

const documento = generarDocumentoOpenApi();
// Fuera del servidor no hay una URL relativa a la cual resolver; se apunta al entorno local.
documento.servers = [{ url: 'http://localhost:4000/api/v1', description: 'Desarrollo local' }];

mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, `${JSON.stringify(documento, null, 2)}\n`);

console.info(
  `Especificación exportada en ${destino} (${Object.keys(documento.paths ?? {}).length} rutas)`,
);
process.exit(0);
