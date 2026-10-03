// Content compiler: YAML sources → validated, normalized Bundle (+ diagnostics with file/line).
// Node-only (uses node:crypto for the content hash).
import { createHash } from 'node:crypto';
import type { z } from 'zod';
import {
  AxesFileSchema,
  ConfigFileSchema,
  DomainsFileSchema,
  PrinciplesFileSchema,
  TopicFileSchema,
  type AuthoredItem,
} from '../model/authored.ts';
import type {
  Anchor,
  Axis,
  Bundle,
  ChallengeOption,
  Cond,
  Domain,
  Effect,
  Item,
  ItemBase,
  Option,
  OptionEffect,
  Principle,
  Topic,
} from '../model/content.ts';
import { COND_KEYWORDS, mapRefs, parseCond, type RefUse } from '../engine/cond/parse.ts';
import { Reporter, type CompiledTopic, type Env, type Loc, type TopicCtx } from './context.ts';
import { parseTerms } from './loaded-terms.ts';
import { runRules } from './rules/index.ts';
import type { ContentSources, Diagnostic } from './types.ts';
import { parseYaml, type ParsedFile, type Path } from './yaml.ts';

export interface CompileResult {
  bundle: Bundle | null;
  diagnostics: Diagnostic[];
}

const AGREE: Record<5 | 7, string[]> = {
  5: ['Strongly disagree', 'Disagree', 'Neither agree nor disagree', 'Agree', 'Strongly agree'],
  7: [
    'Strongly disagree',
    'Disagree',
    'Somewhat disagree',
    'Neither agree nor disagree',
    'Somewhat agree',
    'Agree',
    'Strongly agree',
  ],
};
const ACCURACY5 = [
  'Very inaccurate',
  'Moderately inaccurate',
  'Neither accurate nor inaccurate',
  'Moderately accurate',
  'Very accurate',
];
const IMPORTANCE = ['Not at all', 'A little', 'Quite a bit', 'A lot'];

function validate<T>(pf: ParsedFile, schema: z.ZodType<T>, rep: Reporter): T | null {
  const res = schema.safeParse(pf.data);
  if (res.success) return res.data;
  for (const issue of res.error.issues) {
    let path = issue.path.filter((p): p is string | number => typeof p !== 'symbol');
    let message = issue.message;
    if (issue.code === 'unrecognized_keys') {
      path = [...path, issue.keys[0]!];
      message = `Unknown key${issue.keys.length > 1 ? 's' : ''}: ${issue.keys.join(', ')}`;
    }
    const where = path.length ? `${path.join('.')}: ` : '';
    rep.report('E002', `${where}${message}`, { pf, path });
  }
  return null;
}

function checkUnique<T extends { id: string }>(list: readonly T[], what: string, pf: ParsedFile, base: Path, rep: Reporter): void {
  const seen = new Set<string>();
  list.forEach((x, i) => {
    if (seen.has(x.id)) rep.report('E003', `Duplicate ${what} id '${x.id}'`, { pf, path: [...base, i, 'id'] });
    seen.add(x.id);
  });
}

