// Simulated respondents on the REAL content. These are content-quality tests: keying, centering,
// symmetry and tension behavior. When they fail after a content edit, fix the content (or, with a
// clear reason, the expectation), not the engine.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import type { Response } from '../../src/model/answers.ts';
import { isScale, scalePoints, type Bundle, type Target } from '../../src/model/content.ts';
import { ProfileSchema, type Profile } from '../../src/model/profile.ts';
import { observe } from '../../src/engine/observe.ts';
import { buildProfile } from '../../src/engine/profile.ts';
import { openTensions } from '../../src/engine/tensions.ts';
import { realBundle } from '../helpers.ts';
import { engineTensions, runRespondent, type Policy, type RunResult, type TensionPolicy } from './harness.ts';
import { constantPolicy, ideologyPolicy, personaResponses, randomAnswer, randomPolicy, scriptedPolicy } from './policies.ts';

const b: Bundle = realBundle();
const issueTopics = b.topics.filter((t) => t.stance).map((t) => t.id);
const spectrumAxes = Object.values(b.axes).filter(
  (a) => a.family === 'political' || a.family === 'values' || a.family === 'thinking' || a.family === 'worldview' || a.family === 'taste',
);

function profileOf(run: RunResult): Profile {
  return buildProfile(run.state, { includeSensitive: true, appVersion: 'sim', now: '2026-01-01T00:00:00.000Z', resolutions: run.resolutions });
}

function check(value: number | null | undefined, rule: string, label: string): void {
  const m = /^([<>]=?)\s*(-?\d*\.?\d+)$/.exec(rule.trim());
  if (!m) throw new Error(`bad expectation "${rule}" for ${label}`);
  expect(value, `${label} has no score`).not.toBeNull();
  const v = value as number;
  const bound = Number(m[2]);
  const ok = m[1] === '<' ? v < bound : m[1] === '<=' ? v <= bound : m[1] === '>' ? v > bound : v >= bound;
  expect(ok, `${label} = ${v.toFixed(3)}, expected ${rule}`).toBe(true);
}

describe('personas (hand-written answers; catch keying mistakes)', () => {
  const dir = 'tests/sim/personas';
  const files = readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort();

  it.each(files)('%s', (file) => {
    const persona = parse(readFileSync(join(dir, file), 'utf8')) as {
      topics: string[];
      answers: Record<string, number | string | string[]>;
      expect: {
        axes?: Record<string, string>;
        topicAxes?: Record<string, Record<string, string>>;
        principles?: Record<string, string>;
        topicPrinciples?: Record<string, Record<string, string>>;
        tensions: string[];
      };
    };
    const run = runRespondent(b, scriptedPolicy(personaResponses(persona.answers)), { topics: persona.topics, tensions: engineTensions, tensionPolicy: () => null });
    const p = profileOf(run);

    for (const [axis, rule] of Object.entries(persona.expect.axes ?? {})) check(p.axes[axis]?.score, rule, `axis ${axis}`);
    for (const [pr, rule] of Object.entries(persona.expect.principles ?? {})) check(p.principles[pr]?.score, rule, `principle ${pr}`);
    // Per topic, so one topic's keying mistake can't hide in a profile-wide average.
    const obs = observe(run.state, { includeSensitive: true });
    const topicScore = (topic: string, target: string): number | null => {
      const mine = obs.filter((o) => o.topic === topic && o.target === target);
      const w = mine.reduce((sum, o) => sum + o.w, 0);
      return w > 0 ? mine.reduce((sum, o) => sum + o.w * o.x, 0) / w : null;
    };
    for (const [topic, rules] of Object.entries(persona.expect.topicAxes ?? {})) {
      for (const [axis, rule] of Object.entries(rules)) check(topicScore(topic, `axis:${axis}`), rule, `${topic} on axis ${axis}`);
    }
    for (const [topic, rules] of Object.entries(persona.expect.topicPrinciples ?? {})) {
      for (const [pr, rule] of Object.entries(rules)) check(topicScore(topic, `principle:${pr}`), rule, `${topic} on principle ${pr}`);
    }
    expect(p.tensions.map((t) => t.key).sort()).toEqual([...persona.expect.tensions].sort());

    // Every scripted answer was actually used (catches personas drifting from the content).
    const asked = new Set(run.transcript.map((t) => t.item));
    expect(Object.keys(persona.answers).filter((id) => !asked.has(id))).toEqual([]);
  });
});

