import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/compiler/compile.ts';
import { loadContentDir } from '../src/compiler/load.ts';
import { formatGithub, formatPretty } from '../src/compiler/report.ts';
import type { AnalysisSources, ContentSources, Diagnostic, SourceFile } from '../src/compiler/types.ts';

const FIX = 'tests/fixtures/content';
const fixtureSources = (): ContentSources => loadContentDir(join(FIX, 'base'), [join(FIX, 'good')]);

describe('good fixtures', () => {
  const { bundle, diagnostics } = compile(fixtureSources());

  it('compile with no diagnostics', () => {
    expect(formatPretty(diagnostics)).toBe('');
    expect(bundle).not.toBeNull();
  });

  it('qualifies ids and refs, applies defaults and normalizes effects', () => {
    const alpha = bundle!.topics.find((t) => t.id === 'alpha')!;
    expect(alpha.stance).toBe('alpha.stance');
    expect(alpha.importance).toBe('alpha.importance');
    const chCirc = alpha.items.find((i) => i.key === 'ch_circ')!;
    expect(chCirc).toMatchObject({ id: 'alpha.ch_circ', type: 'challenge', targets: 'alpha.circ', sticky: true, deep: false });
    expect(chCirc.when).toEqual({
      op: 'and',
      args: [
        { op: 'cmp', ref: 'alpha.stance', cmp: '<', value: 0 },
        { op: 'cmp', ref: 'alpha.circ', cmp: '>', value: 0 },
      ],
    });
    const stance = alpha.items[0]!;
    expect(stance.type === 'slider' && stance.effects).toEqual([{ target: 'axis:social', w: 1 }]);
    const ch = alpha.items.find((i) => i.key === 'ch_con')!;
    expect(ch.type === 'challenge' && ch.options[2]).toMatchObject({ reaction: 'yield', revise: 'alpha.stance', effects: [{ target: 'principle:autonomy', v: 1 }] });
  });

  it('resolves label presets and defaults unsure per evidence', () => {
    const traits = bundle!.topics.find((t) => t.id === 'traits')!;
    const t1 = traits.items[0]!;
    expect(t1.type === 'likert' && t1.labels[4]).toBe('Very accurate');
    expect(t1.unsure).toBe(false);
    const alpha = bundle!.topics.find((t) => t.id === 'alpha')!;
    expect(alpha.items.find((i) => i.key === 'anchor_auto')!.unsure).toBe(true);
    expect(alpha.items.find((i) => i.key === 'importance')!.unsure).toBe(false);
  });

  it('lists the axes a topic feeds and the principles it anchors, for screens that only have the index', () => {
    const alpha = bundle!.topics.find((t) => t.id === 'alpha')!;
    expect(alpha.feeds).toEqual(['social']);
    expect(alpha.anchors).toEqual(['autonomy', 'life']);
    expect(bundle!.topics.find((t) => t.id === 'tunes')!.anchors).toEqual([]);
  });

  it('flags loaded terms in axis, principle and domain wording, which results quote', () => {
    const src = fixtureSources();
    const withTerm = (f: { path: string; text: string }, from: string, to: string) => ({ ...f, text: f.text.replace(from, to) });
    const { diagnostics: d } = compile({
      ...src,
      principles: withTerm(src.principles, 'definition: Test principle.', 'definition: Never call anyone an anti-vaxxer.'),
      domains: withTerm(src.domains, src.domains.text.match(/blurb: .*/)![0], 'blurb: Not for any baby killer.'),
    });
    const w108 = d.filter((x) => x.code === 'W108');
    expect(w108.map((x) => [x.file, x.message.match(/"(.*)"/)![1]])).toEqual([
      [src.domains.path, 'baby killer'],
      [src.principles.path, 'anti-vaxxer'],
    ]);
  });

  it('orders topics by domain, then order, then id', () => {
    expect(bundle!.topics.map((t) => t.id)).toEqual(['alpha', 'beta', 'gamma', 'traits', 'tunes']);
  });

  it('produces a stable content version', () => {
    expect(compile(fixtureSources()).bundle!.contentVersion).toBe(bundle!.contentVersion);
    expect(bundle!.contentVersion).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe('analysis pack', () => {
  const src = fixtureSources();
  const { bundle, analysis, diagnostics } = compile(src);

  it('compiles beside the content without changing its version', () => {
    expect(formatPretty(diagnostics)).toBe('');
    const without = compile({ ...src, analysis: undefined });
    expect(formatPretty(without.diagnostics)).toBe('');
    expect(without.analysis).toBeNull();
    expect(without.bundle!.contentVersion).toBe(bundle!.contentVersion);
    expect(analysis!.version).toMatch(/^[0-9a-f]{12}$/);
    expect(compile(fixtureSources()).analysis!.version).toBe(analysis!.version);
  });

  it('ships traditions without their side, and resolves what readings argue for', () => {
    expect(analysis!.compare).toEqual(['autonomy', 'life']);
    expect(analysis!.traditions.map((t) => t.id)).toEqual(['reformers', 'planners', 'keepers', 'marketeers', 'moderates']);
    expect(analysis!.traditions.some((t) => 'side' in t)).toBe(false);
    expect(analysis!.traditions[0]!.divided).toEqual([]);
    expect(analysis!.traditions[1]!.divided).toEqual(['life']);
    expect(analysis!.readings['reformers_one']!.about).toEqual({ axis: 'social', pole: 1 });
    expect(analysis!.readings['keepers_one']!.about).toEqual({ axis: 'social', pole: 0 });
    expect(analysis!.readings['reformers_two']).toMatchObject({ kind: 'essay', in: 'Test Journal' });
    expect('about' in analysis!.readings['reformers_two']!).toBe(false);
  });

  it('compiles each link from research, and the norms in the app\'s units', () => {
    expect(analysis!.suggestions).toEqual([
      {
        id: 'helping',
        kind: 'working',
        trait: 'warmth',
        toward: 1,
        strength: 'somewhat',
        outcome: 'interest',
        interest: 'helping and teaching others',
        title: 'Interest in helping and teaching',
        source: 'Ada Trait, Test Journal (2001)',
      },
      {
        id: 'crafts',
        kind: 'free_time',
        trait: 'warmth',
        toward: 0,
        strength: 'little',
        outcome: 'participation',
        interest: 'making things by hand',
        title: 'Making things by hand',
        source: 'Ben Trait, Test Journal (2002)',
      },
    ]);
    // 3.5 on the items' 1-5 scale is 0.25; an SD of 0.8 is 0.4.
    expect(analysis!.norms).toEqual({ warmth: { mean: 0.25, sd: 0.4, reversals: [['traits.t1', 'traits.t2']] } });
    // A link can be read more weakly than its r, never more strongly.
    const G = src.analysis!.suggestions!;
    const weaker = compile({ ...src, analysis: { ...src.analysis!, suggestions: { ...G, text: G.text.replace('r: 0.31,', 'r: 0.31, strength: little,') } } });
    expect(weaker.diagnostics).toEqual([]);
    expect(weaker.analysis!.suggestions[0]).toMatchObject({ id: 'helping', strength: 'little' });
    const stronger = compile({ ...src, analysis: { ...src.analysis!, suggestions: { ...G, text: G.text.replace('r: 0.22,', 'r: 0.22, strength: somewhat,') } } });
    expect(stronger.diagnostics.map((x) => x.code)).toEqual(['E002']);
    // The file is optional: without it, the pack has none.
    const { analysis: a, diagnostics: d } = compile({ ...src, analysis: { ...src.analysis!, suggestions: undefined } });
    expect(d).toEqual([]);
    expect(a).toMatchObject({ suggestions: [], norms: {} });
  });

  it('never rests a link on neuroticism, and needs norms for every trait it reads', () => {
    const axis = (id: string) => `- id: ${id}\n  family: personality\n  title: ${id}\n  description: Test.\n  poles: [Low, High]\n  minWeight: 1\n  fullWeight: 2\n  planned: true\n`;
    const G = src.analysis!.suggestions!;
    const run = (trait: string) => {
      const suggestions = { ...G, text: G.text.replace('trait: warmth, toward: Warm', `trait: ${trait}, toward: High`) };
      return compile({ ...src, axes: { ...src.axes, text: src.axes.text + axis(trait) }, analysis: { ...src.analysis!, suggestions } });
    };
    for (const [trait, message] of [
      ['neuroticism', 'other than neuroticism'],
      ['grit', "No norms for 'grit'"],
    ]) {
      const { analysis: a, diagnostics: d } = run(trait!);
      expect(d.map((x) => [x.code, x.file, x.line])).toEqual([['E016', G.path, 7]]);
      expect(d[0]!.message).toContain(message);
      expect(a).toBeNull();
    }
  });

  it('checks its own loaded terms in the pack only', () => {
    // "view" is in the fixture questions, "sooner" in two split lines.
    const loadedTerms = { path: 'tests/fixtures/content/base/analysis/loaded-terms.txt', text: '# Pack only\nsooner\nview\n' };
    const { analysis: a, diagnostics: d } = compile({ ...src, analysis: { ...src.analysis!, loadedTerms } });
    const T = src.analysis!.traditions!;
    const lines = T.text.split('\n').flatMap((l, i) => (l.includes('sooner') ? [i + 1] : []));
    expect(lines).toHaveLength(2);
    expect(d.map((x) => [x.code, x.file, x.line])).toEqual(lines.map((line) => ['W108', T.path, line]));
    expect(a).not.toBeNull();
    // Without a pack, its terms check nothing.
    expect(compile({ ...src, analysis: { loadedTerms } }).diagnostics).toEqual([]);
  });

  it('needs both files', () => {
    const { analysis: a, diagnostics: d } = compile({ ...src, analysis: { traditions: src.analysis!.traditions! } });
    expect(a).toBeNull();
    const root = src.analysis!.traditions!.text.split('\n').findIndex((l) => l.startsWith('compare:')) + 1;
    expect(d.map((x) => [x.code, x.file, x.line])).toEqual([['E002', src.analysis!.traditions!.path, root]]);
  });

  it('places each tradition from its answer sheet', () => {
    expect(analysis!.traditions.map((t) => [t.id, t.positions, t.principles])).toEqual([
      ['reformers', { social: 0.7, civil: -0.35 }, { autonomy: 0.65, life: -0.15 }],
      // planners split on one of the two life statements, which counts at the middle.
      ['planners', { social: 0.5, civil: 0.65 }, { autonomy: -0.15, life: 0.15 }],
      ['keepers', { social: -0.7, civil: 0.35 }, { autonomy: -0.35, life: 0.85 }],
      ['marketeers', { social: -0.4, civil: -0.65 }, { autonomy: 0.85, life: 0.15 }],
      ['moderates', { social: 0.15, civil: 0 }, { autonomy: 0.15, life: 0.15 }],
    ]);
    // Only the political questions ship, as values -1..1.
    expect(analysis!.traditions[0]!.answers).toEqual({ 'alpha.stance': 0.6667, 'alpha.circ': 1, 'alpha.circ_deep': 0.5, 'beta.stance': -0.3333 });
  });

  it('needs an answer sheet for every tradition, and one each', () => {
    const sheets = src.analysis!.sheets!;
    const T = src.analysis!.traditions!;
    const without = compile({ ...src, analysis: { ...src.analysis!, sheets: sheets.filter((f) => !f.path.endsWith('/keepers.yaml')) } });
    const keepers = T.text.split('\n').findIndex((l) => l.includes('- id: keepers')) + 1;
    expect(without.diagnostics.map((x) => [x.code, x.file, x.line])).toEqual([['E015', T.path, keepers]]);
    const reformers = sheets.find((f) => f.path.endsWith('/reformers.yaml'))!.text;
    const stray = { path: 'tests/fixtures/content/base/analysis/sheets/strays.yaml', text: reformers.replace('tradition: reformers', 'tradition: strays') };
    const twice = { path: 'tests/fixtures/content/base/analysis/sheets/reformers-again.yaml', text: reformers };
    const extra = compile({ ...src, analysis: { ...src.analysis!, sheets: [...sheets, stray, twice] } });
    expect(extra.diagnostics.map((x) => [x.code, x.file, x.line])).toEqual([
      ['E003', twice.path, 2],
      ['E004', stray.path, 2],
    ]);
    expect(extra.analysis).toBeNull();
  });
});

describe('analysis pack lint', () => {
  /** traditions.yaml, readings.yaml, or a tradition's answer sheet. */
  type PackFile = 'traditions' | 'readings' | 'suggestions' | `sheet:${string}`;
  interface Case {
    name: string;
    edits: [PackFile, string, string][];
    /** Code, file, and text on the line it should point at ('' for the file's first line). */
    expect: [string, PackFile, string][];
  }
  const T = 'traditions' as const;
  const R = 'readings' as const;
  const S = (tradition: string): PackFile => `sheet:${tradition}`;
  const G = 'suggestions' as const;
  const ROOT_T = '- id: reformers';
  const ROOT_R = 'id: reformers_one, author: Ada';
  const cases: Case[] = [
    { name: 'E002 an unknown key', edits: [[T, 'adherents: reformers\n', 'adherents: reformers\n    colour: red\n']], expect: [['E002', T, 'colour: red']] },
    { name: 'E002 a reading without a year', edits: [[R, 'title: The Case for Change, year: 1990, ', 'title: The Case for Change, ']], expect: [['E002', R, 'Ada Reform']] },
    { name: 'E003 a neighbour listed twice', edits: [[T, '      - { id: moderates, split: Reformers want change sooner than moderates do. }', '      - { id: moderates, split: Reformers want change sooner than moderates do. }\n      - { id: planners, split: Again. }']], expect: [['E003', T, 'split: Again.']] },
    { name: 'E003 a principle compared twice', edits: [[T, 'compare: [autonomy, life]', 'compare: [autonomy, life, life]']], expect: [['E003', T, 'compare:']] },
    { name: 'E004 an unknown reading', edits: [[T, 'outside: [keepers_one, moderates_one]\n  - id: planners', 'outside: [keepers_one, moderates_none]\n  - id: planners']], expect: [['E004', T, 'moderates_none']] },
    { name: 'E004 an unknown voice', edits: [[R, 'voice: marketeers, note: Argues for a small state.', 'voice: traders, note: Argues for a small state.']], expect: [['E004', R, 'Hal Market']] },
    { name: 'E004 a pole that is not on the spectrum', edits: [[R, 'toward: Progress', 'toward: Forward']], expect: [['E004', R, 'Ada Reform']] },
    { name: 'E004 an unknown question', edits: [[S('reformers'), '  alpha.stance: 6\n', '  alpha.stance: 6\n  alpha.nothing: 3\n']], expect: [['E004', S('reformers'), 'alpha.nothing: 3']] },
    // A sheet's own errors point at its first answer.
    // alpha.stance and alpha.circ still place the spectrum, so only the missing answer is at fault.
    { name: 'E015 every political question answered or divided', edits: [[S('reformers'), '  alpha.circ_deep: 4\n', '']], expect: [['E015', S('reformers'), 'alpha.stance:']] },
    { name: 'E015 only questions that place a tradition', edits: [[S('reformers'), '  alpha.stance: 6\n', '  alpha.stance: 6\n  traits.t1: 3\n']], expect: [['E015', S('reformers'), 'traits.t1: 3']] },
    { name: 'E015 only questions that could be shared', edits: [[S('reformers'), '  alpha.stance: 6\n', '  alpha.stance: 6\n  gamma.belief: 3\n']], expect: [['E015', S('reformers'), 'gamma.belief: 3']] },
    { name: 'E015 only scale questions', edits: [[S('reformers'), '  alpha.stance: 6\n', '  alpha.stance: 6\n  alpha.limit: 2\n']], expect: [['E015', S('reformers'), 'alpha.limit: 2']] },
    { name: 'E015 a step on the scale', edits: [[S('reformers'), 'alpha.circ: 5', 'alpha.circ: 6']], expect: [['E015', S('reformers'), 'alpha.circ: 6']] },
    { name: 'E015 answered or divided, not both', edits: [[S('planners'), '  - beta.anchor_life', '  - beta.anchor_life\n  - alpha.stance']], expect: [['E015', S('planners'), '- alpha.stance']] },
    {
      name: 'E015 every compared principle placed',
      edits: [[T, 'compare: [autonomy, life]', 'compare: [autonomy, life, duty]']],
      expect: ['reformers', 'planners', 'keepers', 'marketeers', 'moderates'].map((t): [string, PackFile, string] => ['E015', S(t), 'alpha.stance:']),
    },
    {
      name: 'E014 two traditions toward each pole',
      edits: [[S('marketeers'), 'alpha.stance: 3\n  alpha.circ: 2\n  alpha.circ_deep: 2', 'alpha.stance: 4\n  alpha.circ: 3\n  alpha.circ_deep: 3']],
      expect: [['E014', T, ROOT_T]],
    },
    {
      name: 'E014 a divided placement does not count toward balance',
      edits: [[S('keepers'), '  alpha.stance: 2\n  alpha.circ: 1\n', ''], [S('keepers'), '  beta.anchor_life: 6\n', '  beta.anchor_life: 6\ndivided:\n  - alpha.stance\n  - alpha.circ\n']],
      expect: [['E014', T, ROOT_T]],
    },
    {
      name: 'E014 left and right within one of each other',
      edits: [[T, 'adherents: marketeers\n    side: right', 'adherents: marketeers\n    side: left']],
      expect: [
        ['E014', T, ROOT_T],
        ['E014', T, 'outside: [marketeers_one, moderates_two]'],
        ['E014', T, 'outside: [planners_one, moderates_two]'],
        ['W111', R, ROOT_R],
      ],
    },
    {
      name: 'E014 neighbours list each other',
      edits: [[T, '      - { id: reformers, split: Planners trust a common plan; reformers trust people to choose. }', '      - { id: moderates, split: Planners plan; moderates step. }']],
      expect: [['E014', T, 'Reformers trust people to choose; planners'], ['E014', T, 'Planners plan; moderates step.']],
    },
    {
      name: 'E014 a tradition is not its own neighbour',
      edits: [[T, '      - { id: keepers, split: Marketeers value free exchange; keepers value order. }', '      - { id: keepers, split: Marketeers value free exchange; keepers value order. }\n      - { id: marketeers, split: Itself. }']],
      expect: [['E014', T, 'split: Itself.']],
    },
    { name: 'E014 inside readings are voiced from inside', edits: [[T, 'inside: [keepers_one, keepers_two]', 'inside: [keepers_one, moderates_two]']], expect: [['E014', T, 'inside: [keepers_one, moderates_two]']] },
    {
      name: 'E014 outside readings are voiced from outside',
      edits: [[R, 'voice: moderates, note: Argues for gradual change.', 'voice: reformers, note: Argues for gradual change.']],
      expect: [['E014', T, 'outside: [keepers_one, moderates_one]'], ['E014', T, 'inside: [moderates_one, moderates_two]']],
    },
    { name: 'E014 the first critique comes from the other side', edits: [[T, 'outside: [keepers_one, moderates_one]', 'outside: [moderates_one, keepers_one]']], expect: [['E014', T, 'outside: [moderates_one, keepers_one]']] },
    {
      name: "E014 a center tradition's first two critiques come one from each side",
      edits: [[T, 'outside: [reformers_two, keepers_two]', 'outside: [reformers_two, planners_two]']],
      expect: [['E014', T, 'outside: [reformers_two, planners_two]']],
    },
    {
      name: 'W108 loaded terms in what users read',
      edits: [
        [T, 'summary: Change the rules when they stop serving people.', 'summary: Change the rules, whatever any anti-vaxxer says.'],
        [R, 'note: Argues that change should be slow.', 'note: Argues against the baby killer charge.'],
      ],
      expect: [['W108', T, 'whatever any anti-vaxxer'], ['W108', R, 'Flo Keep']],
    },
    {
      name: 'W108 and W112 skip titles, authors and where a reading appeared',
      edits: [[R, 'author: Flo Keep, title: Slowly, year: 1975, kind: article, in: Test Review', 'author: Jane Placeholder, title: Slowly Says the Anti-Vaxxer, year: 1975, kind: article, in: The Example Party Review']],
      expect: [],
    },
    {
      name: "W108 the pack's own loaded terms",
      edits: [[T, 'summary: Shared goals, pursued together and on purpose.', 'summary: Shared goals, pursued together and on purpose, as mainstream as it gets.']],
      expect: [['W108', T, 'as mainstream as it gets']],
    },
    { name: 'W112 a party or politician named', edits: [[T, 'split: Keepers value order; marketeers', 'split: As the Example Party says keepers value order; marketeers']], expect: [['W112', T, 'As the Example Party says']] },
    {
      name: 'W111 two inside readings each, and every reading used',
      edits: [[T, 'inside: [planners_one, planners_two]', 'inside: [planners_one]']],
      expect: [['W111', T, 'inside: [planners_one]'], ['W111', R, 'Di Plan']],
    },
    {
      name: 'W111 every reading is listed',
      edits: [[R, "voice: moderates, note: Argues for taking the best of each side. }", "voice: moderates, note: Argues for taking the best of each side. }\n- { id: spare, author: Kim Spare, title: Spare, year: 2010, kind: book, voice: moderates, note: Spare. }"]],
      expect: [['W111', R, 'Kim Spare']],
    },
    {
      name: 'W111 readings voiced from each side stay roughly even',
      edits: [
        [T, 'inside: [reformers_one, reformers_two]', 'inside: [reformers_one, reformers_two, r3, r4, r5]'],
        [R, "voice: moderates, note: Argues for taking the best of each side. }", "voice: moderates, note: Argues for taking the best of each side. }\n- { id: r3, author: A, title: A, year: 2010, kind: book, voice: reformers, note: A. }\n- { id: r4, author: B, title: B, year: 2010, kind: book, voice: reformers, note: B. }\n- { id: r5, author: C, title: C, year: 2010, kind: book, voice: reformers, note: C. }"],
      ],
      expect: [['W111', R, ROOT_R]],
    },
    {
      name: 'W111 critiques from each side stay roughly even',
      edits: [
        [T, 'outside: [reformers_one, moderates_one]', 'outside: [reformers_one, moderates_one, planners_two, reformers_two]'],
        [T, 'outside: [planners_one, moderates_two]', 'outside: [planners_one, moderates_two, reformers_two]'],
      ],
      expect: [['W111', T, ROOT_T]],
    },
    {
      name: 'W111 the poles readings argue for stay within one',
      edits: [
        [R, 'voice: keepers, note: Argues that change should be slow. }', 'voice: keepers, note: Argues that change should be slow., about: { axis: social, toward: Tradition } }'],
        [R, 'voice: marketeers, note: Argues for a small state. }', 'voice: marketeers, note: Argues for a small state., about: { axis: social, toward: Tradition } }'],
      ],
      expect: [['W111', R, ROOT_R]],
    },
    { name: 'E002 an unknown key in a link', edits: [[G, 'kind: working,', 'kind: working, link: x,']], expect: [['E002', G, 'link: x']] },
    { name: 'E003 a link listed twice', edits: [[G, 'id: crafts', 'id: helping']], expect: [['E003', G, 'Making things by hand']] },
    { name: 'E004 an unknown spectrum', edits: [[G, 'trait: warmth, toward: Warm', 'trait: kindness, toward: Warm']], expect: [['E004', G, 'kindness']] },
    { name: 'E004 a pole the spectrum does not have', edits: [[G, 'toward: Cool', 'toward: Chilly']], expect: [['E004', G, 'Chilly']] },
    { name: 'E016 only personality spectrums', edits: [[G, 'trait: warmth, toward: Warm', 'trait: novelty, toward: Novel']], expect: [['E016', G, 'novelty']] },
    { name: 'E016 the evidence bar', edits: [[G, 'r: 0.22', 'r: 0.15']], expect: [['E016', G, 'r: 0.15']] },
    { name: 'E016 a blocked subject, in any form', edits: [[G, 'interest: "helping and teaching others"', 'interest: "helping others with diets"']], expect: [['E016', G, 'with diets']] },
    { name: 'E016 never to the reader', edits: [[G, 'title: Interest in helping and teaching,', 'title: Helping you teach,']], expect: [['E016', G, 'Helping you teach']] },
    { name: 'E016 nothing prescriptive', edits: [[G, 'title: Making things by hand,', 'title: Making what needs to be made,']], expect: [['E016', G, 'needs to be made']] },
    { name: 'E016 no numbers', edits: [[G, 'title: Making things by hand,', 'title: Making 3 things by hand,']], expect: [['E016', G, 'Making 3 things']] },
    { name: 'E016 nothing double-ended', edits: [[G, 'interest: "making things by hand"', 'interest: "making things by hand but also buying them"']], expect: [['E016', G, 'but also']] },
    { name: "E016 never the trait's own questions", edits: [[G, 'title: Interest in helping and teaching,', 'title: Helping cold callers,']], expect: [['E016', G, 'cold callers']] },
    { name: 'E016 a published source', edits: [[G, 'source: "Ben Trait, Test Journal (2002)"', 'source: Original scenario']], expect: [['E016', G, 'Original scenario']] },
    { name: "E016 norms on the items' scale", edits: [[G, 'mean: 3.5', 'mean: 7']], expect: [['E016', G, 'mean: 7']] },
    { name: 'E016 a reversal pairs opposite keys', edits: [[G, 'reversals: [[traits.t1, traits.t2]]', 'reversals: [[traits.t1, traits.t3]]']], expect: [['E016', G, 'traits.t3']] },
    { name: 'E004 a reversal reads the trait', edits: [[G, 'reversals: [[traits.t1, traits.t2]]', 'reversals: [[traits.t1, alpha.stance]]']], expect: [['E004', G, 'alpha.stance']] },
    {
      name: 'W108 and W112 in links, never in their sources',
      edits: [
        [G, 'interest: "helping and teaching others"', 'interest: "helping any anti-vaxxer"'],
        [G, 'title: Making things by hand,', 'title: Making things for the Example Party,'],
        [G, 'source: "Ada Trait, Test Journal (2001)"', 'source: "Ada Trait, Anti-vaxxer Review (2001)"'],
      ],
      expect: [
        ['W108', G, 'id: helping'],
        ['W112', G, 'id: crafts'],
      ],
    },
  ];

  it.each(cases)('$name', ({ edits, expect: want }) => {
    const src = fixtureSources();
    const pack: AnalysisSources = { ...src.analysis! };
    const get = (file: PackFile): SourceFile =>
      file === 'traditions' || file === 'readings' || file === 'suggestions' ? pack[file]! : pack.sheets!.find((f) => f.path.endsWith(`/${file.slice(6)}.yaml`))!;
    for (const [file, from, to] of edits) {
      const f = get(file);
      expect(f.text.split(from).length - 1, `'${from}' must occur once in ${file}`).toBe(1);
      const edited = { ...f, text: f.text.replace(from, to) };
      if (file === 'traditions' || file === 'readings' || file === 'suggestions') pack[file] = edited;
      else pack.sheets = pack.sheets!.map((x) => (x.path === f.path ? edited : x));
    }
    const { analysis, diagnostics } = compile({ ...src, analysis: pack });
    const lineOf = (file: PackFile, text: string) => get(file).text.split('\n').findIndex((l) => l.includes(text)) + 1;
    const got = diagnostics.map((d) => `${d.code} ${d.file}:${d.line}`).sort();
    const expected = want.map(([code, file, text]) => `${code} ${get(file).path}:${lineOf(file, text)}`).sort();
    expect(got, formatPretty(diagnostics)).toEqual(expected);
    expect(analysis === null).toBe(want.some(([code]) => code.startsWith('E')));
  });
});

interface Expected {
  code: string;
  file: string;
  line: number;
}

function parseExpectations(text: string, path: string): Expected[] {
  const header = /^# expect: (.+)$/m.exec(text)?.[1] ?? '';
  return header
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = /^([EW]\d{3})@(?:(\w+):)?(\d+)$/.exec(s);
      if (!m) throw new Error(`bad expectation '${s}' in ${path}`);
      return { code: m[1]!, file: m[2] ? `${FIX}/base/${m[2]}.yaml` : path, line: Number(m[3]) };
    });
}

const key = (d: Expected) => `${d.file}:${String(d.line).padStart(4, '0')}:${d.code}`;
const sorted = (list: Expected[]) => [...list].sort((a, b) => key(a).localeCompare(key(b)));

describe('identity boundary', () => {
  it('stops other topics from depending on an identity answer', () => {
    const src = { ...fixtureSources(), analysis: undefined };
    const choice = 'type: choice\n    text: Q\n    options:\n      - { id: a, label: A }\n      - { id: b, label: B }';
    src.topics.push(
      { path: 'about.yaml', text: `id: about_me\ndomain: identity\ntitle: Me\nsummary: S.\ntier: core\nevidence: custom\nitems:\n  - id: q\n    ${choice}\n` },
      { path: 'peek.yaml', text: `id: peek\ndomain: life\ntitle: Peek\nsummary: S.\ntier: core\nevidence: custom\nitems:\n  - id: q\n    when: about_me.q is a\n    ${choice}\n` },
    );
    const { bundle, diagnostics } = compile(src);
    expect(diagnostics.map((d) => [d.code, d.file, d.line])).toEqual([['E012', 'peek.yaml', 9]]);
    expect(bundle).toBeNull();
  });
});

describe('bad fixtures produce exactly their expected diagnostics', () => {
  const dir = join(FIX, 'bad');
  const files = readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort();

  it.each(files)('%s', (name) => {
    const path = `${dir}/${name}`;
    const text = readFileSync(path, 'utf8');
    // Topic rules only: the bad topics would leave the fixture pack's answer sheets incomplete.
    const src = { ...fixtureSources(), analysis: undefined };
    src.topics.push({ path, text });
    const { bundle, diagnostics } = compile(src);
    const got = sorted(diagnostics.map((d: Diagnostic) => ({ code: d.code, file: d.file, line: d.line })));
    expect(got, formatPretty(diagnostics)).toEqual(sorted(parseExpectations(text, path)));
    const hasErrors = diagnostics.some((d) => d.severity === 'error');
    expect(bundle === null).toBe(hasErrors);
  });
});

describe('reporters', () => {
  const d: Diagnostic = { code: 'E005', severity: 'error', message: 'a: b, c\nd', file: 'x,y.yaml', line: 3, col: 7 };

  it('formats pretty output', () => {
    expect(formatPretty([d])).toBe('x,y.yaml:3:7  error  E005 forward-ref  a: b, c\nd');
  });

  it('escapes GitHub workflow command properties and data', () => {
    expect(formatGithub([d])).toBe('::error file=x%2Cy.yaml,line=3,col=7,title=E005 forward-ref::a: b, c%0Ad');
  });
});
