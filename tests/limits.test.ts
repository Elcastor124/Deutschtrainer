import { describe, expect, it } from 'vitest';
import { SlidingLimiter, TokenBucket, clientIp, envInt } from '../server/limits.ts';
import { roomsToExpire, staleRooms, CLASS_ROOM_TTL_MS, PRACTICE_ROOM_TTL_MS } from '../server/room-ttl.ts';

describe('SlidingLimiter', () => {
  it('permite hasta max dentro de la ventana, bloquea y se libera al pasar el tiempo', () => {
    let t = 0;
    const l = new SlidingLimiter(3, 1000, () => t);
    expect([l.take('a'), l.take('a'), l.take('a'), l.take('a')]).toEqual([true, true, true, false]);
    expect(l.take('b')).toBe(true); // claves independientes
    expect(l.retryAfter('a')).toBe(1);
    t = 1001;
    expect(l.take('a')).toBe(true);
  });
  it('blocked/record cuentan solo lo que se registra (para contar fallos)', () => {
    const l = new SlidingLimiter(2, 1000, () => 0);
    expect(l.blocked('x')).toBe(false);
    l.record('x'); l.record('x');
    expect(l.blocked('x')).toBe(true);
  });
  it('sweep libera la memoria de claves caducadas', () => {
    let t = 0;
    const l = new SlidingLimiter(1, 10, () => t);
    for (let i = 0; i < 100; i++) l.take(`ip${i}`);
    expect(l.size).toBe(100);
    t = 100; l.sweep();
    expect(l.size).toBe(0);
  });
});

describe('TokenBucket', () => {
  it('admite una ráfaga, luego el ritmo sostenido', () => {
    let t = 0;
    const b = new TokenBucket(3, 1, () => t);
    expect([b.take(), b.take(), b.take(), b.take()]).toEqual([true, true, true, false]);
    t = 1000;
    expect(b.take()).toBe(true);
    expect(b.take()).toBe(false);
  });
});

describe('clientIp', () => {
  const req = (xff: string | undefined, addr = '10.0.0.9') => ({ headers: xff ? { 'x-forwarded-for': xff } : {}, socket: { remoteAddress: addr } }) as any;
  it('sin TRUST_PROXY ignora X-Forwarded-For: un cliente no puede inventarse otra IP para esquivar los límites', () => {
    expect(clientIp(req('1.2.3.4'), 0)).toBe('10.0.0.9');
  });
  it('con TRUST_PROXY=1 usa la entrada de la derecha (la añadida por nuestro proxy), no la falsificable de la izquierda', () => {
    expect(clientIp(req('6.6.6.6, 203.0.113.7'), 1)).toBe('203.0.113.7');
    expect(clientIp(req('203.0.113.7'), 1)).toBe('203.0.113.7');
    expect(clientIp(req(undefined), 1)).toBe('10.0.0.9');
  });
  it('normaliza IPv4 mapeada en IPv6', () => { expect(clientIp(req(undefined, '::ffff:192.168.1.5'), 0)).toBe('192.168.1.5'); });
});

describe('envInt', () => {
  it('lee enteros no negativos y cae al valor por defecto si es inválido', () => {
    expect(envInt('X', 5, { X: '12' })).toBe(12);
    expect(envInt('X', 5, { X: 'abc' })).toBe(5);
    expect(envInt('X', 5, { X: '-3' })).toBe(5);
    expect(envInt('X', 5, {})).toBe(5);
  });
});

describe('expiración de salas (pura)', () => {
  const H = 3_600_000;
  it('caduca solo lo inactivo más allá del TTL; las salas sin marca reciben gracia en vez de borrarse', () => {
    const rooms: Record<string, { last?: number }> = { vieja: { last: 0 }, activa: { last: 90 * H }, legacy: {} };
    const gone = roomsToExpire(rooms, (r) => r.last, (r, t) => { r.last = t; }, 100 * H, 24 * H);
    expect(gone).toEqual(['vieja']);
    expect(rooms.legacy.last).toBe(100 * H); // gracia: empieza a contar ahora
    expect(roomsToExpire(rooms, (r) => r.last, (r, t) => { r.last = t; }, 100 * H + 10 * H, 24 * H)).toEqual(["vieja"]);
    expect(roomsToExpire(rooms, (r) => r.last, (r, t) => { r.last = t; }, 100 * H + 25 * H, 24 * H).sort()).toEqual(['activa', 'legacy', 'vieja']);
  });
  it('BlackCard/práctica: nunca se descarta una sala con alguien conectado', () => {
    const at = CLASS_ROOM_TTL_MS + 10;
    const rooms: [string, { mode: 'class' | 'practice'; updatedAt: number }][] = [['AAAA', { mode: 'class', updatedAt: 0 }], ['BBBB', { mode: 'class', updatedAt: 0 }], ['PCCC', { mode: 'practice', updatedAt: 0 }], ['PNEW', { mode: 'practice', updatedAt: at - 1000 }]];
    expect(staleRooms(rooms, (c) => c === 'BBBB', at).sort()).toEqual(['AAAA', 'PCCC']);
    // una práctica caduca antes que una sala de clase
    expect(staleRooms([['P1', { mode: 'practice', updatedAt: 0 }], ['C1', { mode: 'class', updatedAt: 0 }]], () => false, PRACTICE_ROOM_TTL_MS + 1)).toEqual(['P1']);
  });
});
