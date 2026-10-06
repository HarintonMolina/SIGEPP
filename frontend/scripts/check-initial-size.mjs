import { readFile, realpath, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

try {
  const frontend = fileURLToPath(new URL('..', import.meta.url));
  const dist = await realpath(path.join(frontend, 'dist'));
  const manifest = JSON.parse(await readFile(path.join(frontend, '.e2e/initial-assets.json'), 'utf8'));
  if (!Array.isArray(manifest.paths) || manifest.paths.length === 0 || new Set(manifest.paths).size !== manifest.paths.length) throw new Error('Manifest debe contener paths JS únicos no vacíos');
  let total = 0;
  for (const asset of manifest.paths) {
    if (typeof asset !== 'string' || !/^\/assets\/[A-Za-z0-9_.-]+\.js$/.test(asset)) throw new Error('Path JS inválido');
    const target = await realpath(path.join(dist, asset.slice(1)));
    if (!target.startsWith(dist + path.sep) || !(await stat(target)).isFile()) throw new Error('Asset fuera de dist o no es archivo');
    const bytes = gzipSync(await readFile(target)).length;
    total += bytes;
    console.log(`${asset}: ${bytes} bytes gzip`);
  }
  console.log(`JS inicial /login: ${total} / 250000 bytes gzip. CSS, fuentes y módulos no solicitados excluidos.`);
  if (total > 250000) throw new Error('Presupuesto JS inicial excedido');
} catch (error) { console.error(error.message); process.exitCode = 1; }
