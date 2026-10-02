import type { Bundle, Item, ItemId, Topic, TopicId } from '../model/content.ts';

export interface BundleIndex {
  bundle: Bundle;
  items: ReadonlyMap<ItemId, Item>;
  topics: ReadonlyMap<TopicId, Topic>;
  topicOf: ReadonlyMap<ItemId, Topic>;
  /** Index of each item within its topic. */
  position: ReadonlyMap<ItemId, number>;
}

const cache = new WeakMap<Bundle, BundleIndex>();

export function indexBundle(bundle: Bundle): BundleIndex {
  const hit = cache.get(bundle);
  if (hit) return hit;
  const items = new Map<ItemId, Item>();
  const topics = new Map<TopicId, Topic>();
  const topicOf = new Map<ItemId, Topic>();
  const position = new Map<ItemId, number>();
  for (const t of bundle.topics) {
    topics.set(t.id, t);
    t.items.forEach((it, i) => {
      items.set(it.id, it);
      topicOf.set(it.id, t);
      position.set(it.id, i);
    });
  }
  const ix: BundleIndex = { bundle, items, topics, topicOf, position };
  cache.set(bundle, ix);
  return ix;
}
