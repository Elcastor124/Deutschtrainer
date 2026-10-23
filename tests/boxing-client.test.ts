import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BoxingView, BoxingWelcome } from '../shared/boxing.ts';
import { BoxingClient, readBoxingSession, saveBoxingSession } from '../src/boxing-client.ts';

const welcome: BoxingWelcome = { code: 'ABCD', token: 'private-session', role: 'player', pid: 'p1' };
const view: BoxingView = { code: 'ABCD', role: 'player', me: 'p1', phase: 'question', exchange: 1, maxExchanges: 8, paused: false, fighters: [] };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('boxing browser session', () => {
  it('keeps teacher and player tokens in separate room-role slots and restores only the requested room', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    saveBoxingSession(welcome, storage);
    saveBoxingSession({ ...welcome, role: 'teacher', token: 'teacher-secret' }, storage);
    expect(readBoxingSession('ABCD', 'player', storage)?.token).toBe('private-session');
    expect(readBoxingSession('ABCD', 'teacher', storage)?.token).toBe('teacher-secret');
    expect(readBoxingSession('ZZZZ', 'player', storage)).toBeNull();
  });
});

describe('boxing polling transport', () => {
  it('polls at 650 ms and cancels its schedule on exit', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValue(json(view));
    vi.stubGlobal('fetch', fetcher);
    const client = new BoxingClient(welcome);
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(649);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    client.close();
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('never applies a response after leaving the room', async () => {
    let resolve!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise<Response>((done) => { resolve = done; })));
    const client = new BoxingClient(welcome);
    const pending = client.refresh();
    client.close();
    resolve(json(view));
    await pending;
    expect(client.getSnapshot().view).toBeNull();
  });
  it('ignores late responses after closing or superseding a request', async () => {
    let resolve!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => new Promise<Response>((done) => { resolve = done; })).mockResolvedValue(json({ ...view, phase: 'action' })));
    const client = new BoxingClient(welcome);
    const old = client.refresh();
    await client.refresh();
    resolve(json(view));
    await old;
    expect(client.getSnapshot().view?.phase).toBe('action');
    client.close();
  });
  it('sends an authenticated action once while busy and reconciles with the server', async () => {
    let resolve!: (response: Response) => void;
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>((done) => { resolve = done; })).mockResolvedValue(json({ ...view, ownAnswer: 2 }));
    vi.stubGlobal('fetch', fetcher);
    const client = new BoxingClient(welcome);
    const pending = client.action({ type: 'answer', questionId: 'q1', answer: 2 });
    expect(client.getSnapshot().busy).toBe(true);
    expect(await client.action({ type: 'answer', questionId: 'q1', answer: 1 })).toBe(false);
    expect(fetcher.mock.calls[0][0]).toBe('/api/boxing/action');
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ code: 'ABCD', action: { type: 'answer', questionId: 'q1', answer: 2 } });
    resolve(json({ ok: true }));
    expect(await pending).toBe(true);
    expect(client.getSnapshot().view?.ownAnswer).toBe(2);
    client.close();
  });
  it('uses Bearer auth, preserves the last view and session on failure, and can retry', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json(view)).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(json({ ...view, phase: 'action' }));
    vi.stubGlobal('fetch', fetcher);
    const client = new BoxingClient(welcome);
    await client.refresh();
    expect(fetcher.mock.calls[0][0]).toBe('/api/boxing/state?code=ABCD');
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer private-session');
    expect(client.getSnapshot().view?.phase).toBe('question');
    await client.refresh();
    expect(client.getSnapshot().connection).toBe('offline');
    expect(client.getSnapshot().view?.phase).toBe('question');
    await client.refresh();
    expect(client.getSnapshot().view?.phase).toBe('action');
    expect(client.getSnapshot().error).toBeNull();
    client.close();
  });
});