describe('acquiescence (agreeing or disagreeing with everything)', () => {
  it.each(['agree', 'disagree'] as const)('%s: no axis pushed to an extreme, and no tensions', (dir) => {
    const run = runRespondent(b, constantPolicy(dir), { tensions: engineTensions, tensionPolicy: () => null });
    const p = profileOf(run);
    for (const a of spectrumAxes) {
      const s = p.axes[a.id]!.score;
      if (s !== null) expect(Math.abs(s), a.id).toBeLessThanOrEqual(0.5);
    }
    expect(p.tensions).toEqual([]);
    expect(run.transcript.filter((t) => t.kind === 'tension')).toEqual([]);
  });
});

describe('random respondents', () => {
  // Built once for the three tests below, in a hook so it runs (and is timed) only when they do.
  let runs: RunResult[] = [];
  beforeAll(() => {
    runs = Array.from({ length: 1000 }, (_, i) => runRespondent(b, randomPolicy({ skipRate: 0.1 }), { seed: i + 1 }));
  }, 120_000);

  it('center on every spectrum axis (mean within 4 standard errors of 0)', () => {
    const profiles = runs.map(profileOf);
    for (const a of spectrumAxes) {
      const scores = profiles.map((p) => p.axes[a.id]!.score).filter((s): s is number => s !== null);
      if (scores.length < 30) continue; // planned axis with no content yet
      const mean = scores.reduce((x, y) => x + y, 0) / scores.length;
      const sd = Math.sqrt(scores.reduce((x, y) => x + (y - mean) ** 2, 0) / scores.length);
      const z = Math.abs(mean) / (sd / Math.sqrt(scores.length));
      expect(z, `${a.id}: mean ${mean.toFixed(3)}, z ${z.toFixed(1)}`).toBeLessThanOrEqual(4);
    }
  });

  it('reach every challenge at least once', () => {
    const seen = new Set(runs.flatMap((r) => r.transcript.map((t) => t.item)));
    const challenges = b.topics.flatMap((t) => t.items).filter((i) => i.type === 'challenge').map((i) => i.id);
    expect(challenges.filter((c) => !seen.has(c))).toEqual([]);
  });

  it('produce schema-valid profiles', () => {
    for (const r of runs.slice(0, 50)) expect(() => ProfileSchema.parse(profileOf(r))).not.toThrow();
  });

  // 500 runs through the whole bank: its own budget rather than the global 30 s.
  it('terminate without asking any item twice (500 runs)', () => {
    for (let seed = 1000; seed < 1500; seed++) {
      const { transcript } = runRespondent(b, randomPolicy({ skipRate: 0.2 }), { seed, tensions: engineTensions, tensionPolicy: () => null });
      const asked = transcript.filter((t) => t.kind === 'item').map((t) => t.item);
      expect(new Set(asked).size, `seed ${seed}`).toBe(asked.length);
    }
  }, 180_000);
});

describe('ideology bots (pipeline sanity; they use the content weights)', () => {
  it.each([
    ['axis:cultural', 1],
    ['axis:cultural', -1],
    ['axis:civil', 1],
    ['axis:civil', -1],
    ['axis:economic', 1],
    ['axis:economic', -1],
    ['axis:diplomatic', 1],
    ['axis:diplomatic', -1],
    ['axis:novelty', 1],
    ['axis:mainstream', -1],
    ['axis:change', 1],
    ['axis:others', -1],
    ['axis:outcomes', 1],
    ['axis:impartiality', -1],
  ] as [Target, number][])('%s toward %i lands on that side', (target, dir) => {
    const run = runRespondent(b, ideologyPolicy({ [target]: dir }, 'hold'));
    const score = profileOf(run).axes[target.slice(5)]!.score!;
    expect(Math.sign(score)).toBe(dir);
    expect(Math.abs(score)).toBeGreaterThanOrEqual(0.4);
  });
});

