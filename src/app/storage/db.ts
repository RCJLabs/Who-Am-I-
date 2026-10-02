// On-device storage (IndexedDB via idb-keyval). One key per answer event, so two tabs appending
// at the same time can't overwrite each other. Records are validated on load; anything that no
// longer parses is skipped rather than crashing the app.
import { clear, createStore, entries, set, setMany, values, type UseStore } from 'idb-keyval';
import {
  AnswerEventSchema,
  SettingsSchema,
  TensionResolutionSchema,
  type AnswerEvent,
  type Settings,
  type TensionResolution,
} from '../../model/answers.ts';

let eventsStore: UseStore | null = null;
let kvStore: UseStore | null = null;
// Created lazily so importing this module never touches IndexedDB.
const eventsDb = (): UseStore => (eventsStore ??= createStore('whoami-events', 'events'));
const kvDb = (): UseStore => (kvStore ??= createStore('whoami-kv', 'kv'));

export interface Loaded {
  events: AnswerEvent[];
  resolutions: TensionResolution[];
  settings: Partial<Settings>;
  /** Stored records that failed validation and were skipped. */
  dropped: number;
}

const byId = (a: { id: string }, b: { id: string }): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export async function loadAll(): Promise<Loaded> {
  const [rawEvents, rawKv] = await Promise.all([values(eventsDb()), entries(kvDb())]);
  let dropped = 0;
  const events: AnswerEvent[] = [];
  for (const raw of rawEvents) {
    const p = AnswerEventSchema.safeParse(raw);
    if (p.success) events.push(p.data);
    else dropped++;
  }
  const resolutions: TensionResolution[] = [];
  let settings: Partial<Settings> = {};
  for (const [key, raw] of rawKv) {
    if (typeof key === 'string' && key.startsWith('res:')) {
      const p = TensionResolutionSchema.safeParse(raw);
      if (p.success) resolutions.push(p.data);
      else dropped++;
    } else if (key === 'settings') {
      const p = SettingsSchema.partial().safeParse(raw);
      if (p.success) settings = p.data;
    }
  }
  return { events: events.sort(byId), resolutions: resolutions.sort(byId), settings, dropped };
}

export function putEvent(ev: AnswerEvent): Promise<void> {
  return set(ev.id, ev, eventsDb());
}

export function putEvents(evs: readonly AnswerEvent[]): Promise<void> {
  return setMany(evs.map((e) => [e.id, e]), eventsDb());
}

export function putResolution(r: TensionResolution): Promise<void> {
  return set(`res:${r.id}`, r, kvDb());
}

export function putResolutions(rs: readonly TensionResolution[]): Promise<void> {
  return setMany(rs.map((r) => [`res:${r.id}`, r]), kvDb());
}

export function putSettings(s: Settings): Promise<void> {
  return set('settings', s, kvDb());
}

export async function clearAll(): Promise<void> {
  await Promise.all([clear(eventsDb()), clear(kvDb())]);
}

/** Ask the browser not to evict our storage under pressure. Returns whether storage is persistent. */
export async function requestPersistence(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch {
    return false;
  }
}

export async function isPersisted(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persisted) return false;
  try {
    return await navigator.storage.persisted();
  } catch {
    return false;
  }
}
