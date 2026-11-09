// Parada de un servidor de prueba (proceso hijo) que libera el candado de DATA_DIR.
// Linux/Render: SIGTERM. Windows: kill() no ejecuta manejadores de señal, así que se pide el apagado por IPC.
import type { ChildProcess } from 'node:child_process';

export async function stopServerProcess(proc: ChildProcess, graceMs = 12_000): Promise<void> {
  if (proc.exitCode !== null || proc.signalCode !== null) return;
  const exited = new Promise<void>((r) => proc.once('exit', () => r()));
  if (proc.connected) proc.send('shutdown'); else proc.kill('SIGTERM');
  const force = setTimeout(() => { if (proc.exitCode === null) proc.kill(); }, graceMs);
  await exited;
  clearTimeout(force);
}
