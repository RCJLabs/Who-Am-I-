// The content bundle, which gains topics' items as their domains load (see content-loader.ts),
// and the analysis pack, loaded once someone has answers to compare.
// Read `bundle` inside $derived or markup: it's replaced, never mutated, when a domain arrives.
import type { AnalysisPack } from '../../model/analysis.ts';
import type { Bundle } from '../../model/content.ts';
import { ContentLoader, PackLoader, type Loaders, type PackLoad } from '../content-loader.ts';

export type AnalysisState = 'idle' | 'loading' | 'ready' | 'failed';

export class ContentStore {
  bundle = $state.raw<Bundle>() as Bundle;
  private loaded = $state.raw<ReadonlySet<string>>(new Set());
  /** Set when answered topics' content couldn't load, so results may be missing answers. */
  error = $state(false);
  /** Political traditions and readings, once loaded; null until then, or if there are none. */
  analysisPack = $state.raw<AnalysisPack | null>(null);
  analysisState = $state<AnalysisState>('idle');
  private readonly loader: ContentLoader;
  private readonly packLoader: PackLoader;
  private packTask: Promise<boolean> | null = null;
  private readonly domains: readonly string[];

  constructor(index: Bundle, loaders: Loaders, loadPack: PackLoad = async () => ({ default: null })) {
    this.loader = new ContentLoader(index, loaders, (bundle, loaded) => {
      this.bundle = bundle;
      this.loaded = loaded;
    });
    this.packLoader = new PackLoader(loadPack);
    this.bundle = index;
    this.domains = Object.keys(loaders);
  }

  /**
   * Loads the analysis pack, once. It reads no reactive state, so an effect can call it without
   * depending on what it sets. Resolves to false if the pack couldn't load.
   */
  ensureAnalysis(): Promise<boolean> {
    if (!this.packTask) {
      this.analysisState = 'loading';
      this.packTask = this.packLoader.ensure().then(
        (pack) => {
          this.analysisPack = pack;
          this.analysisState = 'ready';
          return true;
        },
        () => {
          this.analysisState = 'failed';
          this.packTask = null;
          return false;
        },
      );
    }
    return this.packTask;
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
