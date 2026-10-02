import { parseHash, type Route } from './routes.ts';

class Router {
  route = $state<Route>(parseHash(location.hash));

  constructor() {
    addEventListener('hashchange', () => {
      this.route = parseHash(location.hash);
      scrollTo(0, 0);
    });
  }

  /** Navigate to an href from `to`. `replace` keeps the current entry out of history. */
  go(href: string, opts: { replace?: boolean } = {}): void {
    if (opts.replace) {
      history.replaceState(history.state, '', href);
      this.route = parseHash(location.hash);
      scrollTo(0, 0);
    } else {
      location.hash = href;
    }
  }

  back(fallback: string): void {
    if (history.length > 1) history.back();
    else this.go(fallback, { replace: true });
  }
}

export const router = new Router();
