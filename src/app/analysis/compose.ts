// Turns the analysis facts into what the results page shows: a summary, a short read-out per
// section and next steps. Pure, so it's tested in node. Sentence templates live in copy.analysis;
// this file only chooses which parts go into them.
import type { AxisFact, CaseRec, ExploreRec, PrincipleFact, ReadingRec, ReflectRec, SuggestionRec } from '../../engine/analysis/index.ts';
import type { AnalysisFacts, Closeness, TraditionStatus } from '../../engine/analysis/types.ts';
import type { AnalysisPack } from '../../model/analysis.ts';
import { BAND, LIMIT } from '../../engine/analysis/constants.ts';
import type { AnswerState } from '../../engine/state.ts';
import type { Tension } from '../../engine/tensions.ts';
import type { AxisFamily, Bundle } from '../../model/content.ts';
import type { Profile } from '../../model/profile.ts';
import { copy } from '../copy.ts';
import { to } from '../routes.ts';
import { challengeTotals, strongestLeanings, topicStatus, type InterestEntry } from '../view.ts';

export type SectionId = 'politics' | 'values' | 'thinking' | 'worldview' | 'personality' | 'principles' | 'tensions' | 'positions' | 'taste';

export interface Readout {
  sentences: string[];
  /** "Based on N topics." plus a note when some results rest on few answers. */
  basedOn: string | null;
}

export interface Tile {
  id: 'topics' | 'challenges' | 'tensions';
  label: string;
  value: number;
  detail: string;
}

export interface Summary {
  headline: string;
  sentences: string[];
  tiles: Tile[];
  /** The political tradition (or two) the answers sit closest to, when one is named. */
  tradition: string | null;
}

export interface NextItem {
  testid: string;
  title: string;
  /** The line under the title. */
  detail: string;
  /** Small print: a source, or how you met a case. */
  meta?: string;
  href?: string;
  cta?: string;
}

export interface NextGroup {
  id: 'read' | 'readings' | 'links' | 'explore' | 'reflect';
  title: string;
  intro: string;
  items: NextItem[];
  /** Closed until opened, with this line saying what it draws on. */
  collapsed?: { note: string };
}

export interface TraditionRow {
  id: string;
  name: string;
  closeness: Closeness;
  /** The closeness in words: "Very close", "Some overlap"… */
  band: string;
  /** Where the answers differ most: "You lean further toward “Liberty”". */
  differences: string[];
  summary: string;
  /** What divides it from the nearest tradition, when the two are neighbours. */
  split: { from: string; text: string } | null;
  /** "Social democrats are divided on “Civil”." */
  divided: string | null;
}

export interface TraditionsView {
  status: TraditionStatus;
  /** What the comparison found, in one sentence. */
  lead: string;
  /** What it compared: "Compared on “Economic” and “Civil”." Null without a comparison. */
  basis: string | null;
  rows: TraditionRow[];
  /** The traditions the summary names, nearest first. */
  named: string[];
  /** The named tradition drawn as gray reference marks on the spectrums. */
  reference: { id: string; name: string } | null;
}

export interface Analysis {
  summary: Summary;
  readouts: Partial<Record<SectionId, Readout>>;
  /** Null until the analysis pack has loaded, or if there is none. */
  traditions: TraditionsView | null;
  next: NextGroup[];
}

export interface ComposeInput {
  bundle: Bundle;
  state: AnswerState;
  facts: AnalysisFacts;
  /** Everything answered (counts and private sections). */
  profile: Profile;
  /** Without sensitive answers (summary and recommendations). */
  publicProfile: Profile;
  /** All tensions, for the Tensions read-out. */
  tensions: readonly Tension[];
  interests: readonly InterestEntry[];
  alwaysDeep?: boolean;
  /** Political traditions, readings and links from research, once loaded. */
  pack?: AnalysisPack | null;
  /** Show links from research (a setting; on unless turned off). */
  links?: boolean;
}

const A = copy.analysis;

export function composeAnalysis(i: ComposeInput): Analysis {
  const traditions = traditionsView(i);
  return { summary: summary(i), readouts: readouts(i, traditions), traditions, next: next(i) };
}

// --- Summary ---------------------------------------------------------------------------------

