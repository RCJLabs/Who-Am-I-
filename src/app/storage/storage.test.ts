import 'fake-indexeddb/auto';
import { createStore, set } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AnswerEvent, TensionResolution } from '../../model/answers.ts';
import { makeBackup, mergeById, parseBackup } from './backup.ts';
import { clearAll, loadAll, putEvent, putEvents, putResolution, putSettings } from './db.ts';
import { ulid } from './ids.ts';

const ev = (id: string, item = 'abortion.stance', step = 3): AnswerEvent => ({ id, item, r: { kind: 'scale', step }, at: 1, cv: 'v' });
const res = (id: string): TensionResolution => ({ id, key: 'p|a|b', at: 1, kind: 'acknowledged', basis: ['e1'] });

describe('ulid', () => {
  it('is 26 sortable characters and monotonic within the same millisecond', () => {
    const ids = Array.from({ length: 1000 }, () => ulid(1_700_000_000_000));
    expect(ids[0]).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('sorts by time, and stays monotonic if the clock goes backwards', () => {
    const a = ulid(1_800_000_000_000);
    const b = ulid(1_800_000_000_500);
    const c = ulid(1_700_000_000_000); // clock jumped back
    expect(a < b && b < c).toBe(true);
  });
});

describe('db', () => {
  beforeEach(async () => {
    await clearAll();
  });

  it('round-trips events, resolutions and settings, sorted by id', async () => {
    await putEvent(ev('e2'));
    await putEvents([ev('e3'), ev('e1')]);
    await putResolution(res('r1'));
    await putSettings({ alwaysDeep: true, lastBackupAt: 5, seed: 's', showLinks: false, linksOpen: true });
    const loaded = await loadAll();
    expect(loaded.events.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
    expect(loaded.resolutions.map((r) => r.id)).toEqual(['r1']);
    expect(loaded.settings).toEqual({ alwaysDeep: true, lastBackupAt: 5, seed: 's', showLinks: false, linksOpen: true });
    expect(loaded.dropped).toBe(0);
  });

  it('keeps both writes when two tabs append at the same time', async () => {
    await Promise.all([putEvent(ev('a')), putEvent(ev('b')), putEvents([ev('c'), ev('d')])]);
    expect((await loadAll()).events.map((e) => e.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('skips stored records that no longer validate', async () => {
    await putEvent(ev('ok'));
    await set('broken', { id: 'broken', item: 'x' }, createStore('whoami-events', 'events'));
    const loaded = await loadAll();
    expect(loaded.events.map((e) => e.id)).toEqual(['ok']);
    expect(loaded.dropped).toBe(1);
  });

  it('deletes everything', async () => {
    await putEvent(ev('e1'));
    await putResolution(res('r1'));
    await putSettings({ alwaysDeep: false, lastBackupAt: null, seed: 's', showLinks: true, linksOpen: false });
    await clearAll();
    expect(await loadAll()).toEqual({ events: [], resolutions: [], settings: {}, dropped: 0 });
  });
});

describe('backup', () => {
  const backup = makeBackup({
    events: [ev('e1'), ev('e2', 'abortion.rape', 5)],
    resolutions: [res('r1')],
    settings: { alwaysDeep: false, seed: 'seed' },
    contentVersion: 'cv',
    appVersion: '0.1.0',
    now: new Date('2026-10-02T12:00:00Z'),
  });

  it('round-trips through JSON', () => {
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed).toEqual({ ok: true, backup });
  });

  it('rejects files that are not backups, newer versions, and corrupt ones', () => {
    expect(parseBackup('not json')).toEqual({ ok: false, error: 'not-json' });
    expect(parseBackup('{"format":"something-else"}')).toEqual({ ok: false, error: 'not-backup' });
    expect(parseBackup(JSON.stringify({ ...backup, version: 2 }))).toEqual({ ok: false, error: 'newer-version' });
    expect(parseBackup(JSON.stringify({ ...backup, events: [{ id: 'x' }] }))).toEqual({ ok: false, error: 'invalid' });
  });

  it('ignores unknown fields from newer apps', () => {
    const parsed = parseBackup(JSON.stringify({ ...backup, futureField: 1, events: [{ ...ev('e1'), extra: true }] }));
    expect(parsed.ok && parsed.backup.events[0]).toEqual(ev('e1'));
  });

  it('merges by id, idempotently', () => {
    const a = [ev('e1'), ev('e3')];
    const b = [ev('e2'), ev('e3', 'other.item')];
    const merged = mergeById(a, b);
    expect(merged.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
    expect(merged[2]!.item).toBe('abortion.stance'); // existing record wins
    expect(mergeById(merged, b)).toEqual(merged);
    expect(mergeById(merged, merged)).toEqual(merged);
  });
});
