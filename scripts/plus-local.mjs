// Deutschtrainer Plus en local para iterar: servidor de juego (se reinicia al cambiar server/ o shared/)
// + Vite con recarga en caliente (el navegador se actualiza al guardar src/).
// Datos aislados en data/plus-local (ignorado por git). No toca producción ni usa claves de pago.
//
//   npm run plus            → http://localhost:5173
//   npm run plus -- --reset → empieza con datos vacíos
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, watch } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const PORT = process.env.PORT || '4747';
const DATA_DIR = process.env.DATA_DIR || join(ROOT, 'data', 'plus-local');
if (process.argv.includes('--reset')) rmSync(DATA_DIR, { recursive: true, force: true });
mkdirSync(DATA_DIR, { recursive: true });

// Sin claves de proveedores aunque existan en el entorno: Klaus AI funciona en modo básico (determinista, gratis).
const env = { ...process.env, PORT, DATA_DIR, FORCE_COLOR: '1', KLAUS_ALLOW_PAID: '0' };
for (const k of Object.keys(env)) if (/API_KEY$|SUPABASE_SERVICE_ROLE_KEY/.test(k)) delete env[k];

const kids = [];
const run = (args, name) => {
  const p = spawn(process.execPath, args, { cwd: ROOT, stdio: 'inherit', env });
  p.on('exit', (c) => { console.log(`[${name}] terminó (${c})`); stop(c ?? 0); });
  kids.push(p);
};
let stopping = false;
function stop(code = 0) {
  if (stopping) return; stopping = true;
  server?.kill();
  for (const k of kids) { try { k.kill(); } catch { /* ya terminado */ } }
  process.exit(code);
}
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => stop(0));

// Servidor supervisado: se reinicia al cambiar server/ o shared/ y, si un arranque falla (p. ej. el puerto aún no se ha
// liberado en Windows), reintenta solo en vez de quedarse esperando otro cambio como hacía `node --watch`.
let server = null, restartTimer = null, fails = 0;
function startServer() {
  const p = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.ts'], { cwd: ROOT, stdio: 'inherit', env });
  const born = Date.now();
  server = p;
  p.on('exit', (code) => {
    if (stopping || server !== p) return;
    server = null;
    fails = Date.now() - born < 5000 ? fails + 1 : 0;
    const wait = Math.min(8000, 600 * 2 ** Math.min(fails, 4));
    console.log(`[servidor] terminó (${code}); reintento en ${(wait / 1000).toFixed(1)} s`);
    restartTimer = setTimeout(startServer, wait);
  });
}
function restartServer() {
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    fails = 0;
    const old = server;
    if (!old) return startServer();
    server = null;
    old.once('exit', () => setTimeout(startServer, 250));
    old.kill();
  }, 250);
}
for (const dir of ['server', 'shared']) {
  watch(join(ROOT, dir), { recursive: true }, (_, file) => {
    if (!file || !/\.(ts|json)$/.test(file)) return;
    console.log(`[servidor] cambio en ${dir}/${file}: reiniciando`);
    restartServer();
  });
}
startServer();
run(['node_modules/vite/bin/vite.js', '--port', '5173', '--strictPort'], 'vite');

// Aviso cuando ambos responden.
const lan = Object.values(networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254.'))?.address;
const t0 = Date.now();
const ping = async () => {
  try {
    const [a, b] = await Promise.all([fetch(`http://localhost:${PORT}/api/health`), fetch('http://localhost:5173/api/health')]);
    if (a.ok && b.ok) {
      console.log(`\n  Deutschtrainer Plus (local) listo en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      console.log('  → http://localhost:5173');
      if (lan) console.log(`  → http://${lan}:5173  (móvil en la misma wifi)`);
      console.log(`  Datos: ${DATA_DIR}\n  Ctrl+C para parar.\n`);
      return;
    }
  } catch { /* aún arrancando */ }
  if (Date.now() - t0 < 60_000) setTimeout(ping, 500);
};
setTimeout(ping, 800);
