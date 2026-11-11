// Banco de pruebas de modelos :free (sin coste: max_price 0). Mide si devuelven JSON válido y cuánto tardan.
import { readFileSync } from 'node:fs';
const env = {}; for (const l of readFileSync('.env.openrouter', 'utf8').split(/\r?\n/)) { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(l); if (m) env[m[1]] = m[2].trim(); }
const keys = [env.OPENROUTER_API_KEY, env.OPENROUTER_API_KEY_2].filter(Boolean);
const models = process.argv.slice(2);
const schema = { type: 'object', additionalProperties: false, required: ['action', 'text'], properties: { action: { type: 'string', enum: ['explain'] }, text: { type: 'string' } } };
let k = 0;
async function one(model, structured, reasoning) {
  const t = Date.now();
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', signal: AbortSignal.timeout(45000), headers: { authorization: `Bearer ${keys[k++ % keys.length]}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 1800, reasoning, provider: { max_price: { prompt: 0, completion: 0, request: 0 }, allow_fallbacks: false },
        messages: [{ role: 'system', content: 'Eres Klaus, profesor de alemán para hispanohablantes. Devuelve SOLO un objeto JSON {"action":"explain","text":"..."} en español, máximo 60 palabras.' }, { role: 'user', content: '¿Por qué se dice "ich bin 14 Jahre alt" y no "ich habe 14 Jahre"?' }],
        ...(structured ? { response_format: { type: 'json_schema', json_schema: { name: 'respuesta', strict: true, schema } } } : {}) }) });
    const txt = await r.text(); let j; try { j = JSON.parse(txt); } catch { return `HTTP ${r.status} ilegible ${Date.now() - t}ms`; }
    if (!r.ok) return `HTTP ${r.status} ${(j.error?.metadata?.raw ?? j.error?.message ?? '').slice(0, 70)}`;
    const c = j.choices?.[0]?.message?.content ?? ''; const m = String(c).match(/\{[\s\S]*\}/); let ok = false; try { ok = !!JSON.parse(m?.[0] ?? '').text; } catch { /* */ }
    return `${ok ? 'OK ' : 'BAD'} ${((Date.now() - t) / 1000).toFixed(1)}s cost=${j.usage?.cost ?? 0} ${ok ? '' : JSON.stringify(c).slice(0, 60)}`;
  } catch (e) { return `ERR ${e.name} ${((Date.now() - t) / 1000).toFixed(1)}s`; }
}
await Promise.all(models.map(async (m) => {
  const a = await one(m, true, { enabled: false });
  const b = a.startsWith('OK') ? '' : await one(m, true, { effort: 'low', exclude: true });
  const c = (a.startsWith('OK') || b.startsWith('OK')) ? '' : await one(m, false, { effort: 'low', exclude: true });
  console.log(m.padEnd(52), '|', a, b ? `| low: ${b}` : '', c ? `| sin schema: ${c}` : '');
}));
