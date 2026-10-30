// Administra las credenciales de profesor del servidor (DATA_DIR/teachers.json). Solo se guarda un hash salado.
//   npm run teacher -- add "Nombre"      → crea un profesor y muestra su clave UNA vez
//   npm run teacher -- list              → lista profesores (sin claves)
//   npm run teacher -- revoke <id>       → revoca una clave
// El servidor detecta los cambios del fichero (altas y revocaciones) sin reiniciar.
import { join, resolve } from 'node:path';
import { TeacherDirectory } from '../server/teacher-auth.ts';

const dir = process.env.DATA_DIR || join(resolve(import.meta.dirname, '..'), 'data');
const dirTeachers = new TeacherDirectory(dir);
const [cmd, arg] = process.argv.slice(2);

if (cmd === 'add' && arg) {
  const { id, key } = dirTeachers.issue(arg);
  console.log(`Profesor creado: ${arg} (id ${id})\n\nCLAVE (guárdala ahora; no se puede volver a ver):\n\n  ${key}\n`);
  console.log("En el navegador del profesor: localStorage.setItem('dt:teacher-key', '<clave>')");
} else if (cmd === 'list') {
  for (const t of dirTeachers.list()) console.log(`${t.id}  ${t.name}  ${t.revokedAt ? 'REVOCADA' : 'activa'}  ${new Date(t.createdAt).toISOString()}`);
} else if (cmd === 'revoke' && arg) {
  console.log(dirTeachers.revoke(arg) ? 'Revocada.' : 'No existe o ya estaba revocada.');
} else {
  console.error('Uso: npm run teacher -- add "Nombre" | list | revoke <id>');
  process.exit(1);
}