function summary(i: ComposeInput): Summary {
  const { facts, bundle } = i;
  const pub = facts.public;
  const axes = Object.values(bundle.axes);
  const leanings = strongestLeanings(
    axes.filter((a) => a.family === 'political' || a.family === 'values'),
    i.publicProfile.axes,
    2,
  );
  const topPrinciples = endorsed(pub.principles).slice(0, 2);
  const traits = personalityTraits(pub.axes.personality, bundle).slice(0, 2);

  let headline: string = A.headline.empty;
  if (leanings.length) headline = A.headline.leanings(leanings.map((l) => pole(bundle, l.axis, i.publicProfile.axes[l.axis]!.score!)));
  else if (topPrinciples.length) headline = A.headline.principles(topPrinciples.map((p) => principleLabel(bundle, p.principle)));
  else if (traits.length) headline = A.headline.personality(traits);

  const sentences: string[] = [];
  const politics = leanSentence(A.intro.politics, pub.axes.political, bundle);
  if (politics) sentences.push(politics);
  if (topPrinciples.length) sentences.push(A.principlesTop(topPrinciples.map((p) => principleLabel(bundle, p.principle))));
  const totals = challengeTotals(i.profile.topics);
  if (totals.asked) sentences.push(A.challenges(totals.asked, totals.held, totals.distinguished, totals.moved));
  // The count matches the tile (every open tension); the principle named comes only from
  // tensions that could be shared.
  const open = i.tensions.filter((t) => t.status === 'open').length;
  if (open && pub.tensions.top) sentences.push(A.tensionsSummary(open, principleLabel(bundle, pub.tensions.top)));

  const tiles: Tile[] = [
    { id: 'topics', label: A.tiles.topics, value: Object.keys(i.profile.topics).length, detail: A.tiles.topicsOf(bundle.topics.length) },
    { id: 'challenges', label: A.tiles.challenges, value: totals.asked, detail: totals.asked ? A.tiles.reconsidered(totals.moved) : '' },
    { id: 'tensions', label: A.tiles.tensions, value: open, detail: A.tiles.tensionsSee },
  ];
  const t = pub.traditions;
  const name = (id: string) => i.pack?.traditions.find((x) => x.id === id)?.name ?? id;
  const tradition =
    t?.status === 'match' ? A.traditions.summary.match(name(t.named[0]!)) : t?.status === 'between' ? A.traditions.summary.between(name(t.named[0]!), name(t.named[1]!)) : null;
  return { headline, sentences: sentences.length ? sentences.slice(0, 4) : [A.summaryEmpty], tiles, tradition };
}

// --- Section read-outs -----------------------------------------------------------------------

function readouts(i: ComposeInput, traditions: TraditionsView | null): Partial<Record<SectionId, Readout>> {
  const { facts, bundle } = i;
  const out: Partial<Record<SectionId, Readout>> = {};
  const lean = (id: SectionId, intro: string, family: AxisFamily, extra: string[] = [], note = A.basedOn) => {
    const list = facts.axes[family];
    const sentence = leanSentence(intro, list, bundle);
    if (sentence || extra.length) out[id] = { sentences: [...(sentence ? [sentence] : []), ...extra], basedOn: basedOn(list, note) };
  };

  const pulls = facts.axes.political.filter((a) => a.mixed && a.drivers[0].length && a.drivers[1].length).slice(0, 1).map((a) => pullSentence(a, bundle, i.state));
  const tradition = traditions && traditions.status !== 'insufficient' ? [traditions.lead] : [];
  lean('politics', A.intro.politics, 'political', [...pulls, ...tradition]);
  lean('values', A.intro.values, 'values');

  // The note counts only the self-description topics, so it says so: the challenge record spans them all.
  const totals = challengeTotals(i.profile.topics);
  lean('thinking', A.intro.thinking, 'thinking', totals.asked ? [A.challenges(totals.asked, totals.held, totals.distinguished, totals.moved)] : [], A.basedOnSelf);
  lean('worldview', A.intro.worldview, 'worldview');

  const traits = personalityTraits(facts.axes.personality, bundle);
  if (traits.length) out.personality = { sentences: [A.personality(traits)], basedOn: basedOn(facts.axes.personality) };

  const p = principleSentences(facts.principles, bundle);
  if (p.length) out.principles = { sentences: p, basedOn: null };

  if (i.tensions.length) {
    const principles = new Set(i.tensions.map((t) => t.principle)).size;
    const resolved = i.tensions.filter((t) => t.status === 'resolved').length;
    out.tensions = { sentences: [A.tensionsRead(i.tensions.length, principles, resolved)], basedOn: null };
  }

  const firm = facts.public.positions.map((pos) => topicTitle(i.state, pos.topic));
  if (firm.length) {
    const moved = Object.values(i.profile.topics).reduce((n, r) => n + r.challenges.moved, 0);
    out.positions = { sentences: [A.firmest(firm), ...(totals.asked ? [A.reconsidered(moved)] : [])], basedOn: null };
  }

  const picks = i.interests.filter((e) => e.kind === 'pick').slice(0, 3).map((e) => e.label);
  lean('taste', A.intro.taste, 'taste', picks.length ? [A.enjoys(picks)] : []);
  return out;
}

