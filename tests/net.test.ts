// Reconexión del cliente: tras «welcome», el hello de reconexión debe conservar perfil/nombre/temas de la práctica
// (si el servidor se reinicia y la sala ya no existe, así se crea otra para EL MISMO alumno) y nunca repetir «create».
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Net } from '../src/net.ts';

class FakeWS {
  static OPEN = 1;
  static all: FakeWS[] = [];
  readyState = 0;
  OPEN = 1;
  sent: string[] = [];
  onopen?: () => void; onmessage?: (e: { data: string }) => void; onclose?: () => void;
  url: string;
  constructor(url: string) { this.url = url; FakeWS.all.push(this); }
  send(s: string) { this.sent.push(s); }
  close() { this.readyState = 3; this.onclose?.(); }
  open() { this.readyState = 1; this.onopen?.(); }
  msg(m: unknown) { this.onmessage?.({ data: JSON.stringify(m) }); }
}

function boot() {
  FakeWS.all = [];
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', FakeWS);
  vi.stubGlobal('location', { protocol: 'http:', host: 'x' });
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Net · reconexión', () => {
  it('práctica: al reconectar envía room+token y además perfil, nombre, temas y tamaño', () => {
    boot();
    const net = new Net({ t: 'hello', role: 'practice', name: 'Ana', profile: 'profile-ana-1', topics: ['dativ'], focus: true, size: 10 });
    FakeWS.all[0].open();
    FakeWS.all[0].msg({ t: 'welcome', role: 'practice', room: 'PAAAAA', token: 'tok', profile: 'profile-ana-1' });
    FakeWS.all[0].close();
    vi.advanceTimersByTime(6000);
    FakeWS.all[1].open();
    const h = JSON.parse(FakeWS.all[1].sent[0]);
    expect(h).toMatchObject({ t: 'hello', role: 'practice', room: 'PAAAAA', token: 'tok', profile: 'profile-ana-1', name: 'Ana', topics: ['dativ'], focus: true, size: 10 });
    net.close();
  });

  it('profesor: reconecta a SU sala, sin volver a crear otra', () => {
    boot();
    const net = new Net({ t: 'hello', role: 'teacher', create: true, topics: ['dativ'], start: 'jenga' });
    FakeWS.all[0].open();
    FakeWS.all[0].msg({ t: 'welcome', role: 'teacher', room: 'ABCD', token: 'tt' });
    FakeWS.all[0].close();
    vi.advanceTimersByTime(6000);
    FakeWS.all[1].open();
    const h = JSON.parse(FakeWS.all[1].sent[0]);
    expect(h).toEqual({ t: 'hello', role: 'teacher', room: 'ABCD', token: 'tt' });
    net.close();
  });

  it('expone el aviso del servidor (práctica nueva tras reinicio)', () => {
    boot();
    const net = new Net({ t: 'hello', role: 'practice', room: 'PGONE1', token: 'x', profile: 'profile-ana-1' });
    FakeWS.all[0].open();
    FakeWS.all[0].msg({ t: 'welcome', role: 'practice', room: 'PNEW11', token: 'n', notice: 'empezamos una nueva' });
    expect(net.state.notice).toBe('empezamos una nueva');
    net.close();
  });
});
