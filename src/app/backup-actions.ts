import type { Backup } from '../model/answers.ts';
import { app } from './context.ts';
import { downloadBackup, makeBackup, shareBackup } from './storage/backup.ts';
import { toasts } from './stores/toasts.svelte.ts';

const WEEK = 7 * 24 * 60 * 60 * 1000;

export function currentBackup(): Backup {
  const { answers, settings, content } = app();
  return makeBackup({
    events: answers.events,
    resolutions: answers.resolutions,
    settings: { alwaysDeep: settings.alwaysDeep, seed: settings.seed },
    contentVersion: content.bundle.contentVersion,
    appVersion: __APP_VERSION__,
    now: new Date(),
  });
}

export async function saveBackup(kind: 'download' | 'share'): Promise<void> {
  const backup = currentBackup();
  if (kind === 'share') {
    if (!(await shareBackup(backup))) return;
  } else {
    downloadBackup(backup);
  }
  const { settings } = app();
  settings.lastBackupAt = Date.now();
  await settings.save();
  toasts.push('Backup saved.');
}

/** Nudge once there's something worth losing and the last backup is missing or stale. */
export function needsBackup(): boolean {
  const { answers, settings } = app();
  if (answers.events.length < 15) return false;
  const last = settings.lastBackupAt;
  if (last === null) return true;
  const newest = answers.events.at(-1)?.at ?? 0;
  return newest > last && Date.now() - last > WEEK;
}