// --- Next steps ------------------------------------------------------------------------------

function next(i: ComposeInput): NextGroup[] {
  const groups: NextGroup[] = [];
  const read = i.facts.next.cases.map((c) => caseItem(i, c)).filter((x): x is NextItem => x !== null);
  if (read.length) groups.push({ id: 'read', title: A.next.read.title, intro: A.next.read.intro, items: read });
  const readings = i.facts.next.readings.map((r) => readingItem(i, r)).filter((x): x is NextItem => x !== null);
  const named = (i.facts.public.traditions?.named ?? []).map((id) => i.pack?.traditions.find((t) => t.id === id)?.name ?? id);
  if (readings.length) groups.push({ id: 'readings', title: A.next.readings.title, intro: A.next.readings.intro(named), items: readings });
  const links = i.links === false ? [] : i.facts.next.suggestions.map((r) => linkItem(i, r)).filter((x): x is NextItem => x !== null);
  if (links.length) groups.push({ id: 'links', title: A.next.links.title, intro: A.next.links.intro, items: links, collapsed: { note: A.next.links.note } });
  const explore = i.facts.next.explore.map((r) => exploreItem(i, r));
  if (explore.length) groups.push({ id: 'explore', title: A.next.explore.title, intro: A.next.explore.intro, items: explore });
  const reflect = i.facts.next.reflect.map((r) => reflectItem(i.bundle, r));
  if (reflect.length) groups.push({ id: 'reflect', title: A.next.reflect.title, intro: A.next.reflect.intro, items: reflect });
  return groups;
}

function caseItem(i: ComposeInput, c: CaseRec): NextItem | null {
  const ch = i.state.ix.items.get(c.challenge);
  if (!ch || ch.type !== 'challenge' || !ch.source) return null;
  const topic = topicTitle(i.state, c.topic);
  const item: NextItem = {
    testid: `rec-case-${c.topic}-${ch.key}`,
    title: ch.name ?? ch.text,
    detail: c.side === 'against' ? A.next.read.against(topic) : A.next.read.for(topic),
    meta: [ch.source, c.side === 'against' ? (c.met ? A.next.read.met[c.met] : null) : A.next.read.otherSide].filter(Boolean).join(' · '),
    href: to.topicResults(c.topic),
  };
  return item;
}

function exploreItem(i: ComposeInput, r: ExploreRec): NextItem {
  const t = i.state.ix.topics.get(r.topic)!;
  const spectrum = r.axis ? (i.bundle.axes[r.axis]?.title ?? r.axis) : '';
  const family = r.axis ? i.bundle.axes[r.axis]?.family : undefined;
  let detail: string;
  switch (r.reason) {
    case 'finish':
      detail = A.next.explore.finish;
      break;
    case 'map':
      detail = A.next.explore.map(spectrum);
      break;
    case 'show':
      detail = family === 'personality' ? A.next.explore.personality : A.next.explore.show(spectrum);
      break;
    case 'firm-up':
      detail = A.next.explore.firmUp(spectrum);
      break;
    case 'consistency':
      detail = A.next.explore.consistency(principleLabel(i.bundle, r.principle!));
      break;
    default:
      detail = A.next.explore.start;
  }
  const started = topicStatus(i.state, t, { alwaysDeep: i.alwaysDeep ?? false }).started;
  return { testid: `rec-explore-${r.topic}`, title: t.title, detail, href: to.flow(r.topic), cta: started ? A.next.explore.ctaContinue : A.next.explore.cta };
}

