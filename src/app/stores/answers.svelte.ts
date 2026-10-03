// The answer log and everything derived from it. Events are plain objects held in $state.raw
// (deep proxies can't be stored in IndexedDB), replaced immutably on every change.
import type { AnswerEvent, Backup, Response, TensionResolution, Via } from '../../model/answers.ts';
import type { Bundle, ItemId } from '../../model/content.ts';
import { observe } from '../../engine/observe.ts';
import { buildProfile } from '../../engine/profile.ts';
import { buildAnswerState } from '../../engine/state.ts';
import { detectTensions } from '../../engine/tensions.ts';
import { mergeById } from '../storage/backup.ts';
import * as db from '../storage/db.ts';
import { ulid } from '../storage/ids.ts';
import type { ContentStore } from './content.svelte.ts';

export class AnswersStore {
  readonly content: ContentStore;
  events = $state.raw<readonly AnswerEvent[]>([]);
  resolutions = $state.raw<readonly TensionResolution[]>([]);
  /** Set when the browser refuses to save; answers then live only in memory. */
  storageError = $state(false);

  // $derived is lazy: these run on first read, after the constructor has set `content`.
  // (Read through a method because TypeScript can't see that.) Answers to items whose domain
  // hasn't loaded would read as orphans, so every path that brings in events loads their
  // domains first.
  state = $derived(buildAnswerState(this.bundle(), this.events));
  profile = $derived(
    buildProfile(this.state, {
      includeSensitive: true,
      appVersion: __APP_VERSION__,
      now: new Date().toISOString(),
      resolutions: this.resolutions,
    }),
  );
  tensions = $derived(detectTensions(this.state, observe(this.state, { includeSensitive: true }), this.resolutions));

  private channel: BroadcastChannel | null = null;

  private bundle(): Bundle {
    return this.content.bundle;
  }

  /** `events`' domains must already be loaded (main.ts does that before constructing). */
  constructor(content: ContentStore, events: readonly AnswerEvent[], resolutions: readonly TensionResolution[], storageOk = true) {
    this.content = content;
    this.events = events;
    this.resolutions = resolutions;
    this.storageError = !storageOk;
    if (typeof BroadcastChannel !== 'undefined') {
      // Another tab changed the data: reload it.
      this.channel = new BroadcastChannel('whoami');
      this.channel.addEventListener('message', () => void this.reload());
    }
  }

  private async persist(write: () => Promise<void>): Promise<void> {
    if (this.storageError) return;
    try {
      await write();
      this.channel?.postMessage('changed');
    } catch {
      this.storageError = true;
    }
  }

  async record(item: ItemId, r: Response, via?: Via, note?: string): Promise<AnswerEvent> {
    const ev: AnswerEvent = { id: ulid(), item, r, at: Date.now(), cv: this.bundle().contentVersion };
    if (via) ev.via = via;
    if (note?.trim()) ev.note = note.trim();
    this.events = [...this.events, ev];
    await this.persist(() => db.putEvent(ev));
    if (this.events.length === 1) void db.requestPersistence();
    return ev;
  }

  async resolve(r: Omit<TensionResolution, 'id' | 'at'>): Promise<void> {
    const full: TensionResolution = { ...r, id: ulid(), at: Date.now() };
    this.resolutions = [...this.resolutions, full];
    await this.persist(() => db.putResolution(full));
  }

  async importBackup(backup: Backup, mode: 'merge' | 'replace'): Promise<void> {
    // A plain copy: a reactive proxy can't be stored in IndexedDB, and the write would fail.
    const b = $state.snapshot(backup) as Backup;
    await this.content.ensureForItems(b.events.map((e) => e.item));
    const events = mode === 'merge' ? mergeById(this.events, b.events) : mergeById([], b.events);
    const resolutions = mode === 'merge' ? mergeById(this.resolutions, b.resolutions) : mergeById([], b.resolutions);
    if (mode === 'replace') await this.persist(() => db.clearAll());
    this.events = events;
    this.resolutions = resolutions;
    await this.persist(async () => {
      await db.putEvents(events);
      await db.putResolutions(resolutions);
    });
  }

  async clearAll(): Promise<void> {
    this.events = [];
    this.resolutions = [];
    await this.persist(() => db.clearAll());
  }

  async reload(): Promise<void> {
    try {
      const loaded = await db.loadAll();
      await this.content.ensureForItems(loaded.events.map((e) => e.item));
      this.events = loaded.events;
      this.resolutions = loaded.resolutions;
    } catch {
      // keep what we have
    }
  }
}
