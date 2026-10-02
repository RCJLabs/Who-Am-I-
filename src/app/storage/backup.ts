// Backups: a JSON file holding the full answer log. Import is validated; merging is a union by
// id, so importing the same backup twice changes nothing.
import { BackupSchema, type AnswerEvent, type Backup, type Settings, type TensionResolution } from '../../model/answers.ts';

export interface BackupInput {
  events: readonly AnswerEvent[];
  resolutions: readonly TensionResolution[];
  settings: Pick<Settings, 'alwaysDeep' | 'seed'>;
  contentVersion: string;
  appVersion: string;
  now: Date;
}

export function makeBackup(i: BackupInput): Backup {
  return {
    format: 'whoami.backup',
    version: 1,
    exportedAt: i.now.toISOString(),
    appVersion: i.appVersion,
    contentVersion: i.contentVersion,
    events: [...i.events],
    resolutions: [...i.resolutions],
    settings: { alwaysDeep: i.settings.alwaysDeep, seed: i.settings.seed },
  };
}

export type ParseError = 'not-json' | 'not-backup' | 'newer-version' | 'invalid';
export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: ParseError };

export function parseBackup(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'not-json' };
  }
  if (typeof data !== 'object' || data === null || (data as { format?: unknown }).format !== 'whoami.backup') {
    return { ok: false, error: 'not-backup' };
  }
  const version = (data as { version?: unknown }).version;
  if (typeof version === 'number' && version > 1) return { ok: false, error: 'newer-version' };
  const parsed = BackupSchema.safeParse(data);
  return parsed.success ? { ok: true, backup: parsed.data } : { ok: false, error: 'invalid' };
}

/** Union by id (first occurrence wins), sorted by id. Idempotent. */
export function mergeById<T extends { id: string }>(a: readonly T[], b: readonly T[]): T[] {
  const map = new Map<string, T>();
  for (const x of a) map.set(x.id, x);
  for (const x of b) if (!map.has(x.id)) map.set(x.id, x);
  return [...map.values()].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}

export function backupFileName(now: Date): string {
  return `who-am-i-backup-${now.toISOString().slice(0, 10)}.json`;
}

function backupFile(backup: Backup): File {
  return new File([JSON.stringify(backup, null, 2)], backupFileName(new Date(backup.exportedAt)), { type: 'application/json' });
}

/** Saves the backup as a downloaded file. */
export function downloadBackup(backup: Backup): void {
  const file = backupFile(backup);
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function canShareFiles(): boolean {
  try {
    const probe = new File(['{}'], 'probe.json', { type: 'application/json' });
    return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** Opens the system share sheet (best inside the Android app). Resolves false if cancelled. */
export async function shareBackup(backup: Backup): Promise<boolean> {
  try {
    await navigator.share({ files: [backupFile(backup)], title: 'Who Am I backup' });
    return true;
  } catch {
    return false;
  }
}
