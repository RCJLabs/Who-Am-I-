// The content bundle, which gains topics' items as their domains load (see content-loader.ts).
// Read `bundle` inside $derived or markup: it's replaced, never mutated, when a domain arrives.
import type { Bundle } from '../../model/content.ts';
import { ContentLoader, type Loaders } from '../content-loader.ts';

export class ContentStore {
  bundle = $state.raw<Bundle>() as Bundle;
  private loaded = $state.raw<ReadonlySet<string>>(new Set());
  /** Set when answered topics' content couldn't load, so results may be missing answers. */
  error = $state(false);
  private readonly loader: ContentLoader;
  private readonly domains: readonly string[];

  constructor(index: Bundle, loaders: Loaders) {
    this.loader = new ContentLoader(index, loaders, (bundle, loaded) => {
      this.bundle = bundle;
      this.loaded = loaded;
    });
    this.bundle = index;
    this.domains = Object.keys(loaders);
  }

  /** Whether a domain's topics have their items. Reactive. */
  has(domain: string): boolean {
    return this.loaded.has(domain) || this.loader.isLoaded(domain);
  }

  /** Whether every domain has loaded. Reactive. */
  hasAll(): boolean {
    return this.domains.every((d) => this.has(d));
  }

  topicDomain(topicId: string): string | undefined {
    return this.loader.topicDomain(topicId);
  }

  ensure(domains: Iterable<string>): Promise<boolean> {
    return this.loader.ensure(domains);
  }

  ensureAll(): Promise<boolean> {
    return this.loader.ensureAll();
  }

  /** Loads the domains of answered items, so none of them read as missing. */
  async ensureForItems(items: Iterable<string>): Promise<boolean> {
    const ok = await this.loader.ensureForItems(items);
    if (!ok) this.error = true;
    return ok;
  }
}
