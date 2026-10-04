// The written analysis on the REAL content, for the personas and for random respondents: every
// sentence free of loaded terms and prescriptions, sensitive topics kept out of the summary and
// the next steps, and the politics sentence pointing the way each persona leans.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { composeAnalysis, type Analysis } from '../../src/app/analysis/compose.ts';
import { interestList } from '../../src/app/view.ts';
import { findTerms, parseTerms, termMatchers } from '../../src/compiler/loaded-terms.ts';
import { exploreNext } from '../../src/engine/analysis/explore.ts';
import { analyse } from '../../src/engine/analysis/index.ts';
import { observe } from '../../src/engine/observe.ts';
import { buildProfile } from '../../src/engine/profile.ts';
import { mulberry32 } from '../../src/engine/rng.ts';
import { detectTensions } from '../../src/engine/tensions.ts';
import { realBundle, realPack } from '../helpers.ts';
import { engineTensions, runRespondent, type RunResult } from './harness.ts';
import { personaResponses, randomPolicy, scriptedPolicy } from './policies.ts';

const b = realBundle();
const pack = realPack();
const terms = termMatchers(parseTerms(readFileSync('content/loaded-terms.txt', 'utf8')));
const blocked = termMatchers(parseTerms(readFileSync('content/analysis/blocked-advice.txt', 'utf8')));
const TONE = [/\byou should\b/i, /\byou must\b/i, /\byou are an? \b/i, /\bmost people\b/i, /\bnormal\b/i, /\bwrong\b/i, /%/];
const CONTRAST = /\b(but|though|although|yet|however|despite)\b/i;
// Citations quote published titles verbatim, so (as in lint rule W108) they're left out of the
// loaded-terms check.
const citations = [
  ...b.topics.flatMap((t) => [t.source, ...t.items.map((it) => (it.type === 'challenge' ? it.source : undefined))]),
  ...Object.values(pack?.readings ?? {}).flatMap((r) => [r.title, r.author, r.in]),
  ...(pack?.suggestions ?? []).map((g) => g.source),
].filter((c): c is string => !!c);
const uncited = (text: string): string => citations.reduce((t, c) => t.split(c).join(''), text);
const sensitive = new Set(b.topics.filter((t) => t.sensitive).map((t) => t.id));
const sensitiveWords = new RegExp(
  [...b.topics.filter((t) => t.sensitive).map((t) => t.title), ...Object.values(b.axes).filter((a) => a.family === 'worldview').flatMap((a) => [a.title, ...a.poles])]
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'),
  'i',
);

const MAP_AXES = ['economic', 'civil'];

function profiles(run: RunResult) {
  const o = { appVersion: 'sim', now: '2026-01-01T00:00:00.000Z', resolutions: run.resolutions };
  return { profile: buildProfile(run.state, { ...o, includeSensitive: true }), publicProfile: buildProfile(run.state, { ...o, includeSensitive: false }) };
}

function composeRun(run: RunResult): Analysis {
  const { profile, publicProfile } = profiles(run);
  const tensions = detectTensions(run.state, observe(run.state, { includeSensitive: true }), run.resolutions);
  const facts = analyse({ state: run.state, profile, publicProfile, tensions, mapAxes: MAP_AXES, pack });
  return composeAnalysis({ bundle: b, state: run.state, facts, profile, publicProfile, tensions, interests: interestList(profile.interests, run.state), pack });
}

/** The summary and read-out sentences (not next-step items, whose titles and sources are content). */
function written(a: Analysis): string[] {
  return [a.summary.headline, ...a.summary.sentences, ...Object.values(a.readouts).flatMap((r) => r.sentences)];
}

function everything(a: Analysis): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(a);
  return out;
}

