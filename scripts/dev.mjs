import { spawn } from 'node:child_process';

const commands = [
  ['api', 'node', ['server/index.mjs']],
  ['web', process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1']],
];

const children = commands.map(([name, command, args]) => {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  child.on('exit', (code) => {
    if (code !== 0) process.exitCode = code;
  });
  return child;
});

function shutdown() {
  children.forEach((child) => child.kill('SIGTERM'));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
