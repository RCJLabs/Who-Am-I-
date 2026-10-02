// W101 keying balance · W105 challenge source · W106 option effects · W107 unused / single-anchor ·
// W108 loaded terms
import type { Path } from '../yaml.ts';
import { itemLoc, topicLoc, type RuleCtx } from '../context.ts';

export function qualityRules(ctx: RuleCtx): void {
  const { rep, env } = ctx;

  // W101: on agree/disagree items, habitual agreement shouldn't push an axis one way.
  const balance = new Map<string, { pos: number; neg: number }>();
  for (const ct of ctx.topics) {
    if (ct.topic.evidence === 'validated') continue;
    for (const ai of ct.tc.tf.items) {
      if (ai.type !== 'likert' || (ai.labels !== undefined && ai.labels !== 'agree')) continue;
      for (const [axis, w] of Object.entries(ai.axes ?? {})) {
        const b = balance.get(axis) ?? { pos: 0, neg: 0 };
        if (w > 0) b.pos += w;
        else b.neg -= w;
        balance.set(axis, b);
      }
    }
  }
  const axisIndex = new Map([...env.axes.keys()].map((id, i) => [id, i]));
  for (const [axis, b] of balance) {
    const total = b.pos + b.neg;
    if (total >= 3 && Math.abs(b.pos - b.neg) / total > 0.5) {
      rep.report(
        'W101',
        `Axis '${axis}': agree/disagree items carry ${round(b.pos)} weight keyed one way and ${round(b.neg)} the other. Balance them so habitual agreement doesn't push scores.`,
        { pf: env.axesFile, path: [axisIndex.get(axis) ?? 0, 'id'] },
      );
    }
  }

  // W105 / W106 and usage tracking for W107.
  const usedAxes = new Set<string>();
  const usedPrinciples = new Set<string>();
  const anchoredTopics = new Map<string, Set<string>>();
  const firstAnchor = new Map<string, { ct: (typeof ctx.topics)[number]; key: string }>();
  for (const ct of ctx.topics) {
    for (const it of ct.topic.items) {
      const targets: string[] = [];
      if ('effects' in it) for (const e of it.effects) targets.push(e.target);
      if ('options' in it) for (const o of it.options) if ('effects' in o) for (const e of o.effects) targets.push(e.target);
      for (const t of targets) {
        if (t.startsWith('axis:')) usedAxes.add(t.slice(5));
        else usedPrinciples.add(t.slice(10));
      }
      if (it.anchor) {
        usedPrinciples.add(it.anchor.principle);
        if (!anchoredTopics.has(it.anchor.principle)) anchoredTopics.set(it.anchor.principle, new Set());
        anchoredTopics.get(it.anchor.principle)!.add(ct.topic.id);
        if (!firstAnchor.has(it.anchor.principle)) firstAnchor.set(it.anchor.principle, { ct, key: it.key });
      }
      if (it.type === 'challenge' && !it.source) {
        rep.report('W105', `Challenge '${it.key}' has no source. Cite the argument or thought experiment (or "Original scenario").`, itemLoc(ct, it.key, 'id'));
      }
      if (it.type === 'challenge' || it.type === 'pair') {
        it.options.forEach((o, j) => {
          if (o.effects.length === 0 && o.value === undefined) {
            rep.report('W106', `Option '${o.id}' has no effects, so choosing it records nothing`, itemLoc(ct, it.key, 'options', j));
          }
        });
      }
    }
  }

  // W107
  [...env.axes.values()].forEach((a, i) => {
    if (!usedAxes.has(a.id) && !a.planned) {
      rep.report('W107', `Axis '${a.id}' isn't used by any item (mark it planned: true if content is coming)`, { pf: env.axesFile, path: [i, 'id'] });
    }
  });
  [...env.principles.values()].forEach((p, i) => {
    if (!usedPrinciples.has(p.id)) {
      rep.report('W107', `Principle '${p.id}' isn't used by any item`, { pf: env.principlesFile, path: [i, 'id'] });
    }
  });
  for (const [p, topics] of anchoredTopics) {
    if (topics.size === 1) {
      const at = firstAnchor.get(p)!;
      rep.report('W107', `Principle '${p}' is anchored only in '${[...topics][0]}'; tensions need anchors in at least 2 topics`, itemLoc(at.ct, at.key, 'anchor', 'principle'));
    }
  }

  // W108: loaded terms in anything the user reads.
  const terms = env.loadedTerms.map((t) => ({ term: t, re: new RegExp(`(^|[^a-z0-9])${escapeRe(t)}($|[^a-z0-9])`, 'i') }));
  if (!terms.length) return;
  for (const ct of ctx.topics) {
    for (const [path, text] of userText(ct.tc.tf)) {
      for (const { term, re } of terms) {
        if (re.test(text)) rep.report('W108', `Loaded term "${term}": use neutral wording, or justify it (e.g. inside a quotation)`, topicLoc(ct, ...path));
      }
    }
  }
}

function* userText(tf: RuleCtx['topics'][number]['tc']['tf']): Generator<[Path, string]> {
  yield [['title'], tf.title];
  yield [['summary'], tf.summary];
  if (tf.instructions) yield [['instructions'], tf.instructions];
  for (const [i, it] of tf.items.entries()) {
    const at = (...p: (string | number)[]): Path => ['items', i, ...p];
    yield [at('text'), it.text];
    if (it.help) yield [at('help'), it.help];
    if (it.type === 'challenge') yield [at('scenario'), it.scenario];
    if ('poles' in it) for (const [k, s] of it.poles.entries()) yield [at('poles', k), s];
    if ('labels' in it && Array.isArray(it.labels)) for (const [k, s] of it.labels.entries()) yield [at('labels', k), s];
    if ('options' in it) for (const [k, o] of it.options.entries()) yield [at('options', k, 'label'), o.label];
    if ('anchor' in it && it.anchor) {
      yield [at('anchor', 'context'), it.anchor.context];
      if (it.anchor.against) yield [at('anchor', 'against'), it.anchor.against];
    }
  }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
