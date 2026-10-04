// Links from research on the REAL content and pack: every link reachable from both ends by someone
// who answers the personality form; the gate (every item, no reversal pair agreed at both items, a
// clear lean beyond the norm) holds for every link shown; at most one per kind and three in all;
// nothing but the personality answers moves them; and what the screen says passes the tone,
// loaded-term and blocked-subject checks. The rules are in docs/ANALYSIS.md.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { composeAnalysis, type NextItem } from '../../src/app/analysis/compose.ts';
import { interestList } from '../../src/app/view.ts';
import { findTerms, parseTerms, termMatchers } from '../../src/compiler/loaded-terms.ts';
import { LIMIT, SUGGEST } from '../../src/engine/analysis/constants.ts';
import { analyse } from '../../src/engine/analysis/index.ts';
import { suggestionsFor } from '../../src/engine/analysis/suggestions.ts';
import { numericValue } from '../../src/engine/normalize.ts';
import { buildProfile } from '../../src/engine/profile.ts';
import { mulberry32 } from '../../src/engine/rng.ts';
import { buildAnswerState, type AnswerState } from '../../src/engine/state.ts';
import type { Response } from '../../src/model/answers.ts';
import { Log, realBundle, realPack, scale, skip } from '../helpers.ts';
import { runRespondent } from './harness.ts';
import { randomPolicy, scriptedPolicy } from './policies.ts';

const b = realBundle();
const pack = realPack()!;
const o = { appVersion: 'sim', now: '2026-01-01T00:00:00.000Z', resolutions: [] };
const terms = termMatchers(parseTerms(readFileSync('content/loaded-terms.txt', 'utf8')));
const blocked = termMatchers(parseTerms(readFileSync('content/analysis/blocked-advice.txt', 'utf8')), { inflected: true });
const TONE = [/\byou should\b/i, /\byou must\b/i, /\byou are an? \b/i, /\bmost people\b/i, /\bnormal\b/i, /\bwrong\b/i, /%/, /\d/];

const mini = b.topics.find((t) => t.id === 'mini_ipip')!;
/** Each personality item and the trait and sign it feeds. */
const keyed = mini.items.flatMap((it) =>
  'effects' in it ? it.effects.filter((e) => e.target.startsWith('axis:')).map((e) => ({ id: it.id, trait: e.target.slice(5), sign: Math.sign(e.w) })) : [],
);
const itemsOf = (trait: string) => keyed.filter((k) => k.trait === trait);
const TRAITS = ['extraversion', 'agreeableness', 'conscientiousness', 'neuroticism', 'openness'];

/** Answers on the form: each trait at a keyed step (1-5), every item answered unless listed in `skipped`. */
function form(steps: Partial<Record<string, number>>, skipped: string[] = []): Record<string, Response> {
  const out: Record<string, Response> = {};
  for (const k of keyed) {
    const at = steps[k.trait] ?? 3;
    out[k.id] = skipped.includes(k.id) ? skip : scale(k.sign > 0 ? at : 6 - at);
  }
  return out;
}

function stateOf(answers: Record<string, Response>): AnswerState {
  const log = new Log();
  for (const [id, r] of Object.entries(answers)) log.add(id, r);
  return buildAnswerState(b, log.events);
}

const publicOf = (s: AnswerState) => buildProfile(s, { ...o, includeSensitive: false });
const links = (s: AnswerState) => suggestionsFor(pack, publicOf(s), s).map((r) => `${r.suggestion}:${r.end}`);

function composeLinks(s: AnswerState, show = true): NextItem[] | undefined {
  const profile = buildProfile(s, { ...o, includeSensitive: true });
  const publicProfile = publicOf(s);
  const facts = analyse({ state: s, profile, publicProfile, tensions: [], pack });
  const a = composeAnalysis({ bundle: b, state: s, facts, profile, publicProfile, tensions: [], interests: interestList(profile.interests, s), pack, links: show });
  return a.next.find((g) => g.id === 'links')?.items;
}

