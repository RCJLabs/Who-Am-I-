// Political traditions on the REAL content and pack. Each tradition's own answer sheet, answered
// as a respondent, is named as itself, and so are most noisy adherents; the personas land where
// expected; agree/disagree-only answers, straight-liners and random answers are never or rarely
// named; a grid of consistent respondents finds every tradition and treats left and right alike.
// Worldview and sensitive answers never move any of it. The rules are in docs/ANALYSIS.md.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { matchTraditions, shareableAnswers } from '../../src/engine/analysis/traditions.ts';
import type { TraditionFacts } from '../../src/engine/analysis/types.ts';
import { buildProfile } from '../../src/engine/profile.ts';
import { mulberry32 } from '../../src/engine/rng.ts';
import { buildAnswerState, type AnswerState } from '../../src/engine/state.ts';
import type { AnswerEvent } from '../../src/model/answers.ts';
import { isScale, scalePoints, type Item } from '../../src/model/content.ts';
import type { Profile } from '../../src/model/profile.ts';
import { Log, realBundle, realPack, scale } from '../helpers.ts';
import { engineTensions, runRespondent } from './harness.ts';
import { constantPolicy, personaResponses, randomPolicy, scriptedPolicy } from './policies.ts';

const b = realBundle();
const pack = realPack()!;
const items = new Map(b.topics.flatMap((t) => t.items.map((it): [string, Item] => [it.id, it])));
const SPECTRUMS = ['economic', 'civil', 'cultural', 'diplomatic'];
const LEFT = ['democratic_socialist', 'green', 'social_democrat', 'social_liberal', 'left_communitarian'];
const RIGHT = ['classical_liberal', 'libertarian', 'traditional_conservative', 'national_conservative'];

interface Sheet {
  tradition: string;
  answers: Record<string, number>;
  divided?: string[];
}
const SHEETS = 'content/analysis/sheets';
const sheets = readdirSync(SHEETS)
  .sort()
  .map((f) => parse(readFileSync(join(SHEETS, f), 'utf8')) as Sheet);

const o = { appVersion: 'sim', now: '2026-01-01T00:00:00.000Z', resolutions: [] };
const match = (s: AnswerState): TraditionFacts => matchTraditions(b, buildProfile(s, { ...o, includeSensitive: false }), pack, shareableAnswers(s));
const stateOf = (answers: Record<string, number>): AnswerState => {
  const log = new Log();
  for (const [id, step] of Object.entries(answers)) log.add(id, scale(step));
  return buildAnswerState(b, log.events);
};
const named = (f: TraditionFacts, id: string) => (f.status === 'match' || f.status === 'between') && f.named.includes(id);
const top = (f: TraditionFacts, n: number) => f.fits.slice(0, n).map((x) => x.tradition);

function persona(name: string): AnswerState {
  const p = parse(readFileSync(`tests/sim/personas/${name}.yaml`, 'utf8')) as { topics: string[]; answers: Record<string, number | string | string[]> };
  return runRespondent(b, scriptedPolicy(personaResponses(p.answers)), { topics: p.topics, tensions: engineTensions, tensionPolicy: () => null }).state;
}

/** A sheet answered with each step moved by up to two, some skipped, and its split questions answered by camp. */
function noisy(sheet: Sheet, rng: () => number): Record<string, number> {
  const out: Record<string, number> = {};
  const points = (id: string) => {
    const it = items.get(id)!;
    return isScale(it) ? scalePoints(it) : 7;
  };
  for (const [id, step] of Object.entries(sheet.answers)) {
    if (rng() < 0.15) continue;
    const r = rng();
    const d = r < 0.075 ? -2 : r < 0.3 ? -1 : r < 0.7 ? 0 : r < 0.925 ? 1 : 2;
    out[id] = Math.max(1, Math.min(points(id), step + d));
  }
  for (const id of sheet.divided ?? []) {
    if (rng() < 0.15) continue;
    out[id] = rng() < 0.5 ? 1 + Math.floor(rng() * 2) : points(id) - Math.floor(rng() * 2);
  }
  return out;
}

