#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const root = path.join(__dirname, '..');
const apiDir = path.join(root, 'api');
const API_PORT = 3005;

function run(cmd, args, cwd, opts = {}) {
  const p = spawn(cmd, args, {
    cwd: cwd || root,
    stdio: opts.silent ? 'pipe' : 'inherit',
    shell: true,
    ...opts
  });
  return p;
}

function runSync(cmd, args, cwd) {
  const { spawnSync } = require('child_process');
  const r = spawnSync(cmd, args, { cwd, shell: true, stdio: 'inherit' });
  return r.status === 0;
}

function checkPortInUse(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
      req.destroy();
      resolve(true);
    });
    req.on('error', () => {
      req.destroy();
      resolve(false);
    });
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function waitForApi(port, maxAttempts = 30, intervalMs = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    function tryConnect() {
      attempts++;
      const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
        req.destroy();
        resolve();
      });
      req.on('error', () => {
        req.destroy();
        if (attempts >= maxAttempts) return reject(new Error('API não respondeu a tempo'));
        setTimeout(tryConnect, intervalMs);
      });
      req.setTimeout(2000, () => {
        req.destroy();
        if (attempts >= maxAttempts) return reject(new Error('API não respondeu a tempo'));
        setTimeout(tryConnect, intervalMs);
      });
    }
    tryConnect();
  });
}

if (!runSync('npx', ['prisma', 'migrate', 'deploy'], apiDir)) {
  console.warn('Aviso: migrações Prisma falharam ou não foram executadas. Se for a primeira vez, rode: cd api && npx prisma migrate dev');
}

let apiProcess = null;

function onExit() {
  if (apiProcess) apiProcess.kill();
  if (frontendProcess) frontendProcess.kill();
  process.exit(0);
}
process.on('SIGINT', onExit);

let frontendProcess = null;

checkPortInUse(API_PORT).then((apiAlreadyUp) => {
  if (apiAlreadyUp) {
    frontendProcess = run('npm', ['run', 'dev'], path.join(root, 'frontend'));
    frontendProcess.on('error', (err) => console.error('Frontend failed to start:', err.message));
    console.log('Frontend starting (port 3030). Ctrl+C to stop.');
    return;
  }
  apiProcess = run('npm', ['run', 'dev'], apiDir);
  apiProcess.on('error', (err) => console.error('API failed to start:', err.message));
  waitForApi(API_PORT)
    .then(() => {
      frontendProcess = run('npm', ['run', 'dev'], path.join(root, 'frontend'));
      frontendProcess.on('error', (err) => console.error('Frontend failed to start:', err.message));
      console.log('API (3005) and Frontend (3030) running. Ctrl+C to stop.');
    })
    .catch((err) => {
      console.error(err.message);
      if (apiProcess) apiProcess.kill();
      process.exit(1);
    });
});