export function compile(src: ContentSources): CompileResult {
  const rep = new Reporter();
  const parsed = {
    config: parseYaml(src.config, rep.diagnostics),
    domains: parseYaml(src.domains, rep.diagnostics),
    axes: parseYaml(src.axes, rep.diagnostics),
    principles: parseYaml(src.principles, rep.diagnostics),
  };
  const config = parsed.config && validate(parsed.config, ConfigFileSchema, rep);
  const domains = parsed.domains && validate(parsed.domains, DomainsFileSchema, rep);
  const axes = parsed.axes && validate(parsed.axes, AxesFileSchema, rep);
  const principles = parsed.principles && validate(parsed.principles, PrinciplesFileSchema, rep);

  const topicCtxs: TopicCtx[] = [];
  for (const file of src.topics) {
    const pf = parseYaml(file, rep.diagnostics);
    if (!pf) continue;
    const tf = validate(pf, TopicFileSchema, rep);
    if (!tf) continue;
    const index = new Map<string, number>();
    tf.items.forEach((it, i) => {
      if (COND_KEYWORDS.has(it.id)) rep.report('E002', `'${it.id}' is a reserved word and can't be an item id`, { pf, path: ['items', i, 'id'] });
      if (index.has(it.id)) rep.report('E003', `Duplicate item id '${it.id}'`, { pf, path: ['items', i, 'id'] });
      else index.set(it.id, i);
    });
    topicCtxs.push({ pf, tf, index });
  }

  if (!config || !domains || !axes || !principles || !parsed.axes || !parsed.principles || !parsed.domains) {
    return { bundle: null, diagnostics: sortDiags(rep.diagnostics) };
  }

  checkUnique(domains, 'domain', parsed.domains, [], rep);
  checkUnique(axes, 'axis', parsed.axes, [], rep);
  checkUnique(principles, 'principle', parsed.principles, [], rep);
  axes.forEach((a, i) => {
    if (a.fullWeight < a.minWeight) rep.report('E002', `Axis '${a.id}': fullWeight must be ≥ minWeight`, { pf: parsed.axes!, path: [i, 'fullWeight'] });
  });

  const env: Env = {
    axes: new Map(axes.map((a) => [a.id, a])),
    principles: new Map(principles.map((p) => [p.id, p])),
    domains: new Map(domains.map((d) => [d.id, d])),
    config,
    axesFile: parsed.axes,
    principlesFile: parsed.principles,
    domainsFile: parsed.domains,
    loadedTerms: parseTerms(src.loadedTerms?.text ?? ''),
  };

  const byTopic = new Map<string, TopicCtx>();
  for (const tc of topicCtxs) {
    if (byTopic.has(tc.tf.id)) rep.report('E003', `Duplicate topic id '${tc.tf.id}'`, { pf: tc.pf, path: ['id'] });
    else byTopic.set(tc.tf.id, tc);
  }

  const compiled: CompiledTopic[] = [];
  for (const tc of byTopic.values()) {
    compiled.push({ topic: normalizeTopic(tc, byTopic, env, rep), tc });
  }

  runRules({ topics: compiled, env, rep });

  if (rep.errors > 0) return { bundle: null, diagnostics: sortDiags(rep.diagnostics) };

  const domainOrder = new Map(domains.map((d, i) => [d.id, i]));
  const order = new Map(compiled.map((c) => [c.topic.id, c.tc.tf.order ?? 0]));
  const topics = compiled
    .map((c) => c.topic)
    .sort(
      (a, b) =>
        domainOrder.get(a.domain)! - domainOrder.get(b.domain)! ||
        order.get(a.id)! - order.get(b.id)! ||
        a.id.localeCompare(b.id),
    );

  const body: Omit<Bundle, 'contentVersion'> = {
    format: 'whoami.content',
    schema: 1,
    domains: domains.map(
      (d): Domain => ({ id: d.id, title: d.title, blurb: d.blurb, sensitive: d.sensitive ?? false }),
    ),
    topics,
    axes: Object.fromEntries(
      axes.map((a): [string, Axis] => [
        a.id,
        {
          id: a.id,
          family: a.family,
          title: a.title,
          description: a.description,
          poles: a.poles,
          minWeight: a.minWeight,
          fullWeight: a.fullWeight,
          minTopics: a.minTopics ?? 1,
        },
      ]),
    ),
    principles: Object.fromEntries(
      principles.map((p): [string, Principle] => [p.id, { id: p.id, label: p.label, definition: p.definition }]),
    ),
    config,
  };
  const contentVersion = createHash('sha256').update(canonicalJson(body)).digest('hex').slice(0, 12);
  return { bundle: { ...body, contentVersion }, diagnostics: sortDiags(rep.diagnostics) };
}

