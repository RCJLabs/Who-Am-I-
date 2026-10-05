// Hash routes. Hash routing works on GitHub Pages and inside the Android app without server rules.
import { IDENTITY_PREFIX } from '../model/content.ts';

/** The results areas, each with its own page under the overview, in overview order. "you" is About you. */
export const AREAS = ['politics', 'values', 'thinking', 'worldview', 'personality', 'principles', 'tensions', 'positions', 'taste', 'you'] as const;
export type AreaId = (typeof AREAS)[number];
const isArea = (x: string): x is AreaId => (AREAS as readonly string[]).includes(x);

/** The cards that can be shared as images (src/app/share/), in the order they're offered. */
export const CARD_IDS = ['pattern', 'politics', 'values', 'thinking', 'personality', 'principles'] as const;
export type CardId = (typeof CARD_IDS)[number];
export const isCardId = (x: string): x is CardId => (CARD_IDS as readonly string[]).includes(x);

// Answers about you keep their topic and question names out of URLs, so browser history doesn't
// list them: an Identity topic or question is written as a short hash ("~1x2y3z"), which Flow
// matches against the Identity topics. Opaque at a glance, not a secret.
const isIdentityTopic = (topic: string): boolean => topic.startsWith(IDENTITY_PREFIX);

/** FNV-1a in base 36, after "~". */
export function opaque(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return `~${h.toString(36)}`;
}

/** The id a route names, written plainly or as `opaque(id)`. */
export const fromRoute = (token: string, ids: readonly string[]): string | undefined =>
  ids.find((id) => id === token || opaque(id) === token);

export type Route =
  | { name: 'home' }
  | { name: 'topics' }
  | { name: 'flow'; topic: string; edit?: string }
  | { name: 'results' }
  | { name: 'topic-results'; topic: string }
  | { name: 'area'; area: AreaId }
  | { name: 'tension'; key: string }
  | { name: 'share'; card: CardId | null }
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
      if (!second) return { name: 'results' };
      // Answers about you are shown together, behind a tap.
      return isIdentityTopic(second) || second.startsWith('~') ? { name: 'area', area: 'you' } : { name: 'topic-results', topic: second };
    case 'tension':
      return second ? { name: 'tension', key: second } : { name: 'results' };
    case 'area':
      return second && isArea(second) ? { name: 'area', area: second } : { name: 'results' };
    case 'share':
      return { name: 'share', card: second && isCardId(second) ? second : null };
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
  flow: (topic: string, edit?: string) => {
    const name = isIdentityTopic(topic) ? opaque : encodeURIComponent;
    return `#/m/${name(topic)}${edit ? `?edit=${name(edit)}` : ''}`;
  },
  results: () => '#/results',
  topicResults: (topic: string) => (isIdentityTopic(topic) ? '#/area/you' : `#/results/${encodeURIComponent(topic)}`),
  area: (area: AreaId) => `#/area/${area}`,
  tension: (key: string) => `#/tension/${encodeURIComponent(key)}`,
  share: (card?: CardId) => (card ? `#/share/${card}` : '#/share'),
  settings: () => '#/settings',
  about: () => '#/about',
  content: () => '#/content',
};
