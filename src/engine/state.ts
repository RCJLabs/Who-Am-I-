// Derives the current answer state from the event log. Stored events are never rewritten:
// events that no longer fit the content (unknown item, removed option, changed scale) become
// orphans, which are kept and exported but not scored, and their item is asked again.
import type { AnswerEvent } from '../model/answers.ts';
import type { Bundle, ItemId } from '../model/content.ts';
import { indexBundle, type BundleIndex } from './bundle-index.ts';
import { evalCond } from './cond/eval.ts';
import { resolve, type Resolved } from './normalize.ts';

export interface AnswerState {
  ix: BundleIndex;
  /** Valid events, ordered by id. */
  events: readonly AnswerEvent[];
  orphans: readonly AnswerEvent[];
  /** Latest valid event per item (any response kind). An item with an entry has been visited. */
  latest: ReadonlyMap<ItemId, AnswerEvent>;
  /** Value-bearing latest answers. */
  values: ReadonlyMap<ItemId, Resolved>;
  /** Valid events per item, in order. */
  history: ReadonlyMap<ItemId, readonly AnswerEvent[]>;
  /** Whether each item's condition is currently true, evaluated in authored order. */
  visible: ReadonlyMap<ItemId, boolean>;
  /** Values of currently visible items: what conditions see. */
  live: ReadonlyMap<ItemId, Resolved>;
}

export function byId(a: AnswerEvent, b: AnswerEvent): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function buildAnswerState(bundle: Bundle, raw: readonly AnswerEvent[]): AnswerState {
  const ix = indexBundle(bundle);
  const sorted = [...raw].sort(byId);

  const perItem = new Map<ItemId, AnswerEvent[]>();
  const orphans: AnswerEvent[] = [];
  for (const ev of sorted) {
    if (!ix.items.has(ev.item)) {
      orphans.push(ev);
      continue;
    }
    const list = perItem.get(ev.item);
    if (list) list.push(ev);
    else perItem.set(ev.item, [ev]);
  }

  const latest = new Map<ItemId, AnswerEvent>();
  const values = new Map<ItemId, Resolved>();
  const history = new Map<ItemId, AnswerEvent[]>();
  const valid = new Set<AnswerEvent>();
  for (const [itemId, list] of perItem) {
    const item = ix.items.get(itemId)!;
    const last = list[list.length - 1]!;
    // If the latest answer no longer fits, the item starts over: none of its answers count.
    if (resolve(item, last.r) === 'invalid') {
      orphans.push(...list);
      continue;
    }
    const ok: AnswerEvent[] = [];
    for (const ev of list) {
      if (resolve(item, ev.r) === 'invalid') orphans.push(ev);
      else ok.push(ev);
    }
    for (const ev of ok) valid.add(ev);
    history.set(itemId, ok);
    latest.set(itemId, last);
    const v = resolve(item, last.r);
    if (v && v !== 'invalid') values.set(itemId, v);
  }

  const visible = new Map<ItemId, boolean>();
  const live = new Map<ItemId, Resolved>();
  for (const topic of bundle.topics) {
    const lookup = (ref: string): Resolved | undefined =>
      ix.topicOf.get(ref) === topic ? live.get(ref) : values.get(ref);
    for (const item of topic.items) {
      const vis = evalCond(item.when, lookup) === true;
      visible.set(item.id, vis);
      const v = values.get(item.id);
      if (vis && v) live.set(item.id, v);
    }
  }

  return {
    ix,
    events: sorted.filter((e) => valid.has(e)),
    orphans: orphans.sort(byId),
    latest,
    values,
    history,
    visible,
    live,
  };
}
