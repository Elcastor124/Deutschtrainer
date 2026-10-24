import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchLeaderboard, fetchMyProgress, weekLabel } from '../src/progress-client.ts';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
afterEach(() => { vi.unstubAllGlobals(); });

describe('progress client', () => {
  it('asks only for the given profile, URL-encoded, without caching', async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ known: true, weekPoints: 5 }));
    vi.stubGlobal('fetch', fetcher);
    const r = await fetchMyProgress('alumno-aaaa');
    expect(r).toEqual({ ok: true, data: { known: true, weekPoints: 5 } });
    expect(fetcher.mock.calls[0][0]).toBe('/api/progress/me?profile=alumno-aaaa');
    expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: 'no-store' });
  });
  it('reports offline / server errors instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(await fetchLeaderboard()).toEqual({ ok: false, offline: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'x' }, 500)));
    expect(await fetchLeaderboard()).toEqual({ ok: false, offline: false });
    // a static host returning the SPA HTML is not a valid API
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<!doctype html>', { status: 200, headers: { 'Content-Type': 'text/html' } })));
    expect(await fetchLeaderboard()).toEqual({ ok: false, offline: true });
  });
  it('formats ISO weeks as short Spanish labels', () => {
    expect(weekLabel('2026-W43')).toBe('S43');
  });
});
