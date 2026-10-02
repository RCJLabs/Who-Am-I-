import { describe, expect, it } from 'vitest';
import { compile } from '../src/compiler/compile.ts';
import { loadContentDir } from '../src/compiler/load.ts';
import { formatPretty } from '../src/compiler/report.ts';

describe('real content', () => {
  const { bundle, diagnostics } = compile(loadContentDir('content'));

  it('compiles with no errors or warnings', () => {
    expect(formatPretty(diagnostics)).toBe('');
    expect(bundle).not.toBeNull();
  });

  // Circumstances and challenges probe one side's hard cases, so their answers lean one way by
  // design. Scoring them would pull moderates toward one pole; only the overall view counts.
  it('feeds political spectrums only from each issue topic’s stance', () => {
    const political = new Set(Object.values(bundle!.axes).filter((a) => a.family === 'political').map((a) => `axis:${a.id}`));
    const offenders: string[] = [];
    for (const topic of bundle!.topics) {
      if (!topic.stance) continue;
      for (const item of topic.items) {
        if (item.id === topic.stance) continue;
        const targets = [
          ...('effects' in item ? item.effects.map((e) => e.target) : []),
          ...('options' in item ? item.options.flatMap((o) => ('effects' in o ? o.effects.map((e) => e.target) : [])) : []),
        ];
        if (targets.some((t) => political.has(t))) offenders.push(item.id);
      }
    }
    expect(offenders).toEqual([]);
  });
});
