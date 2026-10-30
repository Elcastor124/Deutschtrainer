export type BoxingMove = 'jab' | 'cross' | 'hook' | 'guard' | 'dodge';
export type BoxingPhase = 'lobby' | 'question' | 'action' | 'result' | 'finished';
export interface BoxingQuestion {
  id: string; prompt: string; options: string[]; answer: number;
  explanation: string; topic: string;
}
export interface BoxingFighter {
  id: string; name: string; hp: number; stamina: number;
  correct: number; wrong: number; damage: number; connected: boolean;
  answered: boolean; lockedMove: boolean;
}
export interface BoxingResolution {
  exchange: number;
  fighters: { id: string; move: BoxingMove | 'recover'; correct: boolean; damageDealt: number; damageTaken: number; blocked: boolean; dodged: boolean }[];
  explanation: string; answer: string;
}
export interface BoxingView {
  code: string; phase: BoxingPhase; exchange: number; maxExchanges: number;
  paused: boolean; fighters: BoxingFighter[];
  question?: { id: string; prompt: string; options: string[]; topic: string };
  me?: string; role: 'teacher' | 'player';
  ownAnswer?: number; ownCorrect?: boolean; ownMove?: BoxingMove;
  result?: BoxingResolution; winner?: string | 'draw';
  joinUrl?: string;
  /** Modo libre (sin profesor). `deadline`: instante (ms) en que el servidor decide por quien no actúe. */
  free?: { mode: 'solo' | 'private'; ready: string[]; deadline: number | null };
}
export interface BoxingWelcome { code: string; token: string; role: 'teacher' | 'player'; pid?: string; /** Partida del modo libre: usa /api/play/boxing/*. */ free?: boolean }
export type BoxingAction =
 | { type: 'start' | 'next' | 'pause' | 'resume' | 'reveal' | 'restart' }
 /** Solo modo libre (partida privada): «estoy listo». Cuando los dos lo están, empieza sin profesor. */
 | { type: 'ready' }
 | { type: 'answer'; questionId: string; answer: number }
 | { type: 'move'; questionId: string; move: BoxingMove };
export const BOXING_MOVES: {id:BoxingMove;name:string;description:string;cost:number}[] = [
 {id:'jab',name:'Jab',description:'8 de daño. La esquiva no evita el jab.',cost:1},
 {id:'cross',name:'Directo',description:'12 de daño. La esquiva lo evita.',cost:2},
 {id:'hook',name:'Crochet',description:'16 de daño. Cuesta más energía; la esquiva lo evita.',cost:3},
 {id:'guard',name:'Defensa',description:'Bloquea el 75 % del daño y recupera energía.',cost:0},
 {id:'dodge',name:'Esquiva',description:'Evita directo y crochet, pero no el jab.',cost:1},
];
