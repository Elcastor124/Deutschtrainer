// Shared transport only: answer keys and audio scripts live exclusively on the server.
export type RoadRole = 'teacher' | 'player' | 'projector';
export type RoadSection = 'intro' | 'lesen' | 'korrektur' | 'diktat' | 'horen' | 'ergebnisse';
export type RoadActivity = 'lesen' | 'diktat' | 'horen';
export interface RoadQuestion { id: string; number: number; type: 'boolean' | 'choice' | 'matching' | 'yesno'; prompt: string; options: string[]; textId?: string; audioId?: string }
export interface RoadText { id: string; title: string; body: string; label?: string }
export interface RoadPart { id: string; title: string; instruction: string; texts: RoadText[]; questions: RoadQuestion[]; example?: string }
export interface RoadAudio { id: string; title: string; duration?: number }
export interface RoadLevel { id: string; version: string; title: string; disclaimer: string; schedule: { id: RoadSection; title: string; minutes: number }[]; reading: RoadPart[]; listening: { audio: RoadAudio; questions: RoadQuestion[] }[]; dictation: { title: string; rubric: string[] }; maxPoints: number }
export interface RoadSecret { answers: Record<string,string>; scripts: Record<string,string>; dictation: string; dictationFragments: string[] }
export interface RoadWelcome { code: string; token: string; role: RoadRole; pid?: string }
export interface RoadScore { lesen: number; horen: number; diktat: number | null; total: number | null; outOf: 50; grade: number | null; percent: number | null; pending: boolean }
export interface RoadStudent { id: string; name: string; connected: boolean; progress: { lesen: number; horen: number; diktat: number }; submitted: Record<RoadActivity,boolean>; answers?: Record<string,string>; dictation?: string; rubric?: boolean[]; score?: RoadScore; listens?: Record<string,number>; listenLimits?: Record<string,number> }
export interface RoadView { code: string; role: RoadRole; me?: string; level: RoadLevel; section: RoadSection; paused: boolean; elapsedMs: number; sectionElapsedMs: number; serverNow: number; sealed?: Record<RoadActivity,boolean>; locked: Record<RoadActivity,boolean>; released: Record<RoadActivity,boolean>; players: RoadStudent[]; ownAnswers?: Record<string,string>; ownDictation?: string; ownSubmitted?: Record<RoadActivity,boolean>; ownScore?: RoadScore; solutions?: Partial<RoadSecret>; listens: Record<string,number>; pendingAudio?: Record<string,string>; listenLimits?: Record<string,number>; audioGrant?: { id: string; url: string }; cue?: { serial: number; audioId: string }; history?: { at: number; levelId: string; version: string; score: RoadScore }[] }
export type RoadAction =
 | { type: 'section'; section: RoadSection }
 | { type: 'pause' | 'resume' }
 | { type: 'lock'; activity: RoadActivity; locked: boolean }
 | { type: 'release'; activity: RoadActivity; released: boolean }
 | { type: 'answer'; questionId: string; value: string }
 | { type: 'dictation'; text: string }
 | { type: 'submit'; activity: RoadActivity }
 | { type: 'reopen'; pid: string; activity: RoadActivity }
 | { type: 'review'; pid: string; rubric: boolean[] }
 | { type: 'listen'; audioId: string; exceptional?: boolean }
 | { type: 'audioStarted'; grantId: string }
 | { type: 'restoreListen'; pid: string; audioId: string }
 | { type: 'cue'; audioId: string };
