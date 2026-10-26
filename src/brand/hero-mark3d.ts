import * as THREE from 'three';
import { DT_MARK } from './logo-mark.ts';

/** Read only the absolute SVG command vocabulary used by the canonical sketch.
 * No traced/reinvented coordinates: both the SVG and physical relief use DT_MARK.
 */
function sketchShape(d: string): THREE.Shape {
  const tokens = d.match(/[A-Za-z]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/g) ?? [];
  const shape = new THREE.Shape();
  let i = 0, x = 0, y = 0;
  const n = () => Number(tokens[i++]);
  const X = (v: number) => (v - 60) / 22;
  const Y = (v: number) => (60 - v) / 22;
  while (i < tokens.length) {
    const cmd = tokens[i++];
    switch (cmd) {
      case 'M': x = n(); y = n(); shape.moveTo(X(x), Y(y)); break;
      case 'L': x = n(); y = n(); shape.lineTo(X(x), Y(y)); break;
      case 'H': x = n(); shape.lineTo(X(x), Y(y)); break;
      case 'V': y = n(); shape.lineTo(X(x), Y(y)); break;
      case 'C': { const a = n(), b = n(), c = n(), e = n(); x = n(); y = n(); shape.bezierCurveTo(X(a), Y(b), X(c), Y(e), X(x), Y(y)); break; }
      case 'Q': { const a = n(), b = n(); x = n(); y = n(); shape.quadraticCurveTo(X(a), Y(b), X(x), Y(y)); break; }
      case 'Z': shape.closePath(); break;
      default: throw new Error(`Unsupported canonical logo command: ${cmd}`);
    }
  }
  return shape;
}

/** Real enamel/metal relief, not a texture or coplanar pasted SVG. */
export function createHeroMark(): THREE.Group {
  const mark = new THREE.Group();
  mark.name = 'dt-pencil-book-relief';
  const ivory = new THREE.MeshPhysicalMaterial({ color: 0xf2f1ee, roughness: 0.27, metalness: 0.12, clearcoat: 1, clearcoatRoughness: 0.17 });
  const red = new THREE.MeshPhysicalMaterial({ color: 0xd91e18, roughness: 0.24, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.18 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe9b949, roughness: 0.24, metalness: 0.85 });
  const graphite = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.38, metalness: 0.3 });
  const stroke = (name: string, d: string, width: number, material: THREE.Material, z: number) => {
    const path = sketchShape(d);
    class ReliefCurve extends THREE.Curve<THREE.Vector3> {
      constructor() { super(); }
      getPoint(t: number, target = new THREE.Vector3()) {
        const p = path.getPoint(t);
        return target.set(p.x, p.y, z);
      }
    }
    const curve = new ReliefCurve();
    const radius = width / 44;
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 112, radius, 12, false), material);
    mesh.name = name;
    mesh.userData.canonicalPath = d;
    mark.add(mesh);
    // Polished hemispherical terminals keep the sketch's rounded stroke caps.
    const capGeometry = new THREE.SphereGeometry(radius, 12, 8);
    for (const t of [0, 1]) {
      const cap = new THREE.Mesh(capGeometry, material);
      cap.name = `${name}-cap`;
      cap.position.copy(curve.getPoint(t));
      mark.add(cap);
    }
  };
  const solid = (name: string, d: string, material: THREE.Material, z: number, depth: number) => {
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(sketchShape(d), { depth, bevelEnabled: true, bevelSize: 0.024, bevelThickness: 0.024, bevelSegments: 3, steps: 1, curveSegments: 20 }), material);
    mesh.name = name;
    mesh.userData.canonicalPath = d;
    mesh.position.z = z;
    mark.add(mesh);
  };
  stroke('d-notebook', DT_MARK.notebook, 5.2, red, 0.58);
  stroke('a-peak', DT_MARK.peak, 5.6, ivory, 0.65);
  stroke('t-stem', DT_MARK.spine, 3.2, ivory, 0.59);
  stroke('page-turn', DT_MARK.pageTurn, 1.7, red, 0.57);
  DT_MARK.lines.forEach((d, i) => stroke(`notebook-line-${i}`, d, 2.2, gold, 0.59));
  solid('t-pencil', DT_MARK.pencil, red, 0.65, 0.2);
  stroke('pencil-facet', DT_MARK.pencilFacet, 1.3, ivory, 0.88);
  stroke('ferrule', DT_MARK.ferrule, 1.6, ivory, 0.88);
  solid('pencil-tip', DT_MARK.tip, gold, 0.65, 0.2);
  solid('graphite', DT_MARK.graphite, graphite, 0.86, 0.055);
  return mark;
}
