// Answers → weighted observations on axes and principles.
import type { ItemId, Target, TopicId } from '../model/content.ts';
import { strengthFactor } from './normalize.ts';
import type { AnswerState } from './state.ts';

export interface Observation {
  target: Target;
  /** Position in [-1, 1]. */
  x: number;
  /** Weight (> 0). */
  w: number;
  item: ItemId;
  topic: TopicId;
  /** True for an anchor item's observation on its own principle. */
  anchor: boolean;
  event: string;
}

export interface ObserveOptions {
  includeSensitive: boolean;
}

const clamp = (x: number) => Math.max(-1, Math.min(1, x));

/** Whether an answered item's answer counts right now. */
export function counts(s: AnswerState, itemId: ItemId, opts: ObserveOptions): boolean {
  const item = s.ix.items.get(itemId);
  if (!item || !s.values.has(itemId)) return false;
  if (item.sensitive && !opts.includeSensitive) return false;
  // Hidden answers go dormant, except sticky items (challenges): their condition decided
  // when to ask, not whether the answer still applies.
  return s.visible.get(itemId) === true || item.sticky;
}

export function observe(s: AnswerState, opts: ObserveOptions): Observation[] {
  const out: Observation[] = [];
  for (const [itemId, r] of s.values) {
    if (!counts(s, itemId, opts)) continue;
    const item = s.ix.items.get(itemId)!;
    const event = s.latest.get(itemId)!.id;
    const push = (target: Target, x: number, w: number, anchor = false) => {
      if (w > 0) out.push({ target, x: clamp(x), w, item: itemId, topic: item.topic, anchor, event });
    };
    switch (item.type) {
      case 'likert':
      case 'slider':
      case 'rating': {
        if (r.kind !== 'scale') break;
        const anchorTarget = item.anchor ? `principle:${item.anchor.principle}` : null;
        for (const e of item.effects) push(e.target, Math.sign(e.w) * r.v, Math.abs(e.w), e.target === anchorTarget);
        break;
      }
      case 'choice':
      case 'challenge':
      case 'pair': {
        if (r.kind !== 'option') break;
        const opt = item.options.find((o) => o.id === r.option);
        if (!opt) break;
        const factor = item.type === 'pair' ? strengthFactor(r.strength) : 1;
        for (const e of opt.effects) push(e.target, e.v * factor, item.weight);
        if (item.type === 'choice' && opt.value !== undefined) {
          for (const e of item.effects) push(e.target, Math.sign(e.w) * opt.value, Math.abs(e.w));
        }
        break;
      }
      default:
        break;
    }
  }
  return out;
}
