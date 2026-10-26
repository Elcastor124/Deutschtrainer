import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as hero from '../src/brand/hero3d.ts';
import { DT_MARK } from '../src/brand/logo-mark.ts';
import { readFileSync } from 'node:fs';

describe('homepage raised sketch logo', () => {
  it('replaces the Punkt-D with actual dimensional meshes of the canonical sketch', () => {
    const factory = (hero as unknown as { createHeroMark?: () => THREE.Group }).createHeroMark;
    expect(factory, 'the hero must build the new mark rather than the legacy D').toBeTypeOf('function');
    const mark = factory!();
    const names = mark.children.map(m => m.name);
    for (const name of ['a-peak', 'd-notebook', 't-stem', 'page-turn', 't-pencil', 'pencil-facet', 'pencil-tip', 'graphite', 'ferrule']) expect(names).toContain(name);
    for (const [name, path] of [['a-peak', DT_MARK.peak], ['d-notebook', DT_MARK.notebook], ['t-pencil', DT_MARK.pencil], ['pencil-tip', DT_MARK.tip]]) {
      const part = mark.getObjectByName(name)! as THREE.Mesh;
      expect(part.userData.canonicalPath).toBe(path);
      part.geometry.computeBoundingBox();
      const size = part.geometry.boundingBox!.getSize(new THREE.Vector3());
      expect(size.z).toBeGreaterThan(0.05);
      expect(part.material).toBeInstanceOf(THREE.Material);
    }
    expect(names.filter(n => /^notebook-line-\d$/.test(n))).toHaveLength(4);
    const box = new THREE.Box3().setFromObject(mark);
    expect(box.min.x).toBeGreaterThan(-2.8);
    expect(box.max.x).toBeLessThan(2.8);
    expect(box.min.y).toBeGreaterThan(-2.8);
    expect(box.max.y).toBeLessThan(2.8);
    expect(box.min.z).toBeGreaterThan(0.4); // raised entirely above the plaque face
    mark.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); const mats = Array.isArray(o.material) ? o.material : [o.material]; mats.forEach(m => m.dispose()); } });
    const source = readFileSync(new URL('../src/brand/hero3d.ts', import.meta.url), 'utf8');
    expect(source).not.toContain('SYMBOL.dot');
    expect(source).not.toContain('bowlCurve');
  });
});
