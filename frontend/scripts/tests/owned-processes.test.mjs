import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createOwnedProcesses, terminateProcessTree } from '../owned-processes.mjs';

const fixture = fileURLToPath(new URL('./fixtures/process-tree.mjs', import.meta.url));
const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; } };
async function waitDead(pid) {
  const deadline = Date.now() + 1500;
  while (alive(pid) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
  return !alive(pid);
}
async function cleanup(pid) { if (pid && alive(pid)) { process.kill(pid, 'SIGKILL'); await waitDead(pid); } }

test('a failed tree termination rejects shutdown while its owned child is alive', async () => {
  const supervisor = createOwnedProcesses({ log: () => {}, isStopping: () => true,
    terminateTree: async () => { throw new Error('termination denied'); } });
  const job = supervisor.launch(process.execPath, ['-e', 'setTimeout(() => process.exit(0), 5000)'], { service: true });
  await once(job.child, 'spawn');
  try {
    await assert.rejects(supervisor.shutdown(), /termination denied/);
    assert.equal(alive(job.child.pid), true);
  } finally { await cleanup(job.child.pid); await job.done; }
});

test('command timeout terminates its owned descendant before rejecting', async () => {
  const terminated = [];
  const supervisor = createOwnedProcesses({ log: () => {}, terminateTree: async child => { terminated.push(child.pid); await terminateProcessTree(child); } });
  const job = supervisor.launch(process.execPath, [fixture], { timeout: 1200 });
  const rejected = assert.rejects(job.done, /timeout/);
  const [chunk] = await once(job.child.stdout, 'data');
  const ids = JSON.parse(chunk.toString());
  try {
    assert.equal(alive(ids.descendant), true);
    await rejected;
    assert.deepEqual(terminated, [ids.parent], 'timeout must request termination of the owned tree, not only its parent');
    assert.equal(await waitDead(ids.descendant), true, 'the descendant must be gone before timeout rejection');
    assert.equal(alive(ids.parent), false);
  } finally {
    await cleanup(ids.descendant); await cleanup(ids.parent); await supervisor.shutdown();
  }
});

test('shutdown succeeds when the owned command has already exited', async () => {
  const supervisor = createOwnedProcesses({ log: () => {}, terminateTree: async () => { throw new Error('should not kill an exited PID'); } });
  const job = supervisor.launch(process.execPath, ['-e', 'process.exit(0)']);
  await job.done;
  await supervisor.shutdown();
});

test('shutdown confirms exit of a live owned service', async () => {
  const supervisor = createOwnedProcesses({ log: () => {}, isStopping: () => true, terminateTree: terminateProcessTree });
  const job = supervisor.launch(process.execPath, ['-e', 'setTimeout(() => process.exit(0), 5000)'], { service: true });
  await once(job.child, 'spawn');
  try { await supervisor.shutdown(); assert.equal(alive(job.child.pid), false); }
  finally { await cleanup(job.child.pid); await job.done; }
});
