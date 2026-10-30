// Cliente de Teacher OS. La sesión del profesor es una cookie HttpOnly (dt_t): aquí no se guarda ninguna credencial.
export class TeacherApiError extends Error { status: number; constructor(status: number, m: string) { super(m); this.status = status; } }
export async function tapi<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/teacher/${path}`, {
    method: body === undefined ? 'GET' : 'POST', cache: 'no-store', credentials: 'same-origin',
    headers: body === undefined ? { Accept: 'application/json' } : { 'Content-Type': 'application/json', Accept: 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let data: unknown = null;
  try { data = await res.json(); } catch { /* vacío */ }
  if (!res.ok) throw new TeacherApiError(res.status, (data as { error?: string } | null)?.error ?? 'No se pudo completar la acción.');
  return data as T;
}
export type Agg = { key: string; n: number; correct: number; accuracy: number | null };
export interface StudentRow { id: string; alias: string; level: 'A1' | 'A2' | 'B1' | null; groups: string[]; disabled: boolean; createdAt: number; createdByTeacher: boolean; lastActive: number | null; answers7: number; answers30: number; accuracy30: number | null; activities: number; streak: number }
export interface Group { id: string; name: string }
export interface PlannedSession { id: string; title: string; date: string; groupId?: string; studentIds?: string[]; game: string; topics: string[]; level?: string; presentation?: string; status: 'planned' | 'live' | 'done'; room?: string; startedAt?: number; endedAt?: number }
export interface Live { code: string; phase: string; players: number; connected: number; review: number; block: string | null }
export interface Overview {
  academy: string; students: { total: number; active7: number; disabled: number }; sessions: { planned: number; done: number; classRooms30: number };
  activities: { week: number; total: number }; upcoming: PlannedSession[]; trend: { week: string; n: number; students: number; accuracy: number | null }[];
  weakTopics: { topic: string; name: string; n: number; accuracy: number; students: number }[]; attention: { id: string; alias: string; reason: string }[];
  review: { code: string; pending: number }[]; live: Live[]; minN: number;
}
export interface Detail {
  student: StudentRow; overview: { answers: number; correct: number; activities: number; activeDays28: number; firstSeen: number | null; recommended: string[] };
  progress: { week: string; n: number; accuracy: number | null; points: number; activities: number }[];
  grammar: { topic: string; name: string; n: number; accuracy: number; byDiff: Agg[] }[];
  errors: { qid: string; wrong: number; n: number; prompt: string; topic: string }[];
  activities: { at: number; game: string; level: string | null; total: number; correct: number; points: number; room: string | null }[];
  notes: { id: string; at: number; by: string; text: string }[]; attendance: { date: string; status: 'present' | 'absent' | 'late'; by: string }[];
  reviews: { id: string; at: number; by: string; topics: string[]; note?: string }[]; minN: number;
}
export interface Analytics { n: number; students: number; accuracy: number | null; sufficient: boolean; minN: number; byWeekday: Agg[]; byHour: Agg[]; byTopic: Agg[]; byDiff: Agg[]; bySource: Agg[]; note: string }
export interface LibraryItem { id: string; type: 'presentacion' | 'juego' | 'examen' | 'actividad' | 'repaso'; title: string; description: string; topics: string[]; levels: string[]; unit: number | null; open: string | null; pdf: string | null; launch: string | null }
