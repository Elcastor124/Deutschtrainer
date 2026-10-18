// Desarrollo: servidor de juego (con recarga) + Vite (cliente con HMR). Abre http://localhost:5173
import { spawn } from 'node:child_process';
const run = (args, name) => {
  const p = spawn(process.execPath, args, { stdio: 'inherit', env: { ...process.env, FORCE_COLOR: '1' } });
  p.on('exit', (c) => { console.log(`[${name}] terminó (${c})`); process.exit(c ?? 0); });
  return p;
};
const server = run(['--watch-path=server', '--watch-path=shared', 'server/index.ts'], 'servidor');
const vite = run(['node_modules/vite/bin/vite.js'], 'vite');
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { server.kill(); vite.kill(); process.exit(0); });
