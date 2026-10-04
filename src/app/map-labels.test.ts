import { describe, expect, it } from 'vitest';
import { labelLines, overlap, placeLabels, type Box } from './map-labels.ts';

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
});
