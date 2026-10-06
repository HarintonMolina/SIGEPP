import { spawn } from 'node:child_process';

// Self-expiry bounds cleanup even when the sandbox denies a termination probe.
if (process.argv[2] === 'descendant') {
  setTimeout(() => process.exit(0), 5000);
} else {
  const descendant = spawn(process.execPath, [import.meta.filename, 'descendant'], { windowsHide: true, shell: false, detached: process.platform === 'win32', stdio: 'ignore' });
  descendant.once('spawn', () => process.stdout.write(JSON.stringify({ parent: process.pid, descendant: descendant.pid }) + '\n'));
  setTimeout(() => process.exit(0), 5000);
}
