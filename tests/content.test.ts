import { describe, expect, it } from 'vitest';
import { compile } from '../src/compiler/compile.ts';
import { loadContentDir } from '../src/compiler/load.ts';
import { formatPretty } from '../src/compiler/report.ts';

describe('real content', () => {
  const { bundle, analysis, diagnostics } = compile(loadContentDir('content'));

  it('compiles with no errors or warnings', () => {
    expect(formatPretty(diagnostics)).toBe('');
    expect(bundle).not.toBeNull();
  });

  // Circumstances and challenges probe one side's hard cases, so their answers lean one way by
  // design. Scoring them would pull moderates toward one pole; only the overall view counts.
  it('feeds spectrums only from the stance in topics that have one', () => {
    const offenders: string[] = [];
    for (const topic of bundle!.topics) {
      if (!topic.stance) continue;
      for (const item of topic.items) {
        if (item.id === topic.stance) continue;
        const targets = [
          ...('effects' in item ? item.effects.map((e) => e.target) : []),
          ...('options' in item ? item.options.flatMap((o) => ('effects' in o ? o.effects.map((e) => e.target) : [])) : []),
        ];
        if (targets.some((t) => t.startsWith('axis:'))) offenders.push(item.id);
      }
    }
    expect(offenders).toEqual([]);
  });

  // The map dot comes from everything answered and the traditions from shareable answers only;
  // they agree because nothing sensitive feeds a political spectrum.
  it('feeds the political spectrums from no sensitive topic or question', () => {
    const political = new Set(Object.values(bundle!.axes).filter((a) => a.family === 'political').map((a) => `axis:${a.id}`));
    const offenders = bundle!.topics.flatMap((t) =>
      t.items
        .filter((it) => (t.sensitive || it.sensitive) && 'effects' in it && it.effects.some((e) => political.has(e.target)))
        .map((it) => it.id),
    );
    expect(offenders).toEqual([]);
  });

  it('compares traditions only on principles that at least three shareable topics feed', () => {
    expect(analysis).not.toBeNull();
    for (const p of analysis!.compare) {
      const topics = bundle!.topics.filter(
        (t) => !t.sensitive && t.items.some((it) => !it.sensitive && 'effects' in it && it.effects.some((e) => e.target === `principle:${p}`)),
      );
      expect(topics.length, p).toBeGreaterThanOrEqual(3);
    }
  });
});