describe('harness', () => {
  // The default path builds each step's flow state from the current topic's events and asks for
  // tensions only at a topic's end. It must give exactly the runs of the reference loop, which
  // rebuilds everything and asks for tensions at every step, as the app does.
  it('gives the same runs as rebuilding everything at every step, tensions included', () => {
    const tensionPolicy: TensionPolicy = ({ rng }) => (rng() < 0.5 ? { kind: 'acknowledged' } : null);
    for (let seed = 7; seed <= 500; seed += 25) {
      const run = (reference: boolean) =>
        runRespondent(b, randomPolicy({ skipRate: 0.2 }), { seed, tensions: engineTensions, tensionPolicy, reference });
      const fast = run(false);
      const ref = run(true);
      expect(fast.transcript, `seed ${seed}`).toEqual(ref.transcript);
      expect(fast.events, `seed ${seed}`).toEqual(ref.events);
      expect(fast.resolutions, `seed ${seed}`).toEqual(ref.resolutions);
    }
  }, 120_000);
});

describe('tensions on real content', () => {
  const anchorsAt = (step: number): Policy => (ctx) =>
    ctx.item.anchor ? { kind: 'scale', step } : randomAnswer(ctx.item, ctx.rng);

  // 150 runs through the whole bank, with the tension detector at every topic's end: its own budget.
  it('never fire when anchors are answered consistently, however erratic everything else is', () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const step of [1, 4, 7]) {
        const run = runRespondent(b, anchorsAt(step), { seed, tensions: engineTensions, tensionPolicy: () => null });
        expect(openTensions(run.state, run.resolutions), `seed ${seed}, anchors at ${step}`).toEqual([]);
      }
    }
  }, 120_000);
});

describe('challenge behavior on real content', () => {
  // The ideology bot answers a stance from its effects, so it only takes a side on stances that
  // feed a spectrum. Stances with no spectrum are covered by the pinned-extremes test below.
  const toward = (dir: number): Partial<Record<Target, number>> =>
    Object.fromEntries(spectrumAxes.filter((a) => a.family !== 'taste').map((a) => [`axis:${a.id}`, dir]));
  const scoredStance = (id: string): boolean => {
    const t = b.topics.find((x) => x.id === id)!;
    const stance = t.items.find((i) => i.id === t.stance)!;
    return 'effects' in stance && stance.effects.some((e) => e.target.startsWith('axis:'));
  };
  const sidedTopics = issueTopics.filter(scoredStance);

  it('a respondent who always reconsiders gets every move credited to the right challenge', () => {
    const run = runRespondent(b, ideologyPolicy(toward(1), 'yield'), { topics: sidedTopics });
    const p = profileOf(run);
    for (const id of sidedTopics) {
      const c = p.topics[id]!.challenges;
      expect(c.asked, id).toBeGreaterThan(0);
      for (const m of c.moves) expect(m.source.startsWith(`${id}.`), m.source).toBe(true);
    }
    expect(issueTopics.some((id) => p.topics[id]!.challenges.moved > 0)).toBe(true);
  });

  it('a respondent who always holds never moves', () => {
    const run = runRespondent(b, ideologyPolicy(toward(-1), 'hold'), { topics: sidedTopics });
    const p = profileOf(run);
    for (const id of sidedTopics) {
      const c = p.topics[id]!.challenges;
      expect(c.asked, id).toBeGreaterThan(0);
      expect(c.moved, id).toBe(0);
      expect(c.held + c.distinguished, id).toBe(c.asked);
    }
  });

  it.each(['low', 'high'] as const)('every stance extreme gets challenged, even when deep items are skipped (%s end)', (end) => {
    for (const topicId of issueTopics) {
      const topic = b.topics.find((t) => t.id === topicId)!;
      const stance = b.topics.flatMap((t) => t.items).find((i) => i.id === topic.stance)!;
      const extreme = end === 'low' ? 1 : isScale(stance) ? scalePoints(stance) : 1;
      for (let seed = 1; seed <= 20; seed++) {
        const policy: Policy = (ctx) => {
          if (ctx.item.id === topic.stance) return { kind: 'scale', step: extreme };
          if (ctx.item.type === 'importance') return { kind: 'scale', step: 1 };
          return randomAnswer(ctx.item, ctx.rng);
        };
        const run = runRespondent(b, policy, { topics: [topicId], seed });
        const challenged = run.transcript.some((t) => b.topics.flatMap((x) => x.items).find((i) => i.id === t.item)?.type === 'challenge');
        expect(challenged, `${topicId} at step ${extreme}, seed ${seed}`).toBe(true);
      }
    }
  });
});
