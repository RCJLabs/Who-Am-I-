import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AnswerEvent, Response } from '../../model/answers.ts';
import { compile } from '../../compiler/compile.ts';
import { loadContentDir } from '../../compiler/load.ts';
import { buildAnswerState } from '../../engine/state.ts';
import { countIdentity, identityLeftovers, isStoredIdentity, withoutIdentity, withoutIdentityNotes } from './identity.ts';

const FIX = 'tests/fixtures/content';
const ABOUT = `id: about_test
domain: identity
title: About test
summary: Fixture.
tier: core
evidence: custom
items:
  - id: gate
    type: choice
    text: Gate?
    options:
      - { id: "yes", label: "Yes" }
      - { id: "no", label: "No" }
  - id: follow
    type: choice
    when: gate is yes
    text: Follow?
    options:
      - { id: a, label: A }
      - { id: b, label: B }
`;

function bundle() {
  const src = { ...loadContentDir(join(FIX, 'base'), [join(FIX, 'good')]), analysis: undefined };
  src.topics.push({ path: 'about_test.yaml', text: ABOUT });
  const { bundle: b, diagnostics } = compile(src);
  if (!b) throw new Error(diagnostics.map((d) => d.message).join('\n'));
  return b;
}

let n = 0;
const ev = (item: string, r: Response): AnswerEvent => {
  n++;
  return { id: `e${String(n).padStart(6, '0')}`, item, r, at: n, cv: 'v' };
};
const pick = (option: string): Response => ({ kind: 'option', option });
const stance = (step: number): Response => ({ kind: 'scale', step });

describe('answers about you', () => {
  const b = bundle();
  /** What record() deletes when `latest` is added to `log`. */
  const leftovers = (log: AnswerEvent[], latest: AnswerEvent): AnswerEvent[] => {
    const next = [...log, latest];
    return identityLeftovers(next, buildAnswerState(b, next));
  };

  it('replace each other, and a change deletes the answers to follow-ups it hides', () => {
    const gate = ev('about_test.gate', pick('yes'));
    const follow = ev('about_test.follow', pick('a'));
    const other = ev('alpha.stance', stance(4));
    const log = [gate, follow, other];
    expect(identityLeftovers(log, buildAnswerState(b, log))).toEqual([]);
    // Answering the follow-up again replaces the first answer, and nothing else.
    expect(leftovers(log, ev('about_test.follow', pick('b')))).toEqual([follow]);
    // "No" hides the follow-up, so its answer goes with the old gate answer.
    expect(leftovers(log, ev('about_test.gate', pick('no')))).toEqual([gate, follow]);
    // Declining hides it too: an unanswered gate hides its follow-ups.
    expect(leftovers(log, ev('about_test.gate', { kind: 'declined' }))).toEqual([gate, follow]);
    // Other answers keep their history.
    expect(leftovers(log, ev('alpha.stance', stance(2)))).toEqual([]);
  });

  it('keep only the newest of each without a state, and never delete for an unknown topic', () => {
    const a = ev('about_gone.q', pick('x'));
    const b2 = ev('about_gone.q', pick('y'));
    const c = ev('about_test.gate', pick('yes'));
    expect(identityLeftovers([b2, a, c])).toEqual([a]);
    // With a state, a question the content doesn't have isn't "hidden": it may just not have loaded.
    const log = [a, c];
    expect(identityLeftovers(log, buildAnswerState(b, log))).toEqual([]);
  });

  it('are left out by the filters backups and restores use', () => {
    const log = [ev('about_test.gate', pick('yes')), ev('alpha.stance', stance(4)), ev('about_gone.q', pick('x'))];
    expect(withoutIdentity(log).map((e) => e.item)).toEqual(['alpha.stance']);
    expect(countIdentity(log)).toBe(2);
    expect(isStoredIdentity({ item: 'about_test.gate' })).toBe(true);
    expect(isStoredIdentity({ item: 'alpha.stance' })).toBe(false);
    expect(isStoredIdentity({ nope: 1 })).toBe(false);
    expect(isStoredIdentity(null)).toBe(false);
  });

  it('never bring free text in from a backup', () => {
    const about = { ...ev('about_test.gate', pick('yes')), note: 'typed elsewhere' };
    const other = { ...ev('alpha.stance', stance(4)), note: 'a reason' };
    const [a, o] = withoutIdentityNotes([about, other]);
    expect(a).not.toHaveProperty('note');
    expect(a).toMatchObject({ id: about.id, item: about.item });
    expect(o).toBe(other);
  });
});
