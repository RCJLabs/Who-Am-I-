import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/compiler/compile.ts';
import { loadContentDir } from '../src/compiler/load.ts';
import { formatGithub, formatPretty } from '../src/compiler/report.ts';
import type { ContentSources, Diagnostic } from '../src/compiler/types.ts';

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

describe('bad fixtures produce exactly their expected diagnostics', () => {
  const dir = join(FIX, 'bad');
  const files = readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort();

  it.each(files)('%s', (name) => {
    const path = `${dir}/${name}`;
    const text = readFileSync(path, 'utf8');
    const src = fixtureSources();
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