describe('links from research on the real content', () => {
  it('rest on personality traits with norms, never neuroticism', () => {
    expect(pack.suggestions.length).toBeGreaterThan(0);
    for (const g of pack.suggestions) {
      expect(g.trait).not.toBe('neuroticism');
      expect(b.axes[g.trait]?.family, g.id).toBe('personality');
      expect(pack.norms[g.trait], g.id).toBeDefined();
      expect(itemsOf(g.trait).length, g.id).toBe(4);
    }
  });

  it('reach every link from both ends, and nothing from the middle', () => {
    for (const g of pack.suggestions) {
      const toward = g.toward === 1 ? 5 : 1;
      expect(links(stateOf(form({ [g.trait]: toward }))), g.id).toContain(`${g.id}:toward`);
      expect(links(stateOf(form({ [g.trait]: 6 - toward }))), g.id).toContain(`${g.id}:away`);
    }
    expect(links(stateOf(form({})))).toEqual([]);
    // Neuroticism, however far it leans, is never a basis.
    expect(links(stateOf(form({ neuroticism: 5 })))).toEqual([]);
    expect(links(stateOf(form({ neuroticism: 1 })))).toEqual([]);
  });

  it('need every item answered', () => {
    for (const g of pack.suggestions) {
      const [first] = itemsOf(g.trait);
      expect(links(stateOf(form({ [g.trait]: 5 }, [first!.id]))), g.id).toEqual([]);
      expect(links(stateOf(form({ [g.trait]: 1 }, [first!.id]))), g.id).toEqual([]);
    }
  });

  it('are voided by agreeing with both items of a reversal pair', () => {
    // Each case clears the lean and the norm, so only the reversal pair stops it; one step less
    // agreement with either item lets the link through.
    const cases: [Record<string, number>, string, string, number][] = [
      // Agreeing with everything scores openness at the "Practical" end.
      [{ 'mini_ipip.i1': 4, 'mini_ipip.i2': 5, 'mini_ipip.i3': 5, 'mini_ipip.i4': 5 }, 'mini_ipip.i1', 'artistic:away', -0.625],
      [{ 'mini_ipip.e1': 4, 'mini_ipip.e2': 1, 'mini_ipip.e3': 5, 'mini_ipip.e4': 4 }, 'mini_ipip.e4', 'enterprising:toward', 0.5],
      [{ 'mini_ipip.e1': 5, 'mini_ipip.e2': 4, 'mini_ipip.e3': 4, 'mini_ipip.e4': 1 }, 'mini_ipip.e2', 'enterprising:toward', 0.5],
    ];
    for (const [steps, relax, link, score] of cases) {
      const answers = { ...form({}), ...Object.fromEntries(Object.entries(steps).map(([id, step]) => [id, scale(step)])) };
      const trait = keyed.find((k) => k.id === relax)!.trait;
      expect(publicOf(stateOf(answers)).axes[trait]!.score, link).toBe(score);
      expect(links(stateOf(answers)), link).toEqual([]);
      expect(links(stateOf({ ...answers, [relax]: scale(3) })), link).toEqual([link]);
    }
  });

  it('need a lean beyond the norm, not just on the scale', () => {
    // Openness has a high mean, so 0.625 on the scale isn't half an SD beyond it; 0.75 is.
    const open = (i4: number) => stateOf({ ...form({}), 'mini_ipip.i1': scale(5), 'mini_ipip.i2': scale(1), 'mini_ipip.i3': scale(2), 'mini_ipip.i4': scale(i4) });
    expect(publicOf(open(3)).axes['openness']!.score).toBe(0.625);
    expect(links(open(3))).toEqual([]);
    expect(publicOf(open(2)).axes['openness']!.score).toBe(0.75);
    expect(links(open(2))).toEqual(['artistic:toward']);
    // Extraversion's mean is near the middle, so 0.5 is enough.
    const outgoing = stateOf({ ...form({}), 'mini_ipip.e1': scale(5), 'mini_ipip.e2': scale(1), 'mini_ipip.e3': scale(3), 'mini_ipip.e4': scale(3) });
    expect(publicOf(outgoing).axes['extraversion']!.score).toBe(0.5);
    expect(links(outgoing)).toEqual(['enterprising:toward']);
  });

  it('show the clearer lean when two traits qualify', () => {
    // Openness at 1 is (1 - 0.52) / 0.385 = 1.2 SDs beyond its mean; extraversion at 1 is 2.
    expect(links(stateOf(form({ openness: 5, extraversion: 5 })))).toEqual(['enterprising:toward']);
    expect(links(stateOf(form({ openness: 1, extraversion: 4 })))).toEqual(['artistic:away']);
  });

  it('hold the gate, one per kind and three at most, for random respondents', () => {
    const seen = new Map<string, number>();
    for (let i = 0; i < 300; i++) {
      const run = runRespondent(b, randomPolicy({ skipRate: 0.15 }), { seed: 7100 + i, topics: ['mini_ipip'] });
      const s = run.state;
      const p = publicOf(s);
      const recs = suggestionsFor(pack, p, s);
      expect(recs.length).toBeLessThanOrEqual(LIMIT.suggestions);
      expect(new Set(recs.map((r) => r.about)).size, `random #${i}`).toBe(recs.length);
      for (const r of recs) {
        const g = pack.suggestions.find((x) => x.id === r.suggestion)!;
        const n = pack.norms[g.trait]!;
        const axis = p.axes[g.trait]!;
        const dir = r.basis[0]!.pole === 1 ? 1 : -1;
        expect(itemsOf(g.trait).every((k) => s.values.has(k.id)), `random #${i}: ${r.suggestion} with an item unanswered`).toBe(true);
        expect(axis.confidence).toBeGreaterThanOrEqual(SUGGEST.confidence);
        expect(dir * axis.score!).toBeGreaterThanOrEqual(SUGGEST.lean);
        expect((dir * (axis.score! - n.mean)) / n.sd).toBeGreaterThanOrEqual(SUGGEST.beyondMean);
        const value = (id: string) => {
          const v = s.values.get(id);
          return (v && numericValue(v)) ?? -1;
        };
        for (const [a, c] of n.reversals) expect(Math.min(value(a), value(c)), `random #${i}: ${a} and ${c}`).toBeLessThan(0.5);
        expect(r.end).toBe(r.basis[0]!.pole === g.toward ? 'toward' : 'away');
        const key = `${r.suggestion}:${r.end}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
    }
    // Random answers reach every link from both ends.
    for (const g of pack.suggestions) for (const end of ['toward', 'away']) expect(seen.get(`${g.id}:${end}`) ?? 0, `${g.id}:${end}`).toBeGreaterThan(0);
  });

  it('move only with the personality answers', () => {
    const others = b.topics.filter((t) => t.id !== 'mini_ipip').map((t) => t.id);
    let shown = 0;
    for (let i = 0; i < 8; i++) {
      const rng = mulberry32(400 + i);
      const steps = Object.fromEntries(TRAITS.map((t) => [t, 1 + Math.floor(rng() * 5)]));
      const personality = form(steps);
      const results = [1, 2].map((seed) => {
        // The same personality answers apart from neuroticism; everything else answered at random.
        const answers = Object.fromEntries(Object.entries(personality).filter(([id]) => !itemsOf('neuroticism').some((k) => k.id === id)));
        const run = runRespondent(b, scriptedPolicy(answers, randomPolicy({ skipRate: 0.1 })), { seed: 900 + 10 * i + seed, topics: ['mini_ipip', ...others] });
        return links(run.state);
      });
      expect(results[1], `respondent ${i}`).toEqual(results[0]);
      if (results[0]!.length) shown++;
    }
    expect(shown).toBeGreaterThan(2);
  }, 120_000);

  it('read as tendencies, never touching a blocked subject, and hide when switched off', () => {
    for (const g of pack.suggestions) {
      for (const at of [5, 1]) {
        const s = stateOf(form({ [g.trait]: at }));
        const items = composeLinks(s)!;
        expect(items.length, g.id).toBe(1);
        const item = items[0]!;
        const text = [item.title, item.detail, (item.meta ?? '').replace(g.source, '')].join(' ');
        expect(item.detail, g.id).toMatch(/^In large studies, people who describe themselves as more “[^”]+” (report|take part)/);
        expect(item.meta, g.id).toMatch(/· Your answers lean toward “[^”]+” ·/);
        for (const re of TONE) expect(text, `${g.id}: ${re}`).not.toMatch(re);
        expect(findTerms(text, blocked), g.id).toEqual([]);
        expect(findTerms(text, terms), g.id).toEqual([]);
        expect(text).not.toMatch(/undefined|NaN|\bnull\b|\[object/);
        expect(composeLinks(s, false), g.id).toBeUndefined();
      }
    }
  });
});
