import { describe, expect, it } from 'vitest';
import { compile } from '../src/compiler/compile.ts';
import { loadContentDir } from '../src/compiler/load.ts';
import { formatPretty } from '../src/compiler/report.ts';

describe('real content', () => {
  it('compiles with no errors or warnings', () => {
    const { bundle, diagnostics } = compile(loadContentDir('content'));
    expect(formatPretty(diagnostics)).toBe('');
    expect(bundle).not.toBeNull();
  });
});
