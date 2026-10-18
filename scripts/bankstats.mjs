// Estadísticas del banco: cuántas preguntas hay para cada bloque (y cuántas partidas dan sin repetir).
import { loadBank } from '../server/bank/index.ts';
import { RULES } from '../server/select.ts';
const bank = [...loadBank().values()];
const by = (f) => bank.reduce((m, q) => { const k = f(q); m[k] = (m[k] ?? 0) + 1; return m; }, {});
console.log('total', bank.length);
console.log('tipo', by((q) => q.type));
console.log('tema', by((q) => q.topic));
console.log('dificultad', by((q) => q.diff));
console.log('fuente', by((q) => q.src));
console.log('unlock', by((q) => (q.unlock ? `${q.topic}/${q.type}` : 'no')));
for (const [b, r] of Object.entries(RULES)) {
  const pool = bank.filter((q) => r.filter(q, { reading: 'samstag' }));
  const per = Object.values(r.mix).reduce((a, x) => a + x, 0);
  const d = pool.reduce((m, q) => { m[q.diff] = (m[q.diff] ?? 0) + 1; return m; }, {});
  const games = Math.min(...Object.entries(r.mix).map(([k, n]) => Math.floor((d[k] ?? 0) / n)));
  console.log(b.padEnd(7), 'pool', String(pool.length).padStart(4), 'por partida', per, 'partidas sin repetir ≈', games, JSON.stringify(d), r.unlock ? `unlock: ${pool.filter((q) => q.unlock).length}` : '');
}
