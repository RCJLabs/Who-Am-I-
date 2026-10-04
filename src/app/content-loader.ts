// Loads domains' content on demand and folds it into the bundle. Plain TypeScript so it can be
// unit-tested; stores/content.svelte.ts mirrors its state for the screens.
import type { AnalysisPack } from '../model/analysis.ts';
import type { Bundle, Topic } from '../model/content.ts';
import { withTopics } from '../engine/bundle-split.ts';

export type Loaders = Readonly<Record<string, () => Promise<{ default: Topic[] }>>>;
export type PackLoad = () => Promise<{ default: AnalysisPack | null }>;

export class ContentLoader {
  private current: Bundle;
  private readonly loaded = new Set<string>();
  private readonly pending = new Map<string, Promise<Topic[]>>();
  private readonly domainOf: ReadonlyMap<string, string>;
  private readonly loaders: Loaders;
  private readonly onChange: (bundle: Bundle, loaded: ReadonlySet<string>) => void;

  constructor(index: Bundle, loaders: Loaders, onChange: (bundle: Bundle, loaded: ReadonlySet<string>) => void = () => {}) {
    this.current = index;
    this.domainOf = new Map(index.topics.map((t) => [t.id, t.domain]));
    this.loaders = loaders;
    this.onChange = onChange;
  }

  get bundle(): Bundle {
    return this.current;
  }

  /** True once a domain's topics have their items (or it has none to load). */
  isLoaded(domain: string): boolean {
    return this.loaded.has(domain) || !this.loaders[domain];
  }

  topicDomain(topicId: string): string | undefined {
    return this.domainOf.get(topicId);
  }

  /**
   * Loads these domains, all at once, and merges whatever arrived in one step so derived state
   * recomputes once. Resolves to false if any failed; a failed domain can be tried again.
   */
  async ensure(domains: Iterable<string>): Promise<boolean> {
    const wanted = [...new Set(domains)].filter((d) => !this.isLoaded(d));
    if (!wanted.length) return true;
    const results = await Promise.allSettled(wanted.map((d) => this.fetch(d)));
    const topics: Topic[] = [];
    const arrived: string[] = [];
    results.forEach((r, i) => {
      const domain = wanted[i]!;
      if (r.status === 'fulfilled' && !this.loaded.has(domain)) {
        topics.push(...r.value);
        arrived.push(domain);
      }
    });
    if (arrived.length) {
      this.current = withTopics(this.current, topics);
      for (const d of arrived) this.loaded.add(d);
      this.onChange(this.current, new Set(this.loaded));
    }
    return results.every((r) => r.status === 'fulfilled');
  }

  /** Loads the domains of these items' topics (item ids are "topic.item"); unknown topics are skipped. */
  ensureForItems(items: Iterable<string>): Promise<boolean> {
    const domains = new Set<string>();
    for (const id of items) {
      const dot = id.indexOf('.');
      const domain = dot > 0 ? this.domainOf.get(id.slice(0, dot)) : undefined;
      if (domain) domains.add(domain);
    }
    return this.ensure(domains);
  }

  ensureAll(): Promise<boolean> {
    return this.ensure(Object.keys(this.loaders));
  }

  private fetch(domain: string): Promise<Topic[]> {
    let p = this.pending.get(domain);
    if (!p) {
      p = this.loaders[domain]!().then((m) => m.default);
      this.pending.set(domain, p);
      p.catch(() => this.pending.delete(domain));
    }
    return p;
  }
}

/**
 * Loads the analysis pack once, on first use. After a failure the next call tries again, though a
 * browser may keep failing the same import until the page reloads.
 */
export class PackLoader {
  private pending: Promise<AnalysisPack | null> | null = null;
  private readonly load: PackLoad;

  constructor(load: PackLoad) {
    this.load = load;
  }

  ensure(): Promise<AnalysisPack | null> {
    if (!this.pending) {
      const p = this.load().then((m) => m.default);
      this.pending = p;
      p.catch(() => {
        if (this.pending === p) this.pending = null;
      });
    }
    return this.pending;
  }
}
