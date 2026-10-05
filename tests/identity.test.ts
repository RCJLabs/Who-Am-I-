// About you (the Identity domain) on the real content: who sees which question, and where the
// answers may and may not go.
import { describe, expect, it } from 'vitest';
import type { Response } from '../src/model/answers.ts';
import { IDENTITY_DOMAIN } from '../src/model/content.ts';
import { nextStep } from '../src/engine/flow.ts';
import { buildProfile } from '../src/engine/profile.ts';
import { buildAnswerState } from '../src/engine/state.ts';
import { opaque } from '../src/app/routes.ts';
import { declined, Log, multi, pick, realBundle, scale } from './helpers.ts';

const b = realBundle();
const topics = b.topics.filter((t) => t.domain === IDENTITY_DOMAIN);

/** Answers a topic from a script keyed by item key, and returns the keys asked, in order. */
function walk(topic: string, script: Record<string, Response>, log = new Log()): string[] {
  const asked: string[] = [];
  for (let i = 0; i < 20; i++) {
    const step = nextStep(buildAnswerState(b, log.events), topic);
    if (step.kind === 'done') return asked;
    if (step.kind !== 'item') throw new Error(`unexpected ${step.kind} in ${topic}`);
    const key = step.item.key;
    asked.push(key);
    const r = script[key];
    if (!r) throw new Error(`no scripted answer for ${topic}.${key}`);
    log.add(step.item.id, r);
  }
  throw new Error(`${topic} did not finish`);
}

const picks = (...ids: string[]) => multi(Object.fromEntries(ids.map((id) => [id, true])));

