// Answers about you (the Identity domain) are the one part of the answer log that is rewritten:
// a changed answer replaces the old one, removal deletes for real, and backups and restores leave
// them out unless the person ticks a box. See docs/PRIVACY.md.
import type { AnswerEvent } from '../../model/answers.ts';
import { isIdentityItem } from '../../model/content.ts';
import type { AnswerState } from '../../engine/state.ts';

export const isIdentityEvent = (e: { item: string }): boolean => isIdentityItem(e.item);

/** For records read straight from storage, which may not parse. */
export const isStoredIdentity = (raw: unknown): boolean => {
  const item = (raw as { item?: unknown } | null)?.item;
  return typeof item === 'string' && isIdentityItem(item);
};

/**
 * Answers about you the log should no longer hold: every answer to a question but the newest, and,
 * given the log's state, answers to follow-ups that are hidden. Questions the content doesn't have
 * are left to the first rule, since a domain that failed to load looks the same.
 */
export function identityLeftovers(events: readonly AnswerEvent[], s?: AnswerState): AnswerEvent[] {
  const newest = new Map<string, string>();
  for (const e of events) if (isIdentityEvent(e) && e.id > (newest.get(e.item) ?? '')) newest.set(e.item, e.id);
  return events.filter((e) => isIdentityEvent(e) && (newest.get(e.item) !== e.id || s?.visible.get(e.item) === false));
}

export const withoutIdentity = (events: readonly AnswerEvent[]): AnswerEvent[] => events.filter((e) => !isIdentityEvent(e));

export const countIdentity = (events: readonly AnswerEvent[]): number => events.filter(isIdentityEvent).length;
