// Hash routes. Hash routing works on GitHub Pages and inside the Android app without server rules.

/** The results areas, each with its own page under the overview, in overview order. */
export const AREAS = ['politics', 'values', 'thinking', 'worldview', 'personality', 'principles', 'tensions', 'positions', 'taste'] as const;
export type AreaId = (typeof AREAS)[number];
const isArea = (x: string): x is AreaId => (AREAS as readonly string[]).includes(x);

export type Route =
  | { name: 'home' }
  | { name: 'topics' }
  | { name: 'flow'; topic: string; edit?: string }
  | { name: 'results' }
  | { name: 'topic-results'; topic: string }
  | { name: 'area'; area: AreaId }
  | { name: 'tension'; key: string }
  | { name: 'settings' }
  | { name: 'about' }
  | { name: 'content' }
  | { name: 'not-found'; path: string };

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [path = '/', query = ''] = raw.split('?');
  const params = new URLSearchParams(query);
  const parts = path
    .split('/')
    .filter(Boolean)
    .map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    });
  const [first, second] = parts;
  switch (first) {
    case undefined:
      return { name: 'home' };
    case 'topics':
      return { name: 'topics' };
    case 'm': {
      if (!second) return { name: 'topics' };
      const edit = params.get('edit');
      return edit ? { name: 'flow', topic: second, edit } : { name: 'flow', topic: second };
    }
    case 'results':
      return second ? { name: 'topic-results', topic: second } : { name: 'results' };
    case 'tension':
      return second ? { name: 'tension', key: second } : { name: 'results' };
    case 'area':
      return second && isArea(second) ? { name: 'area', area: second } : { name: 'results' };
    case 'settings':
      return { name: 'settings' };
    case 'about':
      return { name: 'about' };
    case 'content':
      return { name: 'content' };
    default:
      return { name: 'not-found', path };
  }
}

/** Builds an href for a route. */
export const to = {
  home: () => '#/',
  topics: () => '#/topics',
  flow: (topic: string, edit?: string) => `#/m/${encodeURIComponent(topic)}${edit ? `?edit=${encodeURIComponent(edit)}` : ''}`,
  results: () => '#/results',
  topicResults: (topic: string) => `#/results/${encodeURIComponent(topic)}`,
  area: (area: AreaId) => `#/area/${area}`,
  tension: (key: string) => `#/tension/${encodeURIComponent(key)}`,
  settings: () => '#/settings',
  about: () => '#/about',
  content: () => '#/content',
};
