#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

const ip = getLocalIP();
const appEnvPath = path.join(__dirname, '..', 'app', '.env');

if (!ip) {
  console.warn('Nenhum IP local encontrado. Use emulador (10.0.2.2) ou crie app/.env manualmente com EXPO_PUBLIC_BACKEND_HOST=SEU_IP');
  process.exit(0);
}

const content = `# Gerado por scripts/setup-backend-host.js
EXPO_PUBLIC_BACKEND_HOST=${ip}
EXPO_PUBLIC_BACKEND_PORT=3005
`;

fs.writeFileSync(appEnvPath, content, 'utf8');
console.log('app/.env updated with EXPO_PUBLIC_BACKEND_HOST=' + ip);
