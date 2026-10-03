import { describe, expect, it } from 'vitest';
import { fixtureBundle, realBundle } from '../../tests/helpers.ts';
import { splitBundle, withTopics } from './bundle-split.ts';

describe('splitting the bundle by domain', () => {
  it('leaves only topic entries in the index', () => {
    const { index, domains } = splitBundle(realBundle());
    expect(index.topics.every((t) => t.items.length === 0)).toBe(true);
    expect(index.topics.map((t) => t.id)).toEqual(realBundle().topics.map((t) => t.id));
    expect(Object.keys(domains)).toEqual([...new Set(realBundle().topics.map((t) => t.domain))]);
  });

  it('merges back into the original bundle, whatever order the domains load in', () => {
    for (const b of [fixtureBundle(), realBundle()]) {
      const { index, domains } = splitBundle(b);
      const merged = Object.values(domains)
        .reverse()
        .reduce((acc, topics) => withTopics(acc, topics), index);
      expect(merged).toEqual(b);
    }
  });

  it('fills in only the domains that loaded', () => {
    const b = realBundle();
    const { index, domains } = splitBundle(b);
    const merged = withTopics(index, domains['environment']!);
    for (const t of merged.topics) expect(t.items.length > 0).toBe(t.domain === 'environment');
    expect(merged.axes).toBe(index.axes);
  });
});
