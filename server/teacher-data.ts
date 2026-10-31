// Datos PRIVADOS de la academia que gestiona el profesor en Teacher OS: notas, asistencia, grupos, niveles, repasos asignados,
// clases planificadas y ajustes. DATA_DIR/teacher-data.json (0600). Ningún endpoint de alumno lo devuelve, salvo lo que el
// propio alumno debe ver de sí mismo (su nivel, sus repasos asignados y las clases de sus grupos), nunca notas ni asistencia.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

export type StudentLevel = 'A1' | 'A2' | 'B1';
export interface Note { id: string; at: number; by: string; text: string }
export interface Attendance { date: string; status: 'present' | 'absent' | 'late'; sessionId?: string; by: string }
export interface Review { id: string; at: number; by: string; topics: string[]; note?: string }
/** Nota VISIBLE para el alumno (calificación de 0 a 10 con comentario). Las `notes` siguen siendo privadas del profesor. */
export interface Grade { id: string; at: number; by: string; title: string; score: number; comment?: string }
export interface StudentMeta { level?: StudentLevel; groups: string[]; notes: Note[]; attendance: Attendance[]; reviews: Review[]; grades?: Grade[]; hwDone?: Record<string, number> }
/** Deberes: para grupos y/o alumnos concretos. El alumno los ve al entrar y los marca como hechos. */
export interface Homework { id: string; at: number; by: string; title: string; text: string; topics: string[]; due?: string; groups: string[]; students: string[] }
export interface Group { id: string; name: string; createdAt: number }
export interface PlannedSession {
  id: string; title: string; date: string; groupId?: string; studentIds?: string[];
  game: 'blackcard' | 'jenga' | 'boxing' | 'road' | 'none'; topics: string[]; level?: StudentLevel; presentation?: string;
  status: 'planned' | 'live' | 'done'; room?: string; startedAt?: number; endedAt?: number; by: string; createdAt: number;
}
interface Data { version: 1; academy: { name: string }; students: Record<string, StudentMeta>; groups: Group[]; sessions: PlannedSession[]; homework: Homework[] }

const id = () => randomBytes(6).toString('hex');
export const LEVELS_OK: readonly StudentLevel[] = ['A1', 'A2', 'B1'];

export class TeacherData {
  readonly file: string;
  data: Data = { version: 1, academy: { name: 'Mi academia' }, students: {}, groups: [], sessions: [], homework: [] };
  constructor(dataDir: string) {
    this.file = join(dataDir, 'teacher-data.json');
    try {
      if (existsSync(this.file)) {
        const raw = JSON.parse(readFileSync(this.file, 'utf8'));
        if (raw && typeof raw === 'object') this.data = { ...this.data, ...raw, academy: { ...this.data.academy, ...raw.academy }, homework: Array.isArray(raw.homework) ? raw.homework : [] };
      }
    } catch (e) { console.error('[teacher-data] no se pudo leer teacher-data.json; se empieza vacío:', (e as Error).message); }
  }
  save() {
    mkdirSync(join(this.file, '..'), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data), { mode: 0o600 });
    renameSync(tmp, this.file);
  }
  meta(student: string): StudentMeta { return (this.data.students[student] ??= { groups: [], notes: [], attendance: [], reviews: [] }); }
  peek(student: string): StudentMeta | undefined { return this.data.students[student]; }
  addNote(student: string, by: string, text: string) { const n = { id: id(), at: Date.now(), by, text }; this.meta(student).notes.unshift(n); this.save(); return n; }
  removeNote(student: string, noteId: string) { const m = this.meta(student); const before = m.notes.length; m.notes = m.notes.filter((n) => n.id !== noteId); this.save(); return m.notes.length < before; }
  setAttendance(student: string, a: Attendance) { const m = this.meta(student); m.attendance = [a, ...m.attendance.filter((x) => !(x.date === a.date && x.sessionId === a.sessionId))].slice(0, 400); this.save(); }
  addReview(student: string, by: string, topics: string[], note?: string) { const r = { id: id(), at: Date.now(), by, topics, ...(note ? { note } : {}) }; this.meta(student).reviews.unshift(r); this.meta(student).reviews.splice(20); this.save(); return r; }
  removeReview(student: string, reviewId: string) { const m = this.meta(student); m.reviews = m.reviews.filter((r) => r.id !== reviewId); this.save(); }
  addGroup(name: string) { const g = { id: id(), name, createdAt: Date.now() }; this.data.groups.push(g); this.save(); return g; }
  removeGroup(gid: string) { this.data.groups = this.data.groups.filter((g) => g.id !== gid); for (const m of Object.values(this.data.students)) m.groups = m.groups.filter((x) => x !== gid); this.save(); }
  addSession(s: Omit<PlannedSession, 'id' | 'createdAt' | 'status'>) { const n: PlannedSession = { ...s, id: id(), createdAt: Date.now(), status: 'planned' }; this.data.sessions.unshift(n); this.data.sessions.splice(500); this.save(); return n; }
  session(sid: string) { return this.data.sessions.find((s) => s.id === sid); }
  addGrade(student: string, by: string, title: string, score: number, comment?: string) { const g: Grade = { id: id(), at: Date.now(), by, title, score, ...(comment ? { comment } : {}) }; const m = this.meta(student); (m.grades ??= []).unshift(g); m.grades.splice(200); this.save(); return g; }
  removeGrade(student: string, gradeId: string) { const m = this.meta(student); m.grades = (m.grades ?? []).filter((g) => g.id !== gradeId); this.save(); }
  addHomework(h: Omit<Homework, 'id' | 'at'>) { const n: Homework = { ...h, id: id(), at: Date.now() }; this.data.homework.unshift(n); this.data.homework.splice(300); this.save(); return n; }
  removeHomework(hid: string) { this.data.homework = this.data.homework.filter((h) => h.id !== hid); for (const m of Object.values(this.data.students)) if (m.hwDone) delete m.hwDone[hid]; this.save(); }
  /** ¿Va dirigido a este alumno? (directamente o por uno de sus grupos actuales) */
  targets(h: Homework, student: string) { return h.students.includes(student) || h.groups.some((g) => this.peek(student)?.groups.includes(g)); }
  homeworkFor(student: string) { return this.data.homework.filter((h) => this.targets(h, student)); }
  setHomeworkDone(student: string, hid: string, done: boolean) {
    if (!this.data.homework.some((h) => h.id === hid && this.targets(h, student))) return false;
    const m = this.meta(student); m.hwDone ??= {};
    if (done) m.hwDone[hid] = Date.now(); else delete m.hwDone[hid];
    this.save(); return true;
  }
  /** Borra todo lo de un alumno (baja de la cuenta). */
  forget(student: string) { delete this.data.students[student]; for (const h of this.data.homework) h.students = h.students.filter((x) => x !== student); for (const s of this.data.sessions) if (s.studentIds) s.studentIds = s.studentIds.filter((x) => x !== student); this.save(); }
}