function readingItem(i: ComposeInput, r: ReadingRec): NextItem | null {
  const reading = i.pack?.readings[r.reading];
  if (!reading) return null;
  const name = (id: string) => i.pack?.traditions.find((t) => t.id === id)?.name ?? id;
  const view = r.view === 'inside' ? A.next.readings.inside(name(r.tradition)) : A.next.readings.outside(name(r.tradition), name(reading.voice));
  return {
    testid: `rec-read-${reading.id}`,
    title: reading.title,
    detail: reading.note,
    meta: [`${reading.author} (${reading.year})`, A.next.readings.kind[reading.kind], view].join(' · '),
  };
}

function linkItem(i: ComposeInput, r: SuggestionRec): NextItem | null {
  const g = i.pack?.suggestions.find((x) => x.id === r.suggestion);
  const lean = r.basis[0];
  const pole = lean ? i.bundle.axes[lean.axis]?.poles[lean.pole] : undefined;
  if (!g || !pole) return null;
  const L = A.next.links;
  const sentence = (r.end === 'toward' ? L.more : L.less)[g.outcome](pole, L.strength[g.strength], g.interest);
  return {
    testid: `rec-link-${g.id}`,
    title: r.end === 'toward' ? g.title : g.away,
    detail: [sentence, L.caveat, L.ask[r.end]].join(' '),
    meta: [L.kind[g.kind], L.because(pole), g.source].join(' · '),
  };
}

function reflectItem(b: Bundle, r: ReflectRec): NextItem {
  const label = principleLabel(b, r.principle);
  const lead = A.next.reflect.lead[r.variant](label, r.hi.context, r.lo.context);
  const ask = r.lo.against ? A.next.reflect.ask(r.lo.against) : A.next.reflect.askOpen;
  return { testid: `rec-reflect-${r.principle}`, title: label, detail: `${lead} ${ask}`, href: to.tension(r.tension), cta: A.next.reflect.cta };
}

// --- Political traditions --------------------------------------------------------------------

function traditionsView(i: ComposeInput): TraditionsView | null {
  const facts = i.facts.public.traditions;
  const pack = i.pack;
  if (!facts || !pack) return null;
  const T = A.traditions;
  const byId = new Map(pack.traditions.map((t) => [t.id, t]));
  const name = (id: string) => byId.get(id)?.name ?? id;
  const spectrum = (id: string) => i.bundle.axes[id]?.title ?? id;
  const names = facts.fits.map((f) => name(f.tradition));
  let lead: string;
  switch (facts.status) {
    case 'match':
      lead = T.lead.match(name(facts.named[0]!), names.filter((x) => x !== name(facts.named[0]!)));
      break;
    case 'between':
      lead = T.lead.between(name(facts.named[0]!), name(facts.named[1]!));
      break;
    case 'loose':
      lead = T.lead.loose(names);
      break;
    case 'mixed':
      lead = T.lead.mixed(names);
      break;
    default:
      lead = T.lead.insufficient(facts.missing.map(spectrum));
  }
  const nearest = facts.fits[0] ? byId.get(facts.fits[0].tradition) : undefined;
  const rows = facts.fits.map((f, k): TraditionRow => {
    const t = byId.get(f.tradition)!;
    const split = k > 0 ? nearest?.neighbours.find((n) => n.id === t.id) : undefined;
    const divided = t.divided.map((id) => i.bundle.axes[id]?.title ?? principleLabel(i.bundle, id));
    return {
      id: t.id,
      name: t.name,
      closeness: f.closeness,
      band: T.closeness[f.closeness],
      differences: f.differences.map((d) =>
        d.kind === 'axis' ? T.further(i.bundle.axes[d.axis]?.poles[d.toward] ?? d.axis) : d.more ? T.more(principleLabel(i.bundle, d.principle)) : T.less(principleLabel(i.bundle, d.principle)),
      ),
      summary: t.summary,
      split: split && nearest ? { from: nearest.name, text: split.split } : null,
      divided: divided.length ? T.divided(t.adherents, divided) : null,
    };
  });
  return {
    status: facts.status,
    lead,
    basis: facts.status === 'insufficient' ? null : T.basis(facts.compared.map(spectrum), facts.principles.map((p) => principleLabel(i.bundle, p))),
    rows,
    named: [...facts.named],
    reference: facts.named[0] ? { id: facts.named[0], name: name(facts.named[0]) } : null,
  };
}

