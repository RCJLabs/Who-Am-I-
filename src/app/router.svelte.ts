import { ABOUT_FLOW, isIdentityTopic, routeOf, to, type AboutState, type Route } from './routes.ts';

class Router {
  route = $state<Route>(routeOf(location.hash, history.state));
  /** The route before this one, so a page can tell where you came from (null on first load). */
  previous: Route | null = null;
  /** How far each page was scrolled when it was last left, by hash. */
  #scrolled = new Map<string, number>();
  #hash = location.hash;

  constructor() {
    addEventListener('hashchange', () => this.#enter());
    // Back and Forward between entries at the same address (questions about you share one) change
    // only the history state, which fires no hashchange.
    addEventListener('popstate', () => {
      if (location.hash === this.#hash) this.#enter();
    });
  }

  /**
   * Navigate to an href from `to`. `replace` keeps the current entry out of history; `state` goes
   * with the new entry (and a replaced entry keeps none).
   */
  go(href: string, opts: { replace?: boolean; state?: AboutState } = {}): void {
    if (opts.replace) {
      history.replaceState(opts.state ?? null, '', href);
      this.#enter();
    } else if (opts.state) {
      history.pushState(opts.state, '', href);
      this.#enter();
    } else {
      location.hash = href;
    }
  }

  /** Opens a topic's questions, or one question to change. Topics about you open at their shared address. */
  openFlow(topic: string, edit?: string): void {
    if (!isIdentityTopic(topic)) return this.go(to.flow(topic, edit));
    this.go(ABOUT_FLOW, { state: { about: edit ? { topic, edit } : { topic } } });
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
    this.route = routeOf(location.hash, history.state);
    scrollTo(0, 0);
  }
}

export const router = new Router();
