// Turns raw responses into normalized values. Every scale maps to [-1, 1]; options carry their
// authored `value`; multi-select picks map to 0..1 intensity.
import type { Response } from '../model/answers.ts';
import type { Item, Option } from '../model/content.ts';
import { scalePoints } from '../model/content.ts';

export type Resolved =
  | { kind: 'scale'; v: number; step: number }
  | { kind: 'option'; option: string; v?: number; strength?: 1 | 2 }
  | { kind: 'multi'; picks: ReadonlyMap<string, number> };

/** Step k (1-based) on an n-point scale → [-1, 1]. 7-point: 1→-1, 4→0, 7→1. */
export function stepValue(step: number, points: number): number {
  const mid = (points + 1) / 2;
  return (step - mid) / (mid - 1);
}

/** Nearest step for a normalized value. */
export function valueStep(v: number, points: number): number {
  const mid = (points + 1) / 2;
  return Math.min(points, Math.max(1, Math.round(v * (mid - 1) + mid)));
}

/** Pair items scale option positions: "slightly" = half, "strongly" = full. */
export function strengthFactor(strength: 1 | 2 | undefined): number {
  return strength === 1 ? 0.5 : 1;
}

/**
 * Interprets a response for an item.
 * Returns null for skip / unsure / declined, 'invalid' if the response doesn't fit the item
 * (e.g. an option that no longer exists after a content update).
 */
export function resolve(item: Item, r: Response): Resolved | null | 'invalid' {
  if (r.kind === 'skip' || r.kind === 'unsure' || r.kind === 'declined') {
    return item.type === 'reask' ? 'invalid' : null;
  }
  switch (item.type) {
    case 'likert':
    case 'slider':
    case 'rating':
    case 'importance': {
      if (r.kind !== 'scale') return 'invalid';
      const n = scalePoints(item);
      if (!Number.isInteger(r.step) || r.step < 1 || r.step > n) return 'invalid';
      return { kind: 'scale', v: stepValue(r.step, n), step: r.step };
    }
    case 'choice':
    case 'challenge': {
      if (r.kind !== 'option') return 'invalid';
      const opt = findOption(item.options, r.option);
      if (!opt) return 'invalid';
      return opt.value === undefined ? { kind: 'option', option: opt.id } : { kind: 'option', option: opt.id, v: opt.value };
    }
    case 'pair': {
      if (r.kind !== 'option') return 'invalid';
      const opt = findOption(item.options, r.option);
      if (!opt) return 'invalid';
      const strength = item.strength ? (r.strength ?? 2) : undefined;
      const out: Resolved = { kind: 'option', option: opt.id };
      if (strength !== undefined) out.strength = strength;
      if (opt.value !== undefined) out.v = opt.value * strengthFactor(strength);
      return out;
    }
    case 'multi': {
      if (r.kind !== 'multi') return 'invalid';
      const picks = new Map<string, number>();
      for (const [id, val] of Object.entries(r.picks)) {
        if (!item.options.some((o) => o.id === id)) return 'invalid';
        picks.set(id, val === true ? 1 : val / 5);
      }
      if (item.max !== undefined && picks.size > item.max) return 'invalid';
      return { kind: 'multi', picks };
    }
    case 'reask':
      return 'invalid';
  }
}

function findOption(options: readonly Option[], id: string): Option | undefined {
  return options.find((o) => o.id === id);
}

/** All values an item could take when answered (used by the static reachability checker). */
export function valueDomain(item: Item, multiTags: readonly string[] = []): Resolved[] {
  switch (item.type) {
    case 'likert':
    case 'slider':
    case 'rating':
    case 'importance': {
      const n = scalePoints(item);
      return Array.from({ length: n }, (_, i) => ({ kind: 'scale', v: stepValue(i + 1, n), step: i + 1 }));
    }
    case 'choice':
    case 'challenge':
      return item.options.map((o) =>
        o.value === undefined ? { kind: 'option', option: o.id } : { kind: 'option', option: o.id, v: o.value },
      );
    case 'pair': {
      const strengths: (1 | 2 | undefined)[] = item.strength ? [1, 2] : [undefined];
      return item.options.flatMap((o) =>
        strengths.map((s) => {
          const out: Resolved = { kind: 'option', option: o.id };
          if (s !== undefined) out.strength = s;
          if (o.value !== undefined) out.v = o.value * strengthFactor(s);
          return out;
        }),
      );
    }
    case 'multi': {
      const tags = multiTags.slice(0, 10);
      const out: Resolved[] = [];
      for (let mask = 0; mask < 1 << tags.length; mask++) {
        const picks = new Map<string, number>();
        tags.forEach((t, i) => {
          if (mask & (1 << i)) picks.set(t, 1);
        });
        out.push({ kind: 'multi', picks });
      }
      return out;
    }
    case 'reask':
      return [];
  }
}

/** Numeric value of a resolved answer, if it has one (scale value or option position). */
export function numericValue(r: Resolved): number | undefined {
  if (r.kind === 'scale') return r.v;
  if (r.kind === 'option') return r.v;
  return undefined;
}
