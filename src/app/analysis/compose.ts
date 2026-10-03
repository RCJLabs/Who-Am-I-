// Turns the analysis facts into what the results page shows: a summary, a short read-out per
// section and next steps. Pure, so it's tested in node. Sentence templates live in copy.analysis;
// this file only chooses which parts go into them.
import type { AxisFact, CaseRec, ExploreRec, PrincipleFact, ReflectRec } from '../../engine/analysis/index.ts';
import type { AnalysisFacts } from '../../engine/analysis/types.ts';
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
  id: 'read' | 'explore' | 'reflect';
  title: string;
  intro: string;
  items: NextItem[];
}

export interface Analysis {
  summary: Summary;
  readouts: Partial<Record<SectionId, Readout>>;
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
}

const A = copy.analysis;

export function composeAnalysis(i: ComposeInput): Analysis {
  return { summary: summary(i), readouts: readouts(i), next: next(i) };
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
  return { headline, sentences: sentences.length ? sentences.slice(0, 4) : [A.summaryEmpty], tiles };
}

// --- Section read-outs -----------------------------------------------------------------------

function readouts(i: ComposeInput): Partial<Record<SectionId, Readout>> {
  const { facts, bundle } = i;
  const out: Partial<Record<SectionId, Readout>> = {};
  const lean = (id: SectionId, intro: string, family: AxisFamily, extra: string[] = [], note = A.basedOn) => {
    const list = facts.axes[family];
    const sentence = leanSentence(intro, list, bundle);
    if (sentence || extra.length) out[id] = { sentences: [...(sentence ? [sentence] : []), ...extra], basedOn: basedOn(list, note) };
  };

  const pulls = facts.axes.political.filter((a) => a.mixed && a.drivers[0].length && a.drivers[1].length).slice(0, 1).map((a) => pullSentence(a, bundle, i.state));
  lean('politics', A.intro.politics, 'political', pulls);
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

function reflectItem(b: Bundle, r: ReflectRec): NextItem {
  const label = principleLabel(b, r.principle);
  const lead = A.next.reflect.lead[r.variant](label, r.hi.context, r.lo.context);
  const ask = r.lo.against ? A.next.reflect.ask(r.lo.against) : A.next.reflect.askOpen;
  return { testid: `rec-reflect-${r.principle}`, title: label, detail: `${lead} ${ask}`, href: to.tension(r.tension), cta: A.next.reflect.cta };
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
