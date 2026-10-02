import { describe, expect, it } from 'vitest';
import { fixtureBundle } from '../helpers.ts';
import { runRespondent } from './harness.ts';
import { randomPolicy } from './policies.ts';

describe('flow properties (random respondents on fixtures)', () => {
  const b = fixtureBundle();

  it('always terminates, never asks an item twice, and only re-asks revisable items', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const { transcript } = runRespondent(b, randomPolicy({ skipRate: 0.15 }), { seed });
      const asked = transcript.filter((t) => t.kind === 'item').map((t) => t.item);
      expect(new Set(asked).size, `seed ${seed}`).toBe(asked.length);
      for (const t of transcript.filter((t) => t.kind === 'reask')) {
        const type = b.topics.flatMap((x) => x.items).find((i) => i.id === t.item)!.type;
        expect(['likert', 'slider', 'rating', 'choice', 'pair']).toContain(type);
      }
    }
  });

  it('reaches every challenge at least once across random runs', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      for (const t of runRespondent(b, randomPolicy(), { seed }).transcript) if (t.item) seen.add(t.item);
    }
    const challenges = b.topics.flatMap((t) => t.items).filter((i) => i.type === 'challenge').map((i) => i.id);
    expect(challenges.filter((c) => !seen.has(c))).toEqual([]);
  });
});
