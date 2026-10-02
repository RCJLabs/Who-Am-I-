import type { Settings } from '../../model/answers.ts';
import * as db from '../storage/db.ts';
import { ulid } from '../storage/ids.ts';

export class SettingsStore {
  alwaysDeep = $state(false);
  lastBackupAt = $state<number | null>(null);
  /** Stable per-user seed for shuffling unordered options. */
  seed = $state('');

  constructor(initial: Partial<Settings>) {
    this.alwaysDeep = initial.alwaysDeep ?? false;
    this.lastBackupAt = initial.lastBackupAt ?? null;
    this.seed = initial.seed ?? ulid();
    if (!initial.seed) void this.save();
  }

  async save(): Promise<void> {
    try {
      await db.putSettings({ alwaysDeep: this.alwaysDeep, lastBackupAt: this.lastBackupAt, seed: this.seed });
    } catch {
      // storage unavailable: settings stay in memory
    }
  }
}
