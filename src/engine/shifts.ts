// How answers moved under challenge: the "the violinist moved you 2 steps" data.
import type { AnswerEvent } from '../model/answers.ts';
import type { ItemId, Topic } from '../model/content.ts';
import { isScale } from '../model/content.ts';
import { numericValue, resolve } from './normalize.ts';
import type { AnswerState } from './state.ts';

export interface Move {
  item: ItemId;
  /** Challenge, reask item or tension key that prompted the change. */
  source: string;
  via: 'challenge' | 'reask' | 'tension';
  delta: number;
  /** Change in scale steps, for scale items. */
  steps: number | null;
}

interface Point {
  ev: AnswerEvent;
  v: number;
  step: number | null;
}

function points(s: AnswerState, itemId: ItemId): Point[] {
  const item = s.ix.items.get(itemId);
  if (!item) return [];
  const out: Point[] = [];
  for (const ev of s.history.get(itemId) ?? []) {
    const r = resolve(item, ev.r);
    if (!r || r === 'invalid') continue;
    const v = numericValue(r);
    if (v === undefined) continue;
    out.push({ ev, v, step: isScale(item) && r.kind === 'scale' ? r.step : null });
  }
  return out;
}

export function itemHistory(s: AnswerState, itemId: ItemId): { initial: number | null; current: number | null; moves: Move[] } {
  const pts = points(s, itemId);
  const moves: Move[] = [];
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]!;
    const cur = pts[i]!;
    const via = cur.ev.via;
    if (!via || via.kind === 'manual') continue;
    moves.push({
      item: itemId,
      source: via.source,
      via: via.kind,
      delta: cur.v - prev.v,
      steps: cur.step !== null && prev.step !== null ? cur.step - prev.step : null,
    });
  }
  return { initial: pts[0]?.v ?? null, current: pts.at(-1)?.v ?? null, moves };
}

export interface ChallengeSummary {
  asked: number;
  held: number;
  distinguished: number;
  moved: number;
  /** Non-zero moves in this topic, in order. */
  moves: Move[];
}

export function challengeSummary(s: AnswerState, topic: Topic): ChallengeSummary {
  const moves = topic.items.flatMap((it) => itemHistory(s, it.id).moves);
  const out: ChallengeSummary = { asked: 0, held: 0, distinguished: 0, moved: 0, moves: moves.filter((m) => m.delta !== 0) };
  for (const it of topic.items) {
    if (it.type !== 'challenge') continue;
    const r = s.values.get(it.id);
    if (!r || r.kind !== 'option') continue;
    out.asked++;
    const reaction = it.options.find((o) => o.id === r.option)?.reaction;
    if (moves.some((m) => m.via === 'challenge' && m.source === it.id && m.delta !== 0)) out.moved++;
    else if (reaction === 'distinguish') out.distinguished++;
    else out.held++;
  }
  return out;
}
