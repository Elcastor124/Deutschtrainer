export interface Presentation {
  id: string;
  title: string;
  description: string;
  file: string;
  topics: string[];
  level?: string;
  pdf?: string;
}

function isAsset(value: unknown, extension: 'html' | 'pdf'): value is string {
  return typeof value === 'string' && value.startsWith('/presentaciones/') &&
    value.endsWith(`.${extension}`) && !/[\\?#\u0000-\u001f]/.test(value) &&
    !value.split('/').includes('..');
}

export function parseCatalog(value: unknown): Presentation[] {
  if (!Array.isArray(value)) throw new Error('Formato de catálogo no válido.');
  const ids = new Set<string>();
  return value.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('Presentación no válida.');
    const p = item as Record<string, unknown>;
    if (typeof p.id !== 'string' || !p.id || ids.has(p.id) || typeof p.title !== 'string' || !p.title ||
        typeof p.description !== 'string' || !isAsset(p.file, 'html') || !Array.isArray(p.topics) ||
        !p.topics.every((topic) => typeof topic === 'string') ||
        (p.level !== undefined && typeof p.level !== 'string') ||
        (p.pdf !== undefined && !isAsset(p.pdf, 'pdf'))) throw new Error('Presentación no válida.');
    ids.add(p.id);
    return { id: p.id, title: p.title, description: p.description, file: p.file,
      topics: p.topics as string[], ...(p.level !== undefined ? { level: p.level as string } : {}),
      ...(p.pdf !== undefined ? { pdf: p.pdf as string } : {}) };
  });
}

type CatalogFetch = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;
export async function loadCatalog(fetchCatalog: CatalogFetch = fetch): Promise<Presentation[]> {
  const response = await fetchCatalog('/presentaciones/catalogo.json');
  if (!response.ok) throw new Error('No se ha podido cargar el catálogo.');
  return parseCatalog(await response.json());
}
