import { createOwnedProcesses } from './owned-processes.mjs';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, unlink, access } from 'node:fs/promises';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const frontend = fileURLToPath(new URL('..', import.meta.url));
const root = path.resolve(frontend, '..');
const backend = path.join(root, 'backend');
const mode = process.argv.find(arg => arg.startsWith('--mode='))?.slice(7) ?? 'development';
const filter = process.argv.find(arg => arg.startsWith('--grep='))?.slice(7);
const zoom = process.argv.includes('--zoom');
const runId = randomBytes(6).toString('hex');
const database = `sigepp_e2e_${runId}`;
const evidenceDir = path.join(frontend, '.e2e', runId);
const secret = randomBytes(48).toString('hex');
const pgPassword = randomBytes(32).toString('hex');
let shutdownPromise;
let databaseURL = '';
let databaseCreated = false;
let nativeStarted = false;
let pgBin;
let cluster;
let stopping = false;
let failure;
let evidenceCreated = false;
let runError;
const started = Date.now();

// Deliberate allowlist: private inherited environment cannot leak into Vite/Playwright.
const operationalKeys = ['PATH', 'Path', 'SYSTEMROOT', 'SystemRoot', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'PATHEXT', 'CI', 'PLAYWRIGHT_BROWSERS_PATH'];
const operationalEnv = Object.fromEntries(operationalKeys.filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
const publicEnv = { ...operationalEnv, VITE_API_URL: 'http://localhost:4000/api/v1', VITE_DOMINIOS_INSTITUCIONALES: 'uni.edu.ni,std.uni.edu.ni',
  E2E_RUN_ID: runId, E2E_MODE: mode, E2E_ZOOM: zoom ? '1' : '0', PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1', PLAYWRIGHT_NO_COPY_PROMPT: '1' };
function safe(text) {
  return text.replace(/.*Contraseña de todas las cuentas:.*(?:\r?\n|$)/gi, '[seed: credencial omitida]\n')
    .replaceAll(secret, '[secret]').replaceAll(pgPassword, '[password]')
    .replace(/Sigepp2026|Incorrecta2026/g, '[credencial de prueba omitida]')
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, '[database-url]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[jwt]');
}
const supervisor = createOwnedProcesses({ cwd: root, env: operationalEnv, safe,
  isStopping: () => stopping, onUnexpectedExit: error => { if (!stopping) failure = error; } });
const { launch } = supervisor;
async function run(command, args, options) { return launch(command, args, options).done; }
async function portFree(port, host) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', error => reject(new Error(`Puerto ${host}:${port} no disponible (${error.code}); no se tocará el proceso ajeno`)));
    server.listen({ port, host, exclusive: true }, () => server.close(resolve));
  });
}
async function ready(url) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (failure) throw failure;
    try { const response = await fetch(url, { signal: AbortSignal.timeout(1500) }); if (response.ok) return; } catch { /* bounded readiness */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Healthcheck agotado: ${url}`);
}
async function readyDevelopmentWeb() {
  const started = Date.now();
  const deadline = started + 45000;
  // All targets share the existing web-readiness budget. Entry responses trigger
  // Vite's static pretransforms; this does not certify the entire import graph.
  const paths = ['/login', '/@vite/client', '/src/main.tsx', ...(zoom ? [] : ['/e2e/components.tsx'])];
  for (const pathname of paths) {
    let completed = false;
    while (Date.now() < deadline) {
      if (failure) throw failure;
      let status = null;
      let bodyComplete = false;
      try {
        const response = await fetch(`http://localhost:5173${pathname}`, { signal: AbortSignal.timeout(Math.min(1500, deadline - Date.now())) });
        status = response.status;
        if (status === 200) {
          await response.arrayBuffer(); // Discard body; never log or persist it.
          bodyComplete = true;
        } else await response.body?.cancel();
      } catch { /* bounded readiness; no exception/body/header persisted */ }
      console.log(`[readiness] ${JSON.stringify({ path: pathname, status, elapsedMs: Date.now() - started, bodyComplete })}`);
      if (bodyComplete && Date.now() <= deadline) { completed = true; break; }
      const remaining = deadline - Date.now();
      if (remaining > 0) await new Promise(resolve => setTimeout(resolve, Math.min(250, remaining)));
    }
    if (!completed) throw new Error('Readiness web development agotado');
  }
}
function shutdown() {
  // Signal/finally callers share one cleanup; all owned resources are attempted.
  if (!shutdownPromise) shutdownPromise = (async () => {
    stopping = true;
    const errors = [];
    try { await supervisor.shutdown(); } catch (error) { errors.push(safe(error.message)); }
    if (nativeStarted) {
      try {
        await run(path.join(pgBin, 'pg_ctl.exe'), ['-D', cluster, '-m', 'fast', '-w', 'stop'], { label: 'PostgreSQL stop', silent: true });
        nativeStarted = false;
      } catch (error) { errors.push(safe(error.message)); }
    }
    if (errors.length) throw new Error(errors.join('; '));
  })();
  return shutdownPromise;
}
function stopOnSignal(code) {
  void shutdown().then(() => process.exit(code), error => { console.error(safe(error.message)); process.exit(1); });
}
process.once('SIGINT', () => stopOnSignal(130));
process.once('SIGTERM', () => stopOnSignal(143));

