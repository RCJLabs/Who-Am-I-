// The content plugin's virtual modules and chunk names, without running Vite.
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AnalysisPack } from '../src/model/analysis.ts';
import { chunkName, contentPlugin } from '../src/compiler/vite-plugin.ts';

type Hook = (this: unknown, id: string) => string | null;

function plugin(dir: string) {
  const p = contentPlugin({ dir });
  const ctx = {
    addWatchFile() {},
    warn() {},
    error(message: string): never {
      throw new Error(message);
    },
  };
  return {
    resolve: (id: string) => (p.resolveId as Hook).call(ctx, id),
    load: (id: string) => (p.load as Hook).call(ctx, id),
  };
}

/** The value a `export default JSON.parse("…")` module exports. */
const exported = (code: string | null): unknown => JSON.parse(JSON.parse(/^export default JSON\.parse\((.*)\);$/s.exec(code ?? '')![1]!) as string);

describe('content plugin', () => {
  it('names chunks so the analysis pack never looks like topic content', () => {
    expect(chunkName('\0virtual:content/economics')).toBe('content-economics');
    expect(chunkName('\0virtual:analysis')).toBe('analysis');
    expect(chunkName('/src/app/routes/Results.svelte')).toBeNull();
    expect(chunkName(null)).toBeNull();
    // The first-visit e2e test (tests/e2e/app.spec.ts) counts topic content chunks with this.
    const contentChunk = /\/assets\/content-([a-z]+)-[^/]*\.js$/;
    expect(contentChunk.test('/Who-Am-I-/assets/analysis-AbC1.js')).toBe(false);
    expect(contentChunk.test('/Who-Am-I-/assets/content-economics-AbC1.js')).toBe(true);
  });

  it('serves the analysis pack as a module of its own', () => {
    const p = plugin('tests/fixtures/content/base');
    const id = p.resolve('virtual:analysis');
    expect(id).toBe('\0virtual:analysis');
    const pack = exported(p.load(id!)) as AnalysisPack;
    expect(pack.format).toBe('whoami.analysis');
    expect(pack.traditions.map((t) => t.id)).toEqual(['reformers', 'planners', 'keepers', 'marketeers', 'moderates']);
  });

  it('serves null when the content has no pack', () => {
    const dir = mkdtempSync(join(tmpdir(), 'whoami-nopack-'));
    try {
      for (const f of ['config.yaml', 'domains.yaml', 'axes.yaml', 'principles.yaml']) cpSync(join('tests/fixtures/content/base', f), join(dir, f));
      const p = plugin(dir);
      expect(exported(p.load(p.resolve('virtual:analysis')!))).toBeNull();
      expect(p.resolve('virtual:other')).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