// --- Parts -----------------------------------------------------------------------------------

/** "Politically, you lean strongly toward “Markets” and toward “Tradition”, and sit in the middle on “Civil”." */
function leanSentence(intro: string, list: readonly AxisFact[], b: Bundle): string | null {
  if (!list.length) return null;
  const sorted = [...list].sort((x, y) => Math.abs(y.score) - Math.abs(x.score));
  const poles = (min: number, max: number) =>
    sorted.filter((a) => Math.abs(a.score) >= min && Math.abs(a.score) < max).map((a) => pole(b, a.axis, a.score));
  const strong = poles(BAND.strong, Infinity);
  const plain = poles(BAND.leans, BAND.strong);
  const slight = poles(BAND.center, BAND.leans);
  const leaning = [
    ...(strong.length ? [A.toward.strong(strong)] : []),
    ...(plain.length ? [A.toward.plain(plain)] : []),
    ...(slight.length ? [A.toward.slight(slight)] : []),
  ];
  const middle = sorted.filter((a) => Math.abs(a.score) < BAND.center).map((a) => b.axes[a.axis]?.title ?? a.axis);
  return A.lean(intro, leaning, middle);
}

function pullSentence(a: AxisFact, b: Bundle, s: AnswerState): string {
  const axis = b.axes[a.axis]!;
  const names = (d: AxisFact['drivers'][number]) => d.slice(0, LIMIT.drivers).map((x) => topicTitle(s, x.topic));
  return A.pullsBothWays(axis.title, names(a.drivers[0]), axis.poles[0], names(a.drivers[1]), axis.poles[1]);
}

/** "very outgoing", "fairly organized", "neither reserved nor outgoing", strongest first. */
function personalityTraits(list: readonly AxisFact[], b: Bundle): string[] {
  return [...list]
    .sort((x, y) => Math.abs(y.score) - Math.abs(x.score))
    .map((a) => {
      const axis = b.axes[a.axis]!;
      const m = Math.abs(a.score);
      if (m < BAND.center) return A.trait.neither(axis.poles[0], axis.poles[1]);
      const p = pole(b, a.axis, a.score);
      return m < BAND.leans ? A.trait.slight(p) : m < BAND.strong ? A.trait.plain(p) : A.trait.strong(p);
    });
}

function principleSentences(list: readonly PrincipleFact[], b: Bundle): string[] {
  const out: string[] = [];
  const top = endorsed(list).slice(0, 3);
  if (top.length) out.push(A.principlesTop(top.map((p) => principleLabel(b, p.principle))));
  const low = [...list].sort((x, y) => x.score - y.score)[0];
  if (low && low.score <= -BAND.leans) out.push(A.principlesLow(principleLabel(b, low.principle)));
  const withConsistency = list.filter((p) => p.consistency !== null).sort((x, y) => y.consistency! - x.consistency!);
  if (withConsistency.length >= 2) {
    out.push(A.consistency(principleLabel(b, withConsistency[0]!.principle), principleLabel(b, withConsistency.at(-1)!.principle)));
  }
  return out;
}

function endorsed(list: readonly PrincipleFact[]): PrincipleFact[] {
  return list.filter((p) => p.score >= BAND.leans).sort((x, y) => y.score - x.score);
}

function basedOn(list: readonly AxisFact[], note: (topics: number) => string = A.basedOn): string | null {
  if (!list.length) return null;
  const topics = Math.max(...list.map((a) => a.topics));
  return list.some((a) => a.level === 'low') ? `${note(topics)} ${A.fewAnswers}` : note(topics);
}

function pole(b: Bundle, axis: string, score: number): string {
  const a = b.axes[axis];
  return a ? (score < 0 ? a.poles[0] : a.poles[1]) : axis;
}

function principleLabel(b: Bundle, id: string): string {
  return b.principles[id]?.label ?? id;
}

function topicTitle(s: AnswerState, id: string): string {
  return s.ix.topics.get(id)?.title ?? id;
}
