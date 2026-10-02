// E007 unreachable items · E008 challenge symmetry · W103 unproven · W104 no middle challenge
import type { Item, ScaleItem } from '../../model/content.ts';
import { isScale } from '../../model/content.ts';
import { EPS } from '../../engine/cond/eval.ts';
import { condRefs, hasTags } from '../../engine/cond/parse.ts';
import { satisfiable, type SatItem, type SatResult } from '../../engine/cond/sat.ts';
import { numericValue, valueDomain, type Resolved } from '../../engine/normalize.ts';
import { itemLoc, topicLoc, type RuleCtx } from '../context.ts';

export function reachRules(ctx: RuleCtx): void {
  const { rep, byId } = ctx;

  // Option ids tested with `has`, per multi-select item, across all conditions.
  const tags = new Map<string, Set<string>>();
  for (const ct of ctx.topics) {
    for (const it of ct.topic.items) {
      for (const ref of condRefs(it.when)) {
        for (const t of hasTags(it.when, ref)) {
          if (!tags.has(ref)) tags.set(ref, new Set());
          tags.get(ref)!.add(t);
        }
      }
    }
  }
  const domainOf = (item: Item): Resolved[] => valueDomain(item, [...(tags.get(item.id) ?? [])]);

  for (const ct of ctx.topics) {
    const { topic } = ct;
    const items = new Map<string, SatItem>();
    topic.items.forEach((it, order) => {
      if (it.type === 'reask') return;
      items.set(it.id, it.when ? { id: it.id, when: it.when, domain: domainOf(it), order } : { id: it.id, domain: domainOf(it), order });
    });
    for (const it of topic.items) {
      for (const ref of condRefs(it.when)) {
        const other = byId.get(ref);
        if (!items.has(ref) && other) items.set(ref, { id: ref, domain: domainOf(other.item), order: -1 });
      }
    }

    for (const it of topic.items) {
      if (!it.when) continue;
      const res = satisfiable(it.when, items);
      if (res === 'unsat') {
        rep.report('E007', `'${it.key}' can never be shown: its condition can't be true for any answers`, itemLoc(ct, it.key, 'when'));
      } else if (res === 'unknown') {
        rep.report('W103', `Couldn't prove '${it.key}' is reachable (too many answer combinations); it was sampled`, itemLoc(ct, it.key, 'when'));
      }
    }

    if (!topic.stance) continue;
    const stance = byId.get(topic.stance)!.item;
    if (!isScale(stance)) continue;

    const dom = valueDomain(stance);
    const side = (pred: (v: number) => boolean) => dom.filter((r) => pred(numericValue(r)!));
    const deepNone = topic.items.filter((i) => i.deep).map((i): [string, Resolved[]] => [i.id, []]);
    const challenges = topic.items.filter((i) => i.type === 'challenge' && !i.deep);

    const reachable = (values: Resolved[]): SatResult => {
      const fix = new Map<string, readonly Resolved[]>([...deepNone, [stance.id, values]]);
      let unknown = false;
      for (const ch of challenges) {
        const r = satisfiable(ch.when, items, { fix });
        if (r === 'sat') return 'sat';
        if (r === 'unknown') unknown = true;
      }
      return unknown ? 'unknown' : 'unsat';
    };

    const [neg, pos] = poleNames(stance);
    const sides: [string, Resolved[]][] = [
      [neg, side((v) => v < -EPS)],
      [pos, side((v) => v > EPS)],
    ];
    for (const [name, values] of sides) {
      const r = reachable(values);
      if (r === 'unsat') {
        rep.report(
          'E008',
          `No challenge reaches users on the "${name}" side of '${stance.key}'. Every stance needs a challenge aimed at it, even when deep items are skipped.`,
          topicLoc(ct, 'stance'),
        );
      } else if (r === 'unknown') {
        rep.report('W103', `Couldn't prove a challenge reaches the "${name}" side of '${stance.key}'`, topicLoc(ct, 'stance'));
      }
    }
    const middle = side((v) => Math.abs(v) <= EPS);
    if (middle.length && reachable(middle) === 'unsat') {
      rep.report('W104', `No challenge for users in the middle of '${stance.key}'`, topicLoc(ct, 'stance'));
    }
  }
}

function poleNames(item: ScaleItem): [string, string] {
  if (item.type === 'slider' || item.type === 'rating') return item.poles;
  if (item.type === 'likert') return ['disagree', 'agree'];
  return ['low', 'high'];
}