try {
  if (!['development', 'production', 'rate-limit'].includes(mode)) throw new Error('Modo E2E inválido');
  if (zoom && mode !== 'development') throw new Error('Zoom es una ronda development separada');
  if (!/^sigepp_e2e_[a-f0-9]{12}$/.test(database)) throw new Error('Nombre DB E2E inválido');
  for (const port of [4000, 5173]) for (const host of ['127.0.0.1', '::1']) await portFree(port, host);
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(path.join(evidenceDir, 'run.json'), JSON.stringify({ runId, database, mode, zoom, started: new Date().toISOString() }, null, 2));
  evidenceCreated = true;
  pgBin = process.env.E2E_POSTGRES_BIN;
  if (pgBin) {
    pgBin = path.resolve(pgBin);
    for (const tool of ['initdb.exe', 'pg_ctl.exe', 'psql.exe']) await access(path.join(pgBin, tool));
    const pgPort = 55432;
    await portFree(pgPort, '127.0.0.1');
    cluster = path.join(evidenceDir, 'postgres');
    const passwordFile = path.join(evidenceDir, 'initdb-password.tmp');
    try {
      await writeFile(passwordFile, pgPassword, { mode: 0o600, flag: 'wx' });
      await run(path.join(pgBin, 'initdb.exe'), ['-D', cluster, '-U', 'sigepp', '--auth=scram-sha-256', '--encoding=UTF8', '--locale=C', `--pwfile=${passwordFile}`], { label: 'initdb', silent: true });
    } finally { await unlink(passwordFile).catch(() => {}); }
    await run(path.join(pgBin, 'pg_ctl.exe'), ['-D', cluster, '-l', path.join(evidenceDir, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${pgPort}`, '-w', 'start'], { label: 'PostgreSQL privado', silent: true });
    nativeStarted = true;
    await run(path.join(pgBin, 'psql.exe'), ['-h', '127.0.0.1', '-p', String(pgPort), '-U', 'sigepp', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE "${database}"`], { env: { ...operationalEnv, PGPASSWORD: pgPassword }, label: 'crear DB', silent: true });
    databaseCreated = true;
    databaseURL = `postgresql://sigepp:${pgPassword}@127.0.0.1:${pgPort}/${database}?schema=public`;
  } else {
    await run('docker', ['compose', 'up', '-d', '--wait', 'db'], { label: 'Docker' });
    await run('docker', ['compose', 'exec', '-T', 'db', 'psql', '-U', 'sigepp', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `CREATE DATABASE "${database}"`], { label: 'crear DB' });
    databaseCreated = true;
    databaseURL = `postgresql://sigepp:sigepp@localhost:5432/${database}?schema=public`;
  }
  console.log(`E2E ${mode}${zoom ? '/zoom' : ''}: ${runId}; DB ${database}; backend ${pgBin ? 'PostgreSQL nativo privado' : 'compose'}`);
  const apiEnv = { ...operationalEnv, DATABASE_URL: databaseURL, DATABASE_URL_TEST: databaseURL, JWT_ACCESS_SECRET: secret,
    NODE_ENV: mode === 'rate-limit' ? 'development' : 'test', JWT_ACCESS_TTL: mode === 'rate-limit' ? '15m' : '5s',
    PORT: '4000', CORS_ORIGIN: 'http://localhost:5173', DOMINIOS_INSTITUCIONALES: 'uni.edu.ni,std.uni.edu.ni', BCRYPT_COST: '12', REFRESH_TTL_DAYS: '7' };
  await run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { cwd: backend, env: apiEnv, label: 'migraciones' });
  await run(process.execPath, ['--import', 'tsx', 'prisma/seed.ts'], { cwd: backend, env: apiEnv, label: 'seed' });
  launch(process.execPath, ['--import', 'tsx', 'src/server.ts'], { cwd: backend, env: apiEnv, label: 'API', service: true });
  await ready('http://localhost:4000/api/health');
  if (mode === 'production') {
    await run(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '-p', 'tsconfig.json'], { cwd: frontend, env: publicEnv, label: 'build typecheck' });
    await run(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { cwd: frontend, env: publicEnv, label: 'build' });
  }
  const viteArgs = ['node_modules/vite/bin/vite.js', ...(mode === 'production' ? ['preview'] : []), '--host', 'localhost', '--port', '5173', '--strictPort'];
  launch(process.execPath, viteArgs, { cwd: frontend, env: publicEnv, label: 'Vite', service: true });
  if (mode === 'development') await readyDevelopmentWeb();
  else await ready('http://localhost:5173/login');
  const playwrightArgs = ['node_modules/@playwright/test/cli.js', 'test', '--config', mode === 'production' ? 'playwright.production.config.ts' : 'playwright.config.ts', ...(filter ? ['--grep', filter] : [])];
  await run(process.execPath, playwrightArgs, { cwd: frontend, env: publicEnv, label: 'Playwright', timeout: 900000 });
  if (failure) throw failure;
} catch (error) {
  process.exitCode = 1;
  runError = safe(error instanceof Error ? error.message : String(error));
  console.error(runError);
} finally {
  let teardownComplete = false;
  try { await shutdown(); teardownComplete = true; }
  catch (error) {
    process.exitCode = 1;
    runError = [runError, safe(error.message)].filter(Boolean).join('; ');
    console.error(safe(error.message));
  }
  if (evidenceCreated) {
    await writeFile(path.join(evidenceDir, 'result.json'), JSON.stringify({ runId, database, mode, zoom,
      databaseCreated,
      status: process.exitCode ? 'failed' : 'passed', exitCode: process.exitCode ?? 0,
      durationMs: Date.now() - started, ...(runError ? { error: runError } : {}) }, null, 2))
      .catch(error => { process.exitCode = 1; console.error(safe(error.message)); });
  }
  console.log(`Teardown propio ${teardownComplete ? 'completado' : 'NO confirmado'}; ${databaseCreated ? `DB conservada: ${database}` : 'DB no creada'}; duración ${((Date.now() - started) / 1000).toFixed(1)}s; exit ${process.exitCode ?? 0}`);
}
