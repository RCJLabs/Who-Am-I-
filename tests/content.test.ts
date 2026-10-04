import { describe, expect, it } from 'vitest';
import { compile } from '../src/compiler/compile.ts';
import { loadContentDir } from '../src/compiler/load.ts';
import { formatPretty } from '../src/compiler/report.ts';
import { PATTERN_AREAS } from '../src/app/view.ts';

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

  // The map dot comes from everything answered and the traditions from shareable answers only, as
  // do each area's page and the results overview (pattern, firmest leans, the line on each area's
  // link). They agree because nothing sensitive feeds these spectrums.
  it('feeds the political, values, thinking and personality spectrums from no sensitive topic or question', () => {
    const families = new Set<string>(PATTERN_AREAS.map((p) => p.family));
    const shared = new Set(Object.values(bundle!.axes).filter((a) => families.has(a.family)).map((a) => `axis:${a.id}`));
    expect(shared.size).toBeGreaterThanOrEqual(12);
    const offenders = bundle!.topics.flatMap((t) =>
      t.items
        .filter((it) => {
          if (!t.sensitive && !it.sensitive) return false;
          const targets = [
            ...('effects' in it ? it.effects.map((e) => e.target) : []),
            ...('options' in it ? it.options.flatMap((o) => ('effects' in o ? o.effects.map((e) => e.target) : [])) : []),
          ];
          return targets.some((x) => shared.has(x));
        })
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
