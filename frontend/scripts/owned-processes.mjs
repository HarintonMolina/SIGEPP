import { spawn } from 'node:child_process';

const stopBudget = 5000;
const exited = child => child.exitCode !== null || child.signalCode !== null;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function bounded(promise, label) {
  let timer;
  try { await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label)), stopBudget); })]); }
  finally { clearTimeout(timer); }
}
function groupAlive(pid) {
  try { process.kill(-pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}
export async function terminateProcessTree(child) {
  if (process.platform !== 'win32') {
    // Only the process group created by our detached spawn is addressed.
    if (!groupAlive(child.pid)) return;
    process.kill(-child.pid, 'SIGTERM');
    const deadline = Date.now() + stopBudget;
    const forceAt = Date.now() + 1000;
    let forced = false;
    while (groupAlive(child.pid) && Date.now() < deadline) {
      if (!forced && Date.now() >= forceAt) { process.kill(-child.pid, 'SIGKILL'); forced = true; }
      await delay(20);
    }
    if (groupAlive(child.pid)) throw new Error('Salida del grupo propio no confirmada');
    return;
  }
  // An observed exit is safe; never target a potentially reused, exited PID.
  if (exited(child)) return;
  await new Promise((resolve, reject) => {
    const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, shell: false, stdio: 'ignore' });
    const timer = setTimeout(() => { killer.kill(); reject(new Error('Cierre del árbol propio agotado')); }, stopBudget);
    killer.once('error', () => { clearTimeout(timer); reject(new Error('No se pudo iniciar cierre del árbol propio')); });
    killer.once('exit', code => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`Cierre del árbol propio falló (exit ${code})`));
    });
  });
}

// Extracted from the runner to exercise its process lifecycle without API/DB.
export function createOwnedProcesses({ cwd, env, safe = text => text, log = text => process.stdout.write(text), onUnexpectedExit = () => {}, isStopping = () => false, terminateTree = terminateProcessTree } = {}) {
  const records = new Set();
  async function stop(record) {
    if (record.termination) return record.termination;
    // A failed tree operation cannot later be called successful solely because
    // its parent exited: descendants could have survived that parent.
    if (record.ended && record.failedTermination) throw record.failedTermination;
    if (record.ended && !record.timedOut) { records.delete(record); return; }
    record.stopping = true;
    record.termination = (async () => {
      await terminateTree(record.child);
      await bounded(record.exit, `${record.label}: salida propia no confirmada`);
      records.delete(record);
    })();
    try { await record.termination; }
    catch (error) { record.termination = undefined; record.failedTermination = error; throw error; }
  }
  function launch(command, args, { cwd: childCwd = cwd, env: childEnv = env, label = 'proceso', service = false, silent = false, timeout = 120000 } = {}) {
    const child = spawn(command, args, { cwd: childCwd, env: childEnv, windowsHide: true, shell: false, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    const exit = Promise.withResolvers();
    const record = { child, label, exit: exit.promise, ended: false, timedOut: false, stopping: false, termination: undefined };
    records.add(record);
    let output = '';
    for (const stream of [child.stdout, child.stderr]) {
      let pending = '';
      stream.on('data', chunk => {
        pending += chunk.toString();
        const lines = pending.split(/\r?\n/); pending = lines.pop() ?? '';
        for (const line of lines) { output += safe(line) + '\n'; if (!silent) log(`[${label}] ${safe(line)}\n`); }
      });
      stream.on('end', () => { if (pending) { output += safe(pending); if (!silent) log(`[${label}] ${safe(pending)}\n`); } });
    }
    const done = new Promise((resolve, reject) => {
      const timer = service ? null : setTimeout(() => {
        record.timedOut = true;
        // Retain ownership while tree termination and observed exit complete.
        void stop(record).then(() => reject(new Error(`${label}: timeout`)), error => reject(new Error(`${label}: timeout; ${safe(error.message)}`)));
      }, timeout);
      child.on('error', error => {
        if (timer) clearTimeout(timer);
        if (!child.pid) { record.ended = true; records.delete(record); exit.resolve(); }
        reject(new Error(`${label}: ${safe(error.message)}`));
      });
      child.on('exit', (code, signal) => {
        if (timer) clearTimeout(timer);
        record.ended = true; exit.resolve();
        if (record.timedOut) return;
        if (!record.stopping) records.delete(record);
        if (service && !record.stopping && !isStopping()) onUnexpectedExit(new Error(`${label} terminó antes de tiempo (${code ?? signal})`));
        if (code === 0 || (isStopping() || record.stopping) && service) resolve(output);
        else reject(new Error(`${label}: exit ${code ?? signal}${silent ? `\n${output}` : ''}`));
      });
    });
    if (service) done.catch(error => { if (!isStopping()) onUnexpectedExit(error); });
    return { child, done };
  }
  async function shutdown() {
    const errors = [];
    for (const record of [...records]) {
      try { await stop(record); } catch (error) { errors.push(safe(error.message)); }
    }
    if (errors.length) throw new Error(`Cierre de procesos propios no confirmado: ${errors.join('; ')}`);
  }
  return { launch, shutdown };
}
