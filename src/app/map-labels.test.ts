import { describe, expect, it } from 'vitest';
import { HIDE, labelLines, layoutMap, lengthInside, overlap, placeLabels, POLE_SIZE, px, py, textBox, type Box, type MapRefInput, type Measure } from './map-labels.ts';

const frame: Box = { x: 12, y: 12, w: 276, h: 276 };

describe('labels on the political map', () => {
  it('puts a label to the right of its marker when there is room', () => {
    const [p] = placeLabels([{ id: 'a', name: 'Centrism', cx: 100, cy: 150 }], frame, []);
    expect(p).toMatchObject({ anchor: 'start', lines: ['Centrism'] });
    expect(p!.box.x).toBeGreaterThan(100);
  });

  it('moves to the left near the right edge, and below near the top', () => {
    const [right] = placeLabels([{ id: 'a', name: 'Libertarianism', cx: 270, cy: 150 }], frame, []);
    expect(right!.anchor).toBe('end');
    const [top] = placeLabels([{ id: 'a', name: 'A long tradition name here', cx: 150, cy: 20 }], frame, [
      { x: 150 - 30, y: 0, w: 1, h: 1 },
    ]);
    expect(top!.box.y + top!.box.h).toBeLessThanOrEqual(frame.y + frame.h);
    expect(top!.box.y).toBeGreaterThanOrEqual(frame.y);
  });

  it("keeps clear of the user's dot", () => {
    const you: Box = { x: 112, y: 132, w: 36, h: 36 };
    const [p] = placeLabels([{ id: 'a', name: 'Social democracy', cx: 100, cy: 150 }], frame, [you]);
    expect(p!.anchor).toBe('end');
    expect(overlap(p!.box, you)).toBe(0);
  });

  it('keeps clear of labels already placed', () => {
    const [a, b] = placeLabels(
      [
        { id: 'a', name: 'Social democracy', cx: 100, cy: 150 },
        { id: 'b', name: 'Green politics', cx: 100, cy: 160 },
      ],
      frame,
      [],
    );
    expect(overlap(a!.box, b!.box)).toBe(0);
  });

  it('covers as little as it can when no spot is clear', () => {
    const you: Box = { x: 112, y: 132, w: 36, h: 36 };
    const placed = placeLabels(
      [
        { id: 'a', name: 'Social democracy', cx: 100, cy: 150 },
        { id: 'b', name: 'Green politics', cx: 104, cy: 160 },
      ],
      frame,
      [you],
    );
    // To its right, "Green politics" would cover a strip 13 units tall across the dot.
    expect(overlap(placed[1]!.box, you)).toBeLessThan(36 * 13);
    expect(overlap(placed[0]!.box, placed[1]!.box)).toBe(0);
  });

  it('wraps long names at the space nearest the middle', () => {
    expect(labelLines('Centrism')).toEqual(['Centrism']);
    expect(labelLines('Traditional conservatism')).toEqual(['Traditional', 'conservatism']);
    expect(labelLines('Left communitarianism')).toEqual(['Left', 'communitarianism']);
  });

  it('joins a label to its marker with a leader when the spots next to it are taken', () => {
    const halo: Box = { x: 130, y: 130, w: 40, h: 40 };
    const [p] = placeLabels([{ id: 'a', name: 'Centrism', cx: 150, cy: 150 }], frame, [halo]);
    expect(p!.leader).not.toBeNull();
    expect(overlap(p!.box, halo)).toBe(0);
    expect(p!.leader!.x1).toBeGreaterThan(150);
  });

  it('leaves off a label that would hide something, unless the summary names it', () => {
    const everywhere = [{ x: 0, y: 0, w: 300, h: 300, weight: HIDE }];
    expect(placeLabels([{ id: 'a', name: 'Centrism', cx: 150, cy: 150, optional: true }], frame, everywhere)).toEqual([]);
    expect(placeLabels([{ id: 'a', name: 'Centrism', cx: 150, cy: 150 }], frame, everywhere)).toHaveLength(1);
  });

  it('measures a leader against what it crosses', () => {
    expect(lengthInside({ x1: 0, y1: 5, x2: 20, y2: 5 }, { x: 5, y: 0, w: 10, h: 10 })).toBeCloseTo(10);
    expect(lengthInside({ x1: 0, y1: 20, x2: 20, y2: 20 }, { x: 5, y: 0, w: 10, h: 10 })).toBe(0);
    expect(lengthInside({ x1: 0, y1: 0, x2: 10, y2: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBeCloseTo(Math.hypot(5, 5));
  });
});

describe('the political map', () => {
  const poles = { x: ['Equality', 'Markets'], y: ['Liberty', 'Authority'] } as const;
  const marker = (r: { x: number; y: number }): Box => ({ x: px(r.x) - 5, y: py(r.y) - 5, w: 10, h: 10 });
  /** A wide font, like the one Chromium renders on Linux: labels about 15% longer than the estimate. */
  const wide: Measure = (text, size) => text.length * 7.3 * (size / 11);
  const ref = (id: string, x: number, y: number, rank: number | null = null, named = false): MapRefInput => ({ id, name: id, x, y, rank, named });

  it('puts the pole labels on the side of their axis that covers nothing', () => {
    // The dot is above the horizontal axis, so its pole labels go below, unless markers sit there.
    expect(layoutMap({ x: 0.5, y: 0.5 }, poles, []).poles.map((p) => p.y)).toEqual([32, 278, py(0) + 18, py(0) + 18]);
    const crowded = [ref('a', -0.8, -0.1), ref('b', -0.75, -0.1)];
    const { poles: placed } = layoutMap({ x: 0.5, y: 0.5 }, poles, crowded);
    expect(placed.filter((p) => p.text === 'Equality' || p.text === 'Markets').map((p) => p.y)).toEqual([py(0) - 8, py(0) - 8]);
  });

  it('labels the nearest tradition first', () => {
    const refs = [ref('second', 0.05, 0, 1), ref('first', 0.1, 0, 0), ref('unlisted', 0.5, 0.5)];
    expect(layoutMap({ x: -0.5, y: -0.5 }, poles, refs).labels.map((l) => l.id)).toEqual(['first', 'second']);
  });

  it("labels the religious conservative's map without hiding a mark, a pole label or another label", () => {
    // Its dot and the eleven traditions when this was written; the summary names the first two.
    const you = { x: 0.42, y: 0.27 };
    const refs: MapRefInput[] = [
      ['democratic_socialist', 'Democratic socialism', -0.8, -0.1],
      ['green', 'Green politics', -0.75, -0.1],
      ['social_democrat', 'Social democracy', -0.45, 0.15],
      ['social_liberal', 'Social liberalism', -0.3, -0.15],
      ['left_communitarian', 'Left communitarianism', -0.4, 0.1],
      ['centrist', 'Centrism', -0.1, 0.15],
      ['communitarian', 'Communitarianism', -0.15, 0.3],
      ['classical_liberal', 'Classical liberalism', 0.6, -0.45],
      ['libertarian', 'Libertarianism', 0.95, -0.75],
      ['traditional_conservative', 'Traditional conservatism', 0.35, 0.2],
      ['national_conservative', 'National conservatism', 0.25, 0.25],
    ].map(([id, name, x, y]) => {
      const rank = ['national_conservative', 'traditional_conservative', 'communitarian'].indexOf(id as string);
      return { id: id as string, name: name as string, x: x as number, y: y as number, rank: rank < 0 ? null : rank, named: rank === 0 || rank === 1 };
    });
    for (const measure of [undefined, wide]) {
      const { poles: placedPoles, labels } = layoutMap(you, poles, refs, measure);
      expect(labels.map((l) => l.id).slice(0, 2)).toEqual(['national_conservative', 'traditional_conservative']);
      const marks = [...refs.map(marker), { x: px(you.x) - 10, y: py(you.y) - 10, w: 20, h: 20 }];
      const poleBoxes = placedPoles.map((p) => textBox(p.text, p.x, p.y, p.anchor, measure, POLE_SIZE));
      for (const l of labels) {
        for (const m of [...marks, ...poleBoxes]) expect(overlap(l.box, m)).toBe(0);
        for (const o of labels) if (o !== l) expect(overlap(l.box, o.box)).toBe(0);
        if (l.leader) for (const o of [...labels.filter((x) => x !== l).map((x) => x.box), ...marks]) expect(lengthInside(l.leader, o)).toBe(0);
      }
      // A pole label may clip the corner of a marker's box, never the marker.
      for (const b of poleBoxes) for (const m of marks) expect(overlap(b, m)).toBeLessThan(10);
    }
  });
});
