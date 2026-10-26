import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Compilation on ANGLE alone cannot detect undefined GLSL pow(negative, 2.).
const source = readFileSync(new URL('../src/brand/AmbientField.tsx', import.meta.url), 'utf8');
const fragment = source.match(/const FRAGMENT = `([\s\S]*?)`;/)![1];

describe('ambient GLSL ES portability', () => {
  it('squares signed band distances with multiplication, never pow', () => {
    expect(fragment).not.toMatch(/\bpow\s*\(/);
    expect(fragment).toMatch(/float redDistance = \(uv\.y - curve\) \/ \.23;/);
    expect(fragment).toMatch(/exp\(-redDistance \* redDistance\)/);
    expect(fragment).toMatch(/float goldDistance = \(uv\.y - goldCurve \+ weave \* \.04\) \/ \.095;/);
    expect(fragment).toMatch(/exp\(-goldDistance \* goldDistance\)/);
  });
});