/** The checks every analysis must pass, whoever answered. */
function checkAnalysis(a: Analysis, who: string): void {
  for (const text of everything(a)) {
    expect(findTerms(uncited(text), terms), `${who}: loaded term in ${JSON.stringify(text)}`).toEqual([]);
    expect(text, who).not.toMatch(/undefined|NaN|\bnull\b|\[object/);
  }
  for (const text of written(a)) for (const re of TONE) expect(text, `${who}: ${re} in ${JSON.stringify(text)}`).not.toMatch(re);
  // The self-description and the challenge record are reported side by side, never set against each other.
  for (const text of a.readouts.thinking?.sentences ?? []) expect(text, `${who}: thinking read-out`).not.toMatch(CONTRAST);
  // The summary and next steps never draw on sensitive topics.
  expect(JSON.stringify(a.summary), `${who}: summary`).not.toMatch(sensitiveWords);
  for (const g of a.next) {
    for (const item of g.items) {
      const topics = [...item.testid.matchAll(/^rec-(?:case|explore)-([a-z0-9_]+)/g)].map((m) => m[1]!);
      const fromHref = item.href ? [...decodeURIComponent(item.href).matchAll(/[#/|]([a-z0-9_]+)/g)].map((m) => m[1]!) : [];
      for (const t of [...topics, ...fromHref]) expect(sensitive.has(t), `${who}: next step ${item.testid} uses sensitive ${t}`).toBe(false);
    }
  }
  expect(a.summary.sentences.length, who).toBeLessThanOrEqual(4);
  const reflect = a.next.find((g) => g.id === 'reflect')?.items ?? [];
  expect(reflect.length, who).toBeLessThanOrEqual(3);
  expect(new Set(reflect.map((x) => x.testid)).size, who).toBe(reflect.length);
  expect(a.next.find((g) => g.id === 'explore')?.items.length ?? 0, who).toBeLessThanOrEqual(3);
  // Personal suggestions: at most three, worded as tendencies, never touching a blocked subject.
  const foryou = a.next.find((g) => g.id === 'foryou')?.items ?? [];
  expect(foryou.length, who).toBeLessThanOrEqual(3);
  for (const item of foryou) {
    const text = uncited([item.title, item.detail, item.meta ?? ''].join(' '));
    for (const re of TONE) expect(text, `${who}: ${re} in ${item.testid}`).not.toMatch(re);
    expect(findTerms(text, blocked), `${who}: blocked subject in ${item.testid}`).toEqual([]);
  }
}

describe('analysis of the personas', () => {
  const dir = 'tests/sim/personas';
  const runs = new Map<string, RunResult>();
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.yaml')).sort()) {
    const persona = parse(readFileSync(join(dir, f), 'utf8')) as { topics: string[]; answers: Record<string, number | string | string[]> };
    runs.set(f.replace('.yaml', ''), runRespondent(b, scriptedPolicy(personaResponses(persona.answers)), { topics: persona.topics, tensions: engineTensions, tensionPolicy: () => null }));
  }
  const analyses = new Map([...runs].map(([name, run]) => [name, composeRun(run)]));

  it('passes the wording, tone and privacy checks', () => {
    for (const [name, a] of analyses) checkAnalysis(a, name);
  });

  it('describes each persona leaning the way it answered', () => {
    const politics = (name: string) => analyses.get(name)!.readouts.politics!.sentences[0]!;
    expect(politics('religious_conservative')).toMatch(/toward [^.]*“Tradition”/);
    expect(politics('religious_conservative')).toMatch(/toward [^.]*“Markets”/);
    expect(politics('secular_progressive')).toMatch(/strongly toward “Progress”/);
    expect(politics('secular_progressive')).toMatch(/toward [^.]*“Equality”/);
    expect(politics('libertarian')).toMatch(/strongly toward [^.]*“Markets”/);
    expect(politics('libertarian')).toMatch(/strongly toward [^.]*“Liberty”/);
    expect(politics('communitarian')).toMatch(/toward [^.]*“Authority”/);
    expect(politics('communitarian')).toMatch(/toward [^.]*“Equality”/);
  });

  it('names a political tradition for each persona, with readings from inside it and critiques from outside', () => {
    for (const [name, a] of analyses) {
      expect(a.summary.tradition, name).toMatch(/^Of the political traditions compared here, your answers sit /);
      expect(a.readouts.politics!.sentences.at(-1), name).toBe(a.traditions!.lead);
      const readings = a.next.find((g) => g.id === 'readings')!.items.map((x) => x.meta ?? '');
      expect(readings.some((m) => m.includes('The case for')), name).toBe(true);
      expect(readings.some((m) => m.includes('A critique of')), name).toBe(true);
    }
  });

  it('says the How you think note counts only the self-description, not the challenges', () => {
    const thinking = analyses.get('religious_conservative')!.readouts.thinking!;
    expect(thinking.sentences[1]).toMatch(/^You faced \d+ challenges/);
    expect(thinking.basedOn).toMatch(/^Your self-description is based on \d+ topics?\./);
  });

  it('suggests reading from both sides of firm positions, and never a sensitive topic to explore', () => {
    for (const [name, a] of analyses) {
      const read = a.next.find((g) => g.id === 'read');
      expect(read, name).toBeDefined();
      expect(read!.items.some((x) => x.detail.startsWith('Against')), name).toBe(true);
      expect(read!.items.some((x) => x.detail.startsWith('For')), name).toBe(true);
    }
  });
});

describe('analysis of random respondents', () => {
  let runs: RunResult[] = [];
  let analyses: Analysis[] = [];
  beforeAll(() => {
    runs = Array.from({ length: 200 }, (_, i) => {
      // Even-numbered respondents answer everything; odd ones a random few topics, so explore-next
      // has the whole catalogue, sensitive topics included, to choose from.
      const rng = mulberry32(9000 + i);
      const share = i % 2 ? 0.05 + rng() * 0.45 : 1;
      const topics = b.topics.filter(() => rng() < share).map((t) => t.id);
      if (!topics.length) topics.push(b.topics[i % b.topics.length]!.id);
      return runRespondent(b, randomPolicy({ skipRate: 0.15 }), { seed: 5000 + i, topics });
    });
    analyses = runs.map(composeRun);
  }, 120_000);

  it('passes the wording, tone and privacy checks', () => {
    analyses.forEach((a, i) => checkAnalysis(a, `random #${i}`));
  });

  it('never has a sensitive topic to suggest, however far down the list', () => {
    let suggested = 0;
    runs.forEach((run, i) => {
      const all = exploreNext(run.state, profiles(run).publicProfile, { mapAxes: MAP_AXES }, b.topics.length).map((r) => r.topic);
      suggested += all.length;
      for (const t of all) expect(sensitive.has(t), `random #${i}: ${t}`).toBe(false);
    });
    expect(suggested).toBeGreaterThan(1000);
  });

  it('suggests topics to explore to those who answered a few', () => {
    const partial = analyses.filter((_, i) => i % 2);
    const explored = partial.filter((a) => a.next.find((g) => g.id === 'explore')?.items.length === 3);
    expect(explored.length).toBe(partial.length);
  });
});
