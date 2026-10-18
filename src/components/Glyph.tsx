// Iconos dot-matrix: objetos (9×9) y figuras de las teclas de respuesta (7×7), como una pantalla de puntos.
import type { ItemId } from '../../shared/types.ts';

export const GLYPHS: Record<ItemId, string[]> = {
  blackcard: ['....#....', '...###...', '..#####..', '.#######.', '#########', '#########', '.##.#.##.', '....#....', '...###...'],
  thief: ['.........', '.........', '#########', '##..#..##', '#.##.##.#', '#########', '.##...##.', '.........', '.........'],
  shield: ['#########', '#########', '##.....##', '##.....##', '##.....##', '.##...##.', '..##.##..', '...###...', '....#....'],
  double: ['.........', '#...#.##.', '.#.#.#..#', '..#....#.', '.#.#..#..', '#...#.###', '.........', '.........', '.........'],
  sabotage: ['.....##..', '....##...', '...##....', '..######.', '....##...', '...##....', '..##.....', '.##......', '.#.......'],
  second: ['..#####..', '.##...##.', '.......##', '......##.', '....##...', '..##.....', '.##......', '.#######.', '.........'],
  wildcard: ['....#....', '....#....', '...###...', '#########', '.#######.', '..#####..', '..##.##..', '.##...##.', '.#.....#.'],
};

export const CHEST_ROWS = ['..#######..', '.#.......#.', '#.........#', '###########', '#...###...#', '#...#.#...#', '#...###...#', '#.........#', '###########'];
export const STAR_ROWS = ['...#...', '...#...', '#######', '.#####.', '..###..', '.##.##.', '##...##'];

/** Figuras de las teclas de respuesta: se reconocen en el proyector («¡el triángulo!»). */
export const SHAPES = {
  tri: ['...#...', '..###..', '..###..', '.#####.', '.#####.', '#######', '#######'],
  dia: ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'],
  cir: ['..###..', '.#####.', '#######', '#######', '#######', '.#####.', '..###..'],
  sqr: ['.......', '.#####.', '.#####.', '.#####.', '.#####.', '.#####.', '.......'],
  yes: ['.......', '......#', '.....##', '#...##.', '##.##..', '.###...', '..#....'],
  no: ['#.....#', '##...##', '.##.##.', '..###..', '.##.##.', '##...##', '#.....#'],
} as const;
export type ShapeId = keyof typeof SHAPES;
export const SHAPE_ORDER: ShapeId[] = ['tri', 'dia', 'cir', 'sqr'];

/** Figura de la opción i: Richtig/Falsch usan ✓ y ✗; el resto, triángulo, rombo, círculo y cuadrado. */
export function shapeFor(options: string[] | undefined, i: number): ShapeId {
  if (options?.length === 2 && options[0] === 'Richtig' && options[1] === 'Falsch') return i === 0 ? 'yes' : 'no';
  return SHAPE_ORDER[i % SHAPE_ORDER.length];
}

export function DotGlyph({ rows, color = 'currentColor', dim = 'rgba(242,241,238,0.08)', className }: { rows: readonly string[]; color?: string; dim?: string; className?: string }) {
  const h = rows.length, w = rows[0]?.length ?? h;
  return (
    <svg className={className} viewBox={`0 0 ${w * 10} ${h * 10}`} aria-hidden="true">
      {rows.flatMap((row, y) =>
        [...row].map((c, x) => <circle key={`${x}-${y}`} cx={x * 10 + 5} cy={y * 10 + 5} r={c === '#' ? 4 : 2} fill={c === '#' ? color : dim} />),
      )}
    </svg>
  );
}

export function Glyph({ item, color = 'currentColor', dim, className }: { item: ItemId; color?: string; dim?: string; className?: string }) {
  return <DotGlyph rows={GLYPHS[item]} color={color} dim={dim} className={className} />;
}

export function Shape({ id, className, color, dim }: { id: ShapeId; className?: string; color?: string; dim?: string }) {
  return <DotGlyph rows={SHAPES[id]} className={className} color={color} dim={dim} />;
}