function normalizeTopic(tc: TopicCtx, all: Map<string, TopicCtx>, env: Env, rep: Reporter): Topic {
  const { tf, pf } = tc;
  const domain = env.domains.get(tf.domain);
  if (!domain) rep.report('E004', `Unknown domain '${tf.domain}'`, { pf, path: ['domain'] });
  if (domain?.sensitive && tf.sensitive === false) {
    rep.report('E012', `Domain '${domain.id}' is sensitive; its topics can't opt out`, { pf, path: ['sensitive'] });
  }
  const sensitive = domain?.sensitive === true || tf.sensitive === true;

  for (const key of ['stance', 'importance'] as const) {
    const ref = tf[key];
    if (ref !== undefined && !tc.index.has(ref)) rep.report('E004', `${key}: no item '${ref}' in this topic`, { pf, path: [key] });
  }

  const q = (id: string): string => `${tf.id}.${id}`;
  const itemLoc = (i: number, ...sub: (string | number)[]): Loc => ({ pf, path: ['items', i, ...sub] });

  /** Resolve a ref written in item `from`. Same-topic refs must point to earlier items. */
  const resolveRef = (raw: string, from: number, loc: Loc, allowCross: boolean): string | null => {
    let topicId = tf.id;
    let local = raw;
    if (raw.includes('.')) [topicId, local] = raw.split('.') as [string, string];
    if (topicId !== tf.id) {
      const other = all.get(topicId);
      if (!other || !other.index.has(local)) {
        rep.report('E004', `Unknown item '${raw}'`, loc);
        return null;
      }
      if (!allowCross) {
        rep.report('E005', `'${raw}' must be an earlier item in this topic`, loc);
        return null;
      }
      rep.report('W102', `Cross-topic reference '${raw}': this item depends on another topic's answer`, loc);
      return raw;
    }
    const idx = tc.index.get(local);
    if (idx === undefined) {
      rep.report('E004', `No item '${local}' in topic '${tf.id}'`, loc);
      return null;
    }
    if (idx >= from) {
      rep.report('E005', `'${local}' must come before this item (references can only point to earlier items)`, loc);
      return null;
    }
    return q(local);
  };

  const authoredAt = (ref: string): AuthoredItem | undefined => {
    const [t, l] = ref.split('.') as [string, string];
    const ctx = all.get(t);
    const idx = ctx?.index.get(l);
    return idx === undefined ? undefined : ctx!.tf.items[idx];
  };

  const parseWhen = (src: string, from: number): Cond | undefined => {
    const loc = itemLoc(from, 'when');
    const parsed = parseCond(src);
    if (!parsed.ok) {
      rep.report('E006', `Condition: ${parsed.message}`, { ...loc, colOffset: parsed.col });
      return undefined;
    }
    const resolved = new Map<string, string>();
    let ok = true;
    for (const use of parsed.uses) {
      const id = resolveRef(use.ref, from, { ...loc, colOffset: use.col }, true);
      if (!id) {
        ok = false;
        continue;
      }
      resolved.set(use.ref, id);
      if (!typeCheckUse(use, authoredAt(id)!, { ...loc, colOffset: use.col }, { ...loc, colOffset: use.optionCol ?? use.col })) ok = false;
    }
    return ok ? mapRefs(parsed.cond, (r) => resolved.get(r)!) : undefined;
  };

  const typeCheckUse = (use: RefUse, target: AuthoredItem, loc: Loc, optLoc: Loc): boolean => {
    const name = use.ref;
    if (target.type === 'reask') {
      rep.report('E006', `'${name}' is a reask item and has no answer of its own`, loc);
      return false;
    }
    if (use.use === 'answered') return true;
    if (use.use === 'cmp') {
      if (target.type === 'multi') {
        rep.report('E006', `'${name}' is multi-select: use '${name} has <option>'`, loc);
        return false;
      }
      if ((target.type === 'choice' || target.type === 'pair' || target.type === 'challenge') && target.options.some((o) => o.value === undefined)) {
        rep.report('E006', `'${name}' options need a value to be compared with numbers (or use '${name} is <option>')`, loc);
        return false;
      }
      return true;
    }
    const wantMulti = use.use === 'has';
    const fits = wantMulti ? target.type === 'multi' : target.type === 'choice' || target.type === 'pair' || target.type === 'challenge';
    if (!fits) {
      rep.report('E006', wantMulti ? `'has' needs a multi-select item; '${name}' is ${target.type}` : `'is' needs a choice, pair or challenge item; '${name}' is ${target.type}`, loc);
      return false;
    }
    const options = (target as { options: { id: string }[] }).options;
    if (!options.some((o) => o.id === use.option)) {
      rep.report('E006', `'${name}' has no option '${use.option}'`, optLoc);
      return false;
    }
    return true;
  };

  const effects = (map: Record<string, number> | undefined, kind: 'axes' | 'principles', loc: Loc): Effect[] => {
    const out: Effect[] = [];
    for (const [id, w] of Object.entries(map ?? {})) {
      const known = kind === 'axes' ? env.axes.has(id) : env.principles.has(id);
      if (!known) {
        rep.report('E004', `Unknown ${kind === 'axes' ? 'axis' : 'principle'} '${id}'`, { pf: loc.pf, path: [...loc.path, kind, id] });
        continue;
      }
      if (w !== 0) out.push({ target: kind === 'axes' ? `axis:${id}` : `principle:${id}`, w });
    }
    return out;
  };

  const itemEffects = (ai: { axes?: Record<string, number>; principles?: Record<string, number> }, loc: Loc): Effect[] => [
    ...effects(ai.axes, 'axes', loc),
    ...effects(ai.principles, 'principles', loc),
  ];

  const optionEffects = (o: { axes?: Record<string, number>; principles?: Record<string, number> }, loc: Loc): OptionEffect[] =>
    itemEffects(o, loc).map((e) => ({ target: e.target, v: e.w }));

  const options = (list: readonly { id: string; label: string; value?: number; axes?: Record<string, number>; principles?: Record<string, number> }[], i: number): Option[] => {
    checkUnique(list, 'option', pf, ['items', i, 'options'], rep);
    return list.map((o, j) => {
      const opt: Option = { id: o.id, label: o.label, effects: optionEffects(o, itemLoc(i, 'options', j)) };
      if (o.value !== undefined) opt.value = o.value;
      return opt;
    });
  };

  const items: Item[] = tf.items.map((ai, i): Item => {
    const base: ItemBase = {
      id: q(ai.id),
      key: ai.id,
      topic: tf.id,
      text: ai.text,
      tags: ai.tags ?? [],
      deep: ai.deep ?? false,
      sticky: ai.sticky ?? ai.type === 'challenge',
      unsure: ai.unsure ?? (ai.type !== 'importance' && ai.type !== 'multi' && tf.evidence !== 'validated'),
      sensitive: ai.sensitive ?? sensitive,
    };
    if (sensitive && ai.sensitive === false) rep.report('E012', `Items in a sensitive topic can't opt out of sensitivity`, itemLoc(i, 'sensitive'));
    if (ai.help) base.help = ai.help;
    if (ai.when) {
      const when = parseWhen(ai.when, i);
      if (when) base.when = when;
    }
    if ('anchor' in ai && ai.anchor) {
      if (!env.principles.has(ai.anchor.principle)) rep.report('E004', `Unknown principle '${ai.anchor.principle}'`, itemLoc(i, 'anchor', 'principle'));
      const anchor: Anchor = { principle: ai.anchor.principle, context: ai.anchor.context };
      if (ai.anchor.against) anchor.against = ai.anchor.against;
      base.anchor = anchor;
    }
    const loc = itemLoc(i);
    switch (ai.type) {
      case 'likert': {
        let labels: string[];
        if (Array.isArray(ai.labels)) labels = ai.labels;
        else if (ai.labels === 'accuracy') labels = ACCURACY5;
        else labels = AGREE[ai.points];
        if (labels.length !== ai.points) rep.report('E002', `labels: ${ai.labels === 'accuracy' ? "'accuracy' labels need points: 5" : `need ${ai.points} labels, found ${labels.length}`}`, itemLoc(i, 'labels'));
        return { ...base, type: 'likert', points: ai.points, labels, effects: itemEffects(ai, loc) };
      }
      case 'slider': {
        if (ai.labels && ai.labels.length !== ai.steps) rep.report('E002', `labels: need ${ai.steps} labels, found ${ai.labels.length}`, itemLoc(i, 'labels'));
        const item: Item = { ...base, type: 'slider', steps: ai.steps, poles: ai.poles, effects: itemEffects(ai, loc) };
        if (ai.labels) item.labels = ai.labels;
        return item;
      }
      case 'rating': {
        if (ai.labels && ai.labels.length !== 5) rep.report('E002', `labels: need 5 labels, found ${ai.labels.length}`, itemLoc(i, 'labels'));
        const item: Item = { ...base, type: 'rating', points: 5, poles: ai.poles, effects: itemEffects(ai, loc) };
        if (ai.labels) item.labels = ai.labels;
        return item;
      }
      case 'importance':
        return { ...base, type: 'importance', points: 4, labels: IMPORTANCE };
      case 'choice':
        return {
          ...base,
          type: 'choice',
          options: options(ai.options, i),
          shuffle: ai.shuffle ?? false,
          weight: ai.weight ?? 1,
          effects: itemEffects(ai, loc),
        };
      case 'pair':
        return {
          ...base,
          type: 'pair',
          options: options(ai.options, i) as [Option, Option],
          strength: ai.strength ?? true,
          weight: ai.weight ?? 1,
        };
      case 'multi': {
        checkUnique(ai.options, 'option', pf, ['items', i, 'options'], rep);
        const item: Item = { ...base, type: 'multi', options: ai.options.map((o) => ({ id: o.id, label: o.label })), intensity: ai.intensity ?? false };
        if (ai.max !== undefined) item.max = ai.max;
        return item;
      }
      case 'challenge': {
        checkUnique(ai.options, 'option', pf, ['items', i, 'options'], rep);
        const targets = resolveRef(ai.targets, i, itemLoc(i, 'targets'), false) ?? q(ai.targets);
        const opts = ai.options.map((o, j): ChallengeOption => {
          const opt: ChallengeOption = { id: o.id, label: o.label, reaction: o.reaction, effects: optionEffects(o, itemLoc(i, 'options', j)) };
          if (o.value !== undefined) opt.value = o.value;
          if (o.revise !== undefined) {
            const r = resolveRef(o.revise, i, itemLoc(i, 'options', j, 'revise'), false);
            if (r) opt.revise = r;
          }
          return opt;
        });
        const item: Item = { ...base, type: 'challenge', targets, scenario: ai.scenario, options: opts, weight: ai.weight ?? 1 };
        if (ai.source) item.source = ai.source;
        if (ai.name) item.name = ai.name;
        return item;
      }
      case 'reask': {
        const target = resolveRef(ai.target, i, itemLoc(i, 'target'), false) ?? q(ai.target);
        return { ...base, type: 'reask', target };
      }
    }
  });

  const topic: Topic = {
    id: tf.id,
    domain: tf.domain,
    title: tf.title,
    summary: tf.summary,
    tier: tf.tier,
    evidence: tf.evidence,
    sensitive,
    feeds: axesFed(items),
    anchors: principlesAnchored(items),
    items,
  };
  if (tf.source) topic.source = tf.source;
  if (tf.license) topic.license = tf.license;
  if (tf.instructions) topic.instructions = tf.instructions;
  if (tf.stance && tc.index.has(tf.stance)) topic.stance = q(tf.stance);
  if (tf.importance && tc.index.has(tf.importance)) topic.importance = q(tf.importance);
  return topic;
}

/** Axes that any item or option effect targets, sorted. */
function axesFed(items: Item[]): string[] {
  const axes = new Set<string>();
  for (const it of items) {
    const effects = [
      ...('effects' in it ? it.effects : []),
      ...('options' in it ? it.options.flatMap((o) => ('effects' in o ? o.effects : [])) : []),
    ];
    for (const e of effects) if (e.target.startsWith('axis:')) axes.add(e.target.slice('axis:'.length));
  }
  return [...axes].sort();
}

/** Principles that any anchor item tests, sorted. */
function principlesAnchored(items: Item[]): string[] {
  return [...new Set(items.flatMap((it) => (it.anchor ? [it.anchor.principle] : [])))].sort();
}

function sortDiags(d: Diagnostic[]): Diagnostic[] {
  return [...d].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.col - b.col || a.code.localeCompare(b.code));
}

export function canonicalJson(v: unknown): string {
  return JSON.stringify(v, (_k, val: unknown) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : val,
  );
}
