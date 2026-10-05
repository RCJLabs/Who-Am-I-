import type { Backup } from '../model/answers.ts';
import { app } from './context.ts';
import { downloadBackup, makeBackup, shareBackup } from './storage/backup.ts';
import { withoutIdentity } from './storage/identity.ts';
import { toasts } from './stores/toasts.svelte.ts';

const WEEK = 7 * 24 * 60 * 60 * 1000;

/** Answers about you are left out unless `includeIdentity`. */
export function currentBackup(includeIdentity = false): Backup {
  const { answers, settings, content } = app();
  return makeBackup({
    events: includeIdentity ? answers.events : withoutIdentity(answers.events),
    resolutions: answers.resolutions,
    settings: { alwaysDeep: settings.alwaysDeep, seed: settings.seed },
    contentVersion: content.bundle.contentVersion,
    appVersion: __APP_VERSION__,
    now: new Date(),
  });
}

/** Resolves whether a backup was made (false if sharing was cancelled). */
export async function saveBackup(kind: 'download' | 'share', includeIdentity = false): Promise<boolean> {
  const backup = currentBackup(includeIdentity);
  if (kind === 'share') {
    if (!(await shareBackup(backup))) return false;
  } else {
    downloadBackup(backup);
  }
  const { settings } = app();
  settings.lastBackupAt = Date.now();
  await settings.save();
  toasts.push('Backup saved.');
  return true;
}

/**
 * Nudge once there's something worth losing and the last backup is missing or stale. Answers about
 * you don't count: the nudge's backup leaves them out.
 */
export function needsBackup(): boolean {
  const { answers, settings } = app();
  const events = withoutIdentity(answers.events);
  if (events.length < 15) return false;
  const last = settings.lastBackupAt;
  if (last === null) return true;
  const newest = events.at(-1)?.at ?? 0;
  return newest > last && Date.now() - last > WEEK;
}
