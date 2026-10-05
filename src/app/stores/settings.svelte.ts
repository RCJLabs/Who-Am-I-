import type { Settings } from '../../model/answers.ts';
import * as db from '../storage/db.ts';
import { ulid } from '../storage/ids.ts';

export class SettingsStore {
  alwaysDeep = $state(false);
  lastBackupAt = $state<number | null>(null);
  /** Stable per-user seed for shuffling unordered options. */
  seed = $state('');
  /** Links from research under Next steps: shown unless turned off, collapsed until opened. */
  showLinks = $state(true);
  linksOpen = $state(false);

  constructor(initial: Partial<Settings>) {
    this.alwaysDeep = initial.alwaysDeep ?? false;
    this.lastBackupAt = initial.lastBackupAt ?? null;
    this.seed = initial.seed ?? ulid();
    this.showLinks = initial.showLinks ?? true;
    this.linksOpen = initial.linksOpen ?? false;
    if (!initial.seed) void this.save();
  }

  /** Back to the defaults, with a new seed: what "Delete all my data" leaves. */
  async reset(): Promise<void> {
    this.alwaysDeep = false;
    this.lastBackupAt = null;
    this.seed = ulid();
    this.showLinks = true;
    this.linksOpen = false;
    await this.save();
  }

  async save(): Promise<void> {
    try {
      await db.putSettings({
        alwaysDeep: this.alwaysDeep,
        lastBackupAt: this.lastBackupAt,
        seed: this.seed,
        showLinks: this.showLinks,
        linksOpen: this.linksOpen,
      });
    } catch {
      // storage unavailable: settings stay in memory
    }
  }
}
