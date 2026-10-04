import { describe, expect, it } from 'vitest';
import type { Bundle, Topic } from '../model/content.ts';
import { splitBundle } from '../engine/bundle-split.ts';
import { realBundle } from '../../tests/helpers.ts';
import type { AnalysisPack } from '../model/analysis.ts';
import { ContentLoader, PackLoader, type Loaders } from './content-loader.ts';

/** Loaders over the real content that count calls and can be made to fail. */
function setup(fail = new Set<string>()) {
  const { index, domains } = splitBundle(realBundle());
  const calls: string[] = [];
  const loaders: Loaders = Object.fromEntries(
    Object.entries(domains).map(([d, topics]) => [
      d,
      async (): Promise<{ default: Topic[] }> => {
        calls.push(d);
        if (fail.has(d)) throw new Error(`offline: ${d}`);
        return { default: topics };
      },
    ]),
  );
  const changes: Bundle[] = [];
  const loader = new ContentLoader(index, loaders, (b) => changes.push(b));
  return { loader, calls, changes, index };
}

const withItems = (b: Bundle) => b.topics.filter((t) => t.items.length).map((t) => t.domain);

describe('loading content by domain', () => {
  it('starts with the index and loads only the domains asked for', async () => {
    const { loader, calls, changes } = setup();
    expect(withItems(loader.bundle)).toEqual([]);
    expect(await loader.ensure(['environment', 'life'])).toBe(true);
    expect(calls.sort()).toEqual(['environment', 'life']);
    expect(new Set(withItems(loader.bundle))).toEqual(new Set(['environment', 'life']));
    expect(changes).toHaveLength(1);
    expect(loader.isLoaded('environment')).toBe(true);
    expect(loader.isLoaded('rights')).toBe(false);
  });

  it('fetches each domain once, even when asked for twice at the same time', async () => {
    const { loader, calls, changes } = setup();
    await Promise.all([loader.ensure(['society']), loader.ensure(['society'])]);
    await loader.ensure(['society']);
    expect(calls).toEqual(['society']);
    expect(changes).toHaveLength(1);
  });

  it("finds answered items' domains, skipping topics it doesn't know", async () => {
    const { loader, calls } = setup();
    expect(await loader.ensureForItems(['climate.stance', 'abortion.stance', 'climate.importance', 'gone.stance', 'nodot'])).toBe(true);
    expect(calls.sort()).toEqual(['environment', 'life']);
  });

  it('reports a failed domain, keeps the rest, and can retry it', async () => {
    const fail = new Set(['economics']);
    const { loader, calls } = setup(fail);
    expect(await loader.ensure(['economics', 'rights'])).toBe(false);
    expect(loader.isLoaded('rights')).toBe(true);
    expect(loader.isLoaded('economics')).toBe(false);
    fail.clear();
    expect(await loader.ensure(['economics'])).toBe(true);
    expect(calls.filter((d) => d === 'economics')).toHaveLength(2);
  });

  it('treats domains without topics as loaded', async () => {
    const { loader, calls } = setup();
    expect(loader.isLoaded('identity')).toBe(true);
    expect(await loader.ensure(['identity'])).toBe(true);
    expect(calls).toEqual([]);
  });

  it('loading everything gives back the compiled bundle', async () => {
    const { loader } = setup();
    expect(await loader.ensureAll()).toBe(true);
    expect(loader.bundle).toEqual(realBundle());
  });
});

describe('loading the analysis pack', () => {
  const pack = { format: 'whoami.analysis', schema: 1, version: 'test', compare: [], traditions: [], readings: {} } as AnalysisPack;
  const counting = (results: (AnalysisPack | null | Error)[]) => {
    const calls = { n: 0 };
    const load = async () => {
      const r = results[Math.min(calls.n++, results.length - 1)]!;
      if (r instanceof Error) throw r;
      return { default: r };
    };
    return { calls, loader: new PackLoader(load) };
  };

  it('loads only when asked, once, however many ask at the same time', async () => {
    const { calls, loader } = counting([pack]);
    expect(calls.n).toBe(0);
    const [a, b] = await Promise.all([loader.ensure(), loader.ensure()]);
    expect(a).toBe(pack);
    expect(b).toBe(pack);
    await loader.ensure();
    expect(calls.n).toBe(1);
  });

  it('resolves to null when there is no pack', async () => {
    expect(await counting([null]).loader.ensure()).toBeNull();
  });

  it('tries again after a failure', async () => {
    const { calls, loader } = counting([new Error('offline'), pack]);
    await expect(loader.ensure()).rejects.toThrow('offline');
    expect(await loader.ensure()).toBe(pack);
    expect(calls.n).toBe(2);
  });
});
