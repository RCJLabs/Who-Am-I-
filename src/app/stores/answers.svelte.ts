// The answer log and everything derived from it. Events are plain objects held in $state.raw
// (deep proxies can't be stored in IndexedDB), replaced immutably on every change.
import type { AnswerEvent, Backup, Response, TensionResolution, Via } from '../../model/answers.ts';
import { isIdentityItem, type Bundle, type ItemId } from '../../model/content.ts';
import { observe } from '../../engine/observe.ts';
import { buildProfile } from '../../engine/profile.ts';
import { buildAnswerState } from '../../engine/state.ts';
import { detectTensions } from '../../engine/tensions.ts';
import { mergeById } from '../storage/backup.ts';
import * as db from '../storage/db.ts';
import { identityLeftovers, isIdentityEvent, isStoredIdentity, withoutIdentity } from '../storage/identity.ts';
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
  /** Without sensitive answers, every score recomputed: what the summary and recommendations use. */
  publicProfile = $derived(
    buildProfile(this.state, {
      includeSensitive: false,
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
    const identity = isIdentityItem(item);
    const ev: AnswerEvent = { id: ulid(), item, r, at: Date.now(), cv: this.bundle().contentVersion };
    if (via) ev.via = via;
    // Answers about you never carry free text.
    if (note?.trim() && !identity) ev.note = note.trim();
    const next = [...this.events, ev];
    // An answer about you replaces the last one, and deletes the answers to follow-ups it hides.
    const gone = identity ? new Set(identityLeftovers(next, buildAnswerState(this.bundle(), next))) : new Set<AnswerEvent>();
    this.events = gone.size ? next.filter((e) => !gone.has(e)) : next;
    await this.persist(() => db.writeEvents([ev], [...gone].map((e) => e.id)));
    if (this.events.length === 1) void db.requestPersistence();
    return ev;
  }

  /**
   * Deletes every answer about you, including ones the content no longer asks and stored records
   * that don't parse, and tells other tabs. Tried even after an earlier storage error; false if
   * storage refused.
   */
  async removeIdentity(): Promise<boolean> {
    this.events = withoutIdentity(this.events);
    try {
      await db.deleteEvents(isStoredIdentity);
      this.channel?.postMessage('changed');
      return true;
    } catch {
      this.storageError = true;
      return false;
    }
  }

  async resolve(r: Omit<TensionResolution, 'id' | 'at'>): Promise<void> {
    const full: TensionResolution = { ...r, id: ulid(), at: Date.now() };
    this.resolutions = [...this.resolutions, full];
    await this.persist(() => db.putResolution(full));
  }

  /** `identity`: bring in the file's answers about you too (only the newest of each survives). */
  async importBackup(backup: Backup, mode: 'merge' | 'replace', identity = false): Promise<void> {
    // A plain copy: a reactive proxy can't be stored in IndexedDB, and the write would fail.
    const b = $state.snapshot(backup) as Backup;
    const incoming = identity ? b.events : withoutIdentity(b.events);
    await this.content.ensureForItems(incoming.map((e) => e.item));
    const merged = mode === 'merge' ? mergeById(this.events, incoming) : mergeById([], incoming);
    const gone = new Set(merged.some(isIdentityEvent) ? identityLeftovers(merged, buildAnswerState(this.bundle(), merged)) : []);
    const events = merged.filter((e) => !gone.has(e));
    const resolutions = mode === 'merge' ? mergeById(this.resolutions, b.resolutions) : mergeById([], b.resolutions);
    // Only what's new is written, so nothing already deleted elsewhere is written back.
    const had = new Set(mode === 'merge' ? this.events.map((e) => e.id) : []);
    if (mode === 'replace') await this.persist(() => db.clearAll());
    this.events = events;
    this.resolutions = resolutions;
    await this.persist(async () => {
      await db.writeEvents(
        events.filter((e) => !had.has(e.id)),
        [...gone].filter((e) => had.has(e.id)).map((e) => e.id),
      );
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
