// E009 challenge contract · E010 stance/importance · E011 option values · E012 sensitivity ·
// E013 anchor keying · W109 anchor cross-load · E007 reask that can never run
import { itemLoc, REVISABLE, topicLoc, type RuleCtx } from '../context.ts';

export function structureRules(ctx: RuleCtx): void {
  const { rep, byId } = ctx;
  for (const ct of ctx.topics) {
    const { topic } = ct;
    const challenges = topic.items.flatMap((i) => (i.type === 'challenge' ? [i] : []));

    // E010: stance and importance
    if (challenges.length && !topic.stance && !ct.tc.tf.stance) {
      rep.report('E010', `Topics with challenges must declare a stance item (stance: <item id>)`, topicLoc(ct, 'id'));
    }
    if (topic.stance) {
      const s = byId.get(topic.stance)!.item;
      if (s.type !== 'likert' && s.type !== 'slider') {
        rep.report('E010', `The stance must be a likert or slider item; '${s.key}' is ${s.type}`, topicLoc(ct, 'stance'));
      }
      if (s.when) rep.report('E010', `The stance item is always asked: remove its condition`, itemLoc(ct, s.key, 'when'));
      if (s.deep) rep.report('E010', `The stance item can't be deep`, itemLoc(ct, s.key, 'deep'));
    }
    const importanceItems = topic.items.filter((i) => i.type === 'importance');
    if (importanceItems.length > 1) {
      rep.report('E010', `Only one importance item per topic`, itemLoc(ct, importanceItems[1]!.key, 'type'));
    }
    const first = importanceItems[0];
    if (first && topic.importance !== first.id) {
      rep.report('E010', `Declare the importance item on the topic: importance: ${first.key}`, itemLoc(ct, first.key, 'type'));
    }
    if (topic.importance) {
      const imp = byId.get(topic.importance)!.item;
      if (imp.type !== 'importance') {
        rep.report('E010', `importance must point to an importance item; '${imp.key}' is ${imp.type}`, topicLoc(ct, 'importance'));
      }
      if (imp.when) rep.report('E010', `The importance item is always asked: remove its condition`, itemLoc(ct, imp.key, 'when'));
      if (imp.deep) rep.report('E010', `The importance item can't be deep`, itemLoc(ct, imp.key, 'deep'));
      const impIdx = topic.items.indexOf(imp);
      const early = topic.items.find((it, i) => it.deep && i < impIdx);
      if (early) rep.report('E010', `Deep item '${early.key}' must come after the importance item`, itemLoc(ct, early.key, 'deep'));
    } else {
      const deep = topic.items.find((i) => i.deep);
      if (deep) {
        rep.report('E010', `Deep items need an importance item in the topic (it decides when they're skipped)`, itemLoc(ct, deep.key, 'deep'));
      }
    }

    // E009: challenge contract
    for (const ch of challenges) {
      const target = byId.get(ch.targets)?.item;
      if (target && !REVISABLE.has(target.type)) {
        rep.report('E009', `A challenge must target a likert, slider, rating, choice or pair item; '${target.key}' is ${target.type}`, itemLoc(ct, ch.key, 'targets'));
      }
      if (!ch.options.some((o) => o.reaction !== 'yield')) {
        rep.report('E009', `Needs an option that lets the user keep their view (reaction: hold or distinguish)`, itemLoc(ct, ch.key, 'options'));
      }
      if (!ch.options.some((o) => o.reaction === 'yield' && o.revise)) {
        rep.report('E009', `Needs a 'yield' option with 'revise', so reconsidering leads somewhere`, itemLoc(ct, ch.key, 'options'));
      }
      ch.options.forEach((o, j) => {
        if (!o.revise) return;
        const t = byId.get(o.revise)?.item;
        if (t && !REVISABLE.has(t.type)) {
          rep.report('E009', `revise must point to a likert, slider, rating, choice or pair item; '${t.key}' is ${t.type}`, itemLoc(ct, ch.key, 'options', j, 'revise'));
        }
      });
    }

    for (const it of topic.items) {
      // Reask items: revisable target, and something must be able to make them due.
      if (it.type === 'reask') {
        const t = byId.get(it.target)?.item;
        if (t && !REVISABLE.has(t.type)) {
          rep.report('E009', `A reask must target a likert, slider, rating, choice or pair item; '${t.key}' is ${t.type}`, itemLoc(ct, it.key, 'target'));
        }
        if (!challenges.some((c) => c.targets === it.target)) {
          rep.report('E007', `Reask '${it.key}' can never run: no challenge in this topic targets '${t?.key ?? it.target}'`, itemLoc(ct, it.key, 'target'));
        }
      }

      // E011: item-level effects on a choice use option values
      if (it.type === 'choice' && it.effects.length) {
        it.options.forEach((o, j) => {
          if (o.value === undefined) {
            rep.report('E011', `This item has item-level effects, which use option values: give option '${o.id}' a value`, itemLoc(ct, it.key, 'options', j));
          }
        });
      }

      // E012: identity items describe, they don't score
      if (topic.domain === 'identity') {
        const scores =
          ('effects' in it && it.effects.length > 0) ||
          ('options' in it && it.options.some((o) => ((o as { effects?: readonly unknown[] }).effects?.length ?? 0) > 0));
        if (scores) rep.report('E012', `Identity items are context only and can't carry effects`, itemLoc(ct, it.key, 'id'));
      }

      // E013 / W109: anchors
      if (it.anchor) {
        if (it.type !== 'likert' && it.type !== 'slider') {
          rep.report('E013', `Anchors must be likert or slider items`, itemLoc(ct, it.key, 'anchor'));
          continue;
        }
        const p = it.anchor.principle;
        const own = it.effects.find((e) => e.target === `principle:${p}`);
        if (!own || own.w <= 0) {
          rep.report('E013', `Anchor for '${p}' needs a positive weight on it (principles: { ${p}: 1 }), so agreeing always means endorsing the principle`, itemLoc(ct, it.key, 'anchor', 'principle'));
        }
        for (const e of it.effects) {
          if (e.target.startsWith('principle:') && e.target !== `principle:${p}` && Math.abs(e.w) > 0.5) {
            const name = e.target.slice('principle:'.length);
            rep.report('W109', `Anchor also loads ${e.w} on '${name}'; anchors should probe one principle`, itemLoc(ct, it.key, 'principles', name));
          }
        }
      }
    }
  }
}
