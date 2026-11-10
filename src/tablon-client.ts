// Cliente del Tablón (/api/tablon). Toda la lógica de permisos vive en el servidor; aquí solo se muestra.
import { playRequest } from './play-client.ts';

export type TicketCategory = 'contenido' | 'funcion' | 'error' | 'otro';
export type TicketStatus = 'abierto' | 'en-curso' | 'hecho' | 'descartado';
export interface TicketView {
  id: string; n: number; category: TicketCategory; title: string; body: string; status: TicketStatus; createdAt: number; updatedAt: number;
  votes: number; reply: string | null; repliedAt: number | null; mine: boolean; voted: boolean;
}
export interface TablonMe { alias: string; active: boolean; canPost: boolean; canVote: boolean; reason: string | null; open: number; limit: number }
export interface TablonLimits { titleMin: number; titleMax: number; bodyMin: number; bodyMax: number; openPerAccount: number; perDay: number }

export const CATEGORY_LABEL: Record<TicketCategory, string> = { contenido: 'Contenido', funcion: 'Función nueva', error: 'Algo falla', otro: 'Otra cosa' };
export const CATEGORY_HINT: Record<TicketCategory, string> = {
  contenido: 'Más ejercicios, un tema, una clase de Klaus…', funcion: 'Algo que te gustaría poder hacer en la web.',
  error: 'Algo que no funciona o se ve mal.', otro: 'Cualquier otra idea.',
};
export const STATUS_LABEL: Record<TicketStatus, string> = { abierto: 'Abierta', 'en-curso': 'En marcha', hecho: 'Hecha', descartado: 'Descartada' };

export const tablonList = () => playRequest<{ tickets: TicketView[]; me: TablonMe | null; limits: TablonLimits }>('/api/tablon');
export const tablonCreate = (t: { category: TicketCategory; title: string; body: string }) => playRequest<{ ticket: TicketView; me: TablonMe }>('/api/tablon/ticket', t);
export const tablonVote = (id: string) => playRequest<{ ticket: TicketView }>('/api/tablon/vote', { id });
export const tablonWithdraw = (id: string) => playRequest<{ ok: true; me: TablonMe }>('/api/tablon/withdraw', { id });
