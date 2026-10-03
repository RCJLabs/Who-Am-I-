// The bundle ships in pieces: an index (every topic without its items) in the entry chunk, and
// each domain's topics in a chunk of their own, loaded when needed. Splitting happens at build
// time; merging happens in the app as domains load.
import type { Bundle, Topic } from '../model/content.ts';

export interface SplitBundle {
  /** The bundle with every topic's items left out. */
  index: Bundle;
  /** Each domain's full topics, in bundle order. Domains without topics are absent. */
  domains: Record<string, Topic[]>;
}

export function splitBundle(b: Bundle): SplitBundle {
  const domains: Record<string, Topic[]> = {};
  for (const t of b.topics) (domains[t.domain] ??= []).push(t);
  return { index: { ...b, topics: b.topics.map((t) => ({ ...t, items: [] })) }, domains };
}

/** The bundle with these full topics in place of their entries, keeping the bundle's order. */
export function withTopics(b: Bundle, topics: readonly Topic[]): Bundle {
  const byId = new Map(topics.map((t) => [t.id, t]));
  return { ...b, topics: b.topics.map((t) => byId.get(t.id) ?? t) };
}