describe('political traditions on the real content', () => {
  it('has a sheet for every tradition, from both sides of politics', () => {
    expect(sheets.map((s) => s.tradition).sort()).toEqual(pack.traditions.map((t) => t.id).sort());
    expect(pack.traditions.map((t) => t.id)).toEqual(expect.arrayContaining([...LEFT, ...RIGHT, 'centrist', 'communitarian']));
  });

  it("names each tradition's own answer sheet as itself", () => {
    for (const sheet of sheets) {
      const f = match(stateOf(sheet.answers));
      expect(f, sheet.tradition).toMatchObject({ status: 'match', named: [sheet.tradition], fit: { gap: 0 } });
    }
  });

  it('names most noisy adherents, alone or between their tradition and a neighbor', () => {
    let total = 0;
    for (const sheet of sheets) {
      let hits = 0;
      for (let i = 0; i < 40; i++) if (named(match(stateOf(noisy(sheet, mulberry32(4000 + i * 31 + sheet.tradition.length)))), sheet.tradition)) hits++;
      expect(hits, sheet.tradition).toBeGreaterThanOrEqual(24);
      total += hits;
    }
    expect(total).toBeGreaterThanOrEqual(0.8 * 40 * sheets.length);
  }, 120_000);

  it('places each persona where its answers lean', () => {
    const libertarian = match(persona('libertarian'));
    expect(libertarian).toMatchObject({ status: 'match', named: ['libertarian'] });
    expect(top(libertarian, 2)).toContain('classical_liberal');

    const conservative = match(persona('religious_conservative'));
    expect(conservative.named.length).toBeGreaterThan(0);
    for (const id of conservative.named) expect(['traditional_conservative', 'national_conservative', 'communitarian']).toContain(id);
    for (const id of top(conservative, 3)) expect(LEFT).not.toContain(id);

    const progressive = match(persona('secular_progressive'));
    expect(progressive.named.length).toBeGreaterThan(0);
    for (const id of progressive.named) expect(LEFT).toContain(id);
    for (const id of top(progressive, 3)) expect(RIGHT).not.toContain(id);

    expect(match(persona('communitarian'))).toMatchObject({ status: 'match', named: ['communitarian'] });
  });

  it('is moved by no worldview or sensitive answer', () => {
    const sensitive = b.topics.flatMap((t) => t.items.filter((it) => isScale(it) && (t.sensitive || it.sensitive)).map((it) => it));
    expect(sensitive.length).toBeGreaterThan(10);
    for (const name of ['libertarian', 'religious_conservative', 'secular_progressive', 'communitarian']) {
      const s = persona(name);
      for (const end of ['first', 'last'] as const) {
        const extra: AnswerEvent[] = sensitive.map((it, i) => ({
          id: `z${String(i).padStart(6, '0')}`,
          item: it.id,
          r: { kind: 'scale', step: end === 'first' ? 1 : isScale(it) ? scalePoints(it) : 1 },
          at: 1e9 + i,
          cv: 'test',
        }));
        const more = buildAnswerState(b, [...s.events, ...extra]);
        expect(match(more), `${name}, sensitive answers at the ${end} step`).toEqual(match(s));
      }
    }
  });

  it('never names answers that only agree or disagree, or sit at one end of every scale', () => {
    const all = { topics: b.topics.map((t) => t.id) };
    for (const dir of ['agree', 'disagree'] as const) expect(match(runRespondent(b, constantPolicy(dir), all).state).status).toBe('insufficient');
    for (const end of ['first', 'last'] as const) {
      const s = runRespondent(b, ({ item }) => (!isScale(item) || item.type === 'importance' ? { kind: 'skip' } : { kind: 'scale', step: end === 'first' ? 1 : scalePoints(item) }), all).state;
      expect(match(s).named, `always the ${end} step`).toEqual([]);
    }
  });

  it('places answers in the middle of every scale closest to centrism', () => {
    // Documented in docs/ANALYSIS.md: "Torn" everywhere follows the centrist sheet closely enough.
    const s = runRespondent(b, ({ item }) => (!isScale(item) || item.type === 'importance' ? { kind: 'skip' } : { kind: 'scale', step: Math.ceil(scalePoints(item) / 2) }), {
      topics: b.topics.map((t) => t.id),
    }).state;
    expect(match(s)).toMatchObject({ status: 'match', named: ['centrist'] });
  });

  it('rarely names random respondents, and favors no tradition', () => {
    const counts = new Map<string, number>();
    let n = 0;
    for (let i = 0; i < 300; i++) {
      const rng = mulberry32(7000 + i);
      const share = i % 2 ? 0.1 + rng() * 0.6 : 1;
      const topics = b.topics.filter(() => rng() < share).map((t) => t.id);
      if (!topics.length) topics.push(b.topics[i % b.topics.length]!.id);
      const f = match(runRespondent(b, randomPolicy({ skipRate: 0.15 }), { seed: 3000 + i, topics }).state);
      if (f.named.length) n++;
      for (const id of f.named) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    expect(n).toBeLessThanOrEqual(30);
    for (const [id, k] of counts) expect(k, id).toBeLessThanOrEqual(9);
  }, 120_000);

  it('finds every tradition in a grid of consistent respondents, and treats left and right alike', () => {
    const steps = [-0.8, -0.4, 0, 0.4, 0.8];
    const questions = [...items.values()].flatMap((it) => {
      if (!isScale(it) || it.type === 'importance') return [];
      const e = it.effects.find((x) => SPECTRUMS.includes(x.target.slice(5)) && x.target.startsWith('axis:'));
      return e ? [{ id: it.id, axis: e.target.slice(5), sign: Math.sign(e.w) }] : [];
    });
    const nearest = new Map(pack.traditions.map((t) => [t.id, 0]));
    const best = { left: [] as number[], right: [] as number[] };
    for (const economic of steps) for (const civil of steps) for (const cultural of steps) for (const diplomatic of steps) {
      const at: Record<string, number> = { economic, civil, cultural, diplomatic };
      const axes: Profile['axes'] = {};
      for (const a of SPECTRUMS) axes[a] = { score: at[a]!, confidence: 1, weight: 10, spread: 0, topics: 5, family: 'political' };
      // Every political question answered at the score of its spectrum, in the direction it counts.
      const answers = new Map(questions.map((q) => [q.id, q.sign * at[q.axis]!]));
      const f = matchTraditions(b, { axes, principles: {} }, pack, answers);
      nearest.set(f.fits[0]!.tradition, nearest.get(f.fits[0]!.tradition)! + 1);
      const lean = (-economic + cultural + diplomatic) / 3;
      if (lean > 0.1) best.left.push(f.fits[0]!.distance);
      if (lean < -0.1) best.right.push(f.fits[0]!.distance);
    }
    for (const [id, cells] of nearest) expect(cells, id).toBeGreaterThanOrEqual(7);
    const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;
    expect(best.left.length).toBe(best.right.length);
    expect(Math.abs(mean(best.left) - mean(best.right))).toBeLessThanOrEqual(0.05);
  });
});
