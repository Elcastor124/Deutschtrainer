import { describe, expect, it } from 'vitest';
import { parseCatalog, loadCatalog } from './catalog.ts';

const entry = { id: 'intro', title: 'Clase', description: 'Repaso', file: '/presentaciones/clase.html', topics: ['Perfekt'], level: 'A1–A2', pdf: '/presentaciones/clase.pdf' };
describe('Presentation catalog', () => {
  it('preserves manifest HTML, PDF, topic and level metadata', () => {
    expect(parseCatalog([entry])).toEqual([entry]);
  });
  it('rejects malformed catalogs and unsafe or external asset links', () => {
    for (const value of [{}, [null], [{ ...entry, file: 'javascript:alert(1)' }], [{ ...entry, file: '//example.org/test.html' }], [{ ...entry, pdf: 'https://example.org/a.pdf' }]]) {
      expect(() => parseCatalog(value)).toThrow();
    }
    expect(parseCatalog([])).toEqual([]);
    const { pdf: _pdf, ...withoutPdf } = entry;
    expect(parseCatalog([withoutPdf])).toEqual([withoutPdf]);
  });
  it('fetches the manifest at runtime and reports unavailable catalogs', async () => {
    const urls: string[] = [];
    const fetchCatalog = async (url: string) => { urls.push(url); return { ok: true, json: async () => [entry] }; };
    expect(await loadCatalog(fetchCatalog)).toEqual([entry]);
    expect(urls).toEqual(['/presentaciones/catalogo.json']);
    await expect(loadCatalog(async () => ({ ok: false, json: async () => [] }))).rejects.toThrow();
  });
});
