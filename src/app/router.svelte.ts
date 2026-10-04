import { parseHash, type Route } from './routes.ts';

class Router {
  route = $state<Route>(parseHash(location.hash));
  /** The route before this one, so a page can tell where you came from (null on first load). */
  previous: Route | null = null;
  /** How far each page was scrolled when it was last left, by hash. */
  #scrolled = new Map<string, number>();
  #hash = location.hash;

  constructor() {
    addEventListener('hashchange', () => this.#enter());
  }

  /** Navigate to an href from `to`. `replace` keeps the current entry out of history. */
  go(href: string, opts: { replace?: boolean } = {}): void {
    if (opts.replace) {
      history.replaceState(history.state, '', href);
      this.#enter();
    } else {
      location.hash = href;
    }
  }

  back(fallback: string): void {
    if (history.length > 1) history.back();
    else this.go(fallback, { replace: true });
  }

  /** How far the page at this hash was scrolled when it was last left (0 if never). */
  scrolledAt(hash: string): number {
    return this.#scrolled.get(hash) ?? 0;
  }

  #enter(): void {
    this.#scrolled.set(this.#hash, scrollY);
    this.#hash = location.hash;
    this.previous = this.route;
    this.route = parseHash(location.hash);
    scrollTo(0, 0);
  }
}

export const router = new Router();