describe('About you', () => {
  it('has the five topics, in order, all plain descriptions with no "No opinion"', () => {
    expect(topics.map((t) => t.id)).toEqual(['about_family', 'about_roots', 'about_faith', 'about_gender', 'about_orientation']);
    for (const t of topics) {
      expect(t.sensitive).toBe(true);
      expect(t.feeds).toEqual([]);
      expect(t.anchors).toEqual([]);
      for (const it of t.items) {
        expect(['choice', 'multi'], it.id).toContain(it.type);
        expect(it.unsure, it.id).toBe(false);
        expect(it.sensitive, it.id).toBe(true);
        if (it.type === 'multi') expect(it.intensity, it.id).toBe(false);
      }
    }
  });

  it('gives every topic and question a distinct hashed URL name', () => {
    const tokens = (ids: string[]) => new Set(ids.map(opaque)).size;
    expect(tokens(b.topics.map((t) => t.id))).toBe(b.topics.length);
    for (const t of topics) expect(tokens(t.items.map((i) => i.key)), t.id).toBe(t.items.length);
  });

  it('asks about attraction only when the words leave room, or when asked to', () => {
    const orientation = (script: Record<string, Response>) => walk('about_orientation', script);
    // Words that say who, or no word at all, and nothing more: two questions.
    for (const word of ['straight', 'gay', 'lesbian', 'bisexual', 'pansexual', 'no_word']) {
      expect(orientation({ words: picks(word), more: pick('no') }), word).toEqual(['words', 'more']);
    }
    // Opting in.
    expect(
      orientation({ words: picks('bisexual'), more: pick('yes'), attraction: pick('yes'), attracted_to: picks('men', 'women'), romantic_same: pick('same') }),
    ).toEqual(['words', 'more', 'attraction', 'attracted_to', 'romantic_same']);
    // Asexual: no attraction is one tap, then whether they fall in love, and with whom.
    expect(orientation({ words: picks('asexual'), attraction: pick('no'), romantic: pick('yes'), romantic_to: picks('women') })).toEqual([
      'words',
      'attraction',
      'romantic',
      'romantic_to',
    ]);
    // Rarely: who, then the full romantic question.
    expect(
      orientation({ words: picks('asexual', 'lesbian'), attraction: pick('rarely'), attracted_to: picks('women'), romantic: pick('rarely'), romantic_to: picks('women') }),
    ).toEqual(['words', 'attraction', 'attracted_to', 'romantic', 'romantic_to']);
    // Asexual, attracted only after a close bond: asked once whether they fall in love, not twice.
    expect(
      orientation({ words: picks('asexual'), attraction: pick('bond'), attracted_to: picks('men'), romantic: pick('yes'), romantic_to: picks('men') }),
    ).toEqual(['words', 'attraction', 'attracted_to', 'romantic', 'romantic_to']);
    // Sexual attraction, but rarely falling in love.
    expect(orientation({ words: picks('queer'), attraction: pick('yes'), attracted_to: picks('non_binary'), romantic_same: pick('rarely') })).toEqual([
      'words',
      'attraction',
      'attracted_to',
      'romantic_same',
    ]);
    // No word, opting in, and falling in love with different kinds of people.
    expect(
      orientation({
        words: picks('no_word'),
        more: pick('yes'),
        attraction: pick('bond'),
        attracted_to: picks('women'),
        romantic_same: pick('different'),
        romantic_to: picks('men'),
      }),
    ).toEqual(['words', 'more', 'attraction', 'attracted_to', 'romantic_same', 'romantic_to']);
    // "Prefer not to say" ends the topic.
    expect(orientation({ words: declined })).toEqual(['words']);
  });

  it('asks the branch only of members of that faith, and about growing up only if raised in one', () => {
    const faith = (religion: string, raised: Response, extra: Record<string, Response> = {}) =>
      walk('about_faith', { religion: pick(religion), raised, raised_part: pick('regular'), ...extra });
    expect(faith('christian', pick('christian'), { christian: picks('catholic') })).toEqual(['religion', 'christian', 'raised', 'raised_part']);
    expect(faith('muslim', pick('muslim'), { muslim: pick('sunni') })).toEqual(['religion', 'muslim', 'raised', 'raised_part']);
    expect(faith('jewish', pick('none'), { jewish: pick('secular') })).toEqual(['religion', 'jewish', 'raised']);
    expect(faith('hindu', declined)).toEqual(['religion', 'raised']);
    expect(faith('none', pick('several'))).toEqual(['religion', 'raised', 'raised_part']);
    // Belonging now and growing up use the same list.
    const options = (key: string) => b.topics.find((t) => t.id === 'about_faith')!.items.find((i) => i.key === key)!;
    expect(options('raised')).toMatchObject({ options: (options('religion') as { options: unknown }).options });
  });

  it('asks how a couple came together only of people who have, or had, a spouse or partner', () => {
    const family = (status: Response) =>
      walk('about_family', { status, how_met: pick('ourselves'), style: pick('one_for_life'), children: picks(), roles: picks('home') });
    expect(family(picks('married'))).toEqual(['status', 'how_met', 'style', 'children', 'roles']);
    expect(family(picks('widowed'))).toEqual(['status', 'how_met', 'style', 'children', 'roles']);
    expect(family(picks('separated', 'seeing'))).toEqual(['status', 'style', 'children', 'roles']);
    expect(family(picks('never_married'))).toEqual(['status', 'style', 'children', 'roles']);
  });

  it('stays in the private profile, keyed by question, and never reaches the public one', () => {
    const log = new Log();
    log.add('abortion.stance', scale(4));
    log.add('about_gender.gender', pick('woman'));
    log.add('about_orientation.words', picks('bisexual', 'queer'));
    log.add('about_family.children', picks());
    const s = buildAnswerState(b, log.events);
    const o = { appVersion: 'test', now: '2026-10-05T00:00:00.000Z', resolutions: [] };
    const priv = buildProfile(s, { ...o, includeSensitive: true });
    expect(priv.identity).toEqual({
      'about_gender.gender': 'A woman',
      'about_orientation.words': ['Bisexual', 'Queer'],
      'about_family.children': ['No children or grandchildren'],
    });
    const pub = buildProfile(s, { ...o, includeSensitive: false });
    expect(pub.identity).toBeUndefined();
    expect(JSON.stringify(pub)).not.toMatch(/about_|Bisexual|Queer|A woman|grandchildren/);
  });
});
