// Klaus (Schreibt, Redet, Unterricht) es solo Plus. Las pruebas de navegador arrancan su propio servidor con una
// contraseña de profesor temporal y dan Plus por el camino real: Teacher OS (POST /api/teacher/students/:id { plan }).
// Importar ANTES de launch(): fija TEACHER_PASSWORD en el entorno que hereda el servidor de prueba (nunca la de producción).
import { randomBytes } from 'node:crypto';

const external = process.argv.includes("--base") || !!process.env.BASE;
if (!external) {
  process.env.TEACHER_PASSWORD = `prueba-local-${randomBytes(6).toString('hex')}`;
  // Las pruebas comprueban el agotamiento de cuota con cifras pequeñas: en el servidor de prueba Plus usa las de Free.
  process.env.KLAUS_LIMITS_PLUS = JSON.stringify({ text: 3, voiceSeconds: 60, ttsChars: 1500, klasseSessions: 1, klasseAsks: 3 });
}

async function teacher(base) {
  const r = await fetch(`${base}/api/teacher/login`, { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify({ key: process.env.TEACHER_PASSWORD }) });
  if (r.status !== 200) throw new Error(`login de profesor (${r.status})`);
  return (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
}

/** Pone el plan de la cuenta `alias` (o de todas las que lo cumplan con `match`) desde Teacher OS. Devuelve cuántas. */
export async function setPlan(base, match, plan = 'plus') {
  if (external) throw new Error('con --base no hay profesor de prueba: da Plus a mano desde Teacher OS');
  const cookie = await teacher(base);
  const list = await (await fetch(`${base}/api/teacher/students`, { headers: { cookie } })).json();
  const pick = list.students.filter((s) => (typeof match === 'string' ? s.alias === match : match(s)));
  for (const s of pick) {
    const r = await fetch(`${base}/api/teacher/students/${s.id}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: base, cookie }, body: JSON.stringify({ plan }) });
    if (r.status !== 200) throw new Error(`plan de ${s.alias} (${r.status})`);
  }
  return pick.length;
}
/** Plus para todas las cuentas que aún no lo tienen. */
export const plusAll = (base) => setPlan(base, (s) => s.plan !== 'plus');

/** Practicar exige cuenta (plan Free: 2 al día). Crea una cuenta en la página `P` (cookie real), la deja con sesión y le da Plus. */
export async function studentPlus(P, base, alias = 'Qa' + Date.now().toString(36).slice(-6)) {
  const st = await P.eval(`fetch('/api/account/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({alias:'${alias}',password:'zorro-azul-mesa-72-lluvia'})}).then(r=>r.status)`);
  if (st !== 200) throw new Error(`alta de ${alias} (${st})`);
  await P.eval(`localStorage.setItem('dt:student-session','cookie'); localStorage.setItem('dt:student-alias','${alias}'); true`);
  await setPlan(base, alias);
  return alias;
}
