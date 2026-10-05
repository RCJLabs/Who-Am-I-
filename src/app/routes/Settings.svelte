<script lang="ts">
  import type { Backup } from '../../model/answers.ts';
  import { saveBackup } from '../backup-actions.ts';
  import { app } from '../context.ts';
  import { copy } from '../copy.ts';
  import { to } from '../routes.ts';
  import { canShareFiles, parseBackup } from '../storage/backup.ts';
  import { isPersisted, requestPersistence } from '../storage/db.ts';
  import { countIdentity, isIdentityEvent } from '../storage/identity.ts';
  import { toasts } from '../stores/toasts.svelte.ts';
  import ConfirmDialog from '../components/ConfirmDialog.svelte';
  import Icon from '../components/Icon.svelte';
  import RemoveIdentity from '../components/RemoveIdentity.svelte';

  const { content, answers, settings } = app();

  let persisted = $state<boolean | null>(null);
  // Raw, not deep state: its events go to IndexedDB, which can't store Svelte's proxies.
  let pending = $state.raw<Backup | null>(null);
  let restoreOpen = $state(false);
  let deleteOpen = $state(false);
  let fileInput: HTMLInputElement | undefined = $state();
  const shareable = canShareFiles();
  // Answers about you go into a backup, or come back from one, only when ticked, every time.
  let includeIdentity = $state(false);
  let restoreIdentity = $state(false);
  const hasIdentity = $derived(answers.events.some(isIdentityEvent));
  const fileIdentity = $derived(pending ? countIdentity(pending.events) : 0);

  $effect(() => {
    void isPersisted().then((p) => (persisted = p));
  });

  const lastBackup = $derived(settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleString() : null);

  async function backup(kind: 'download' | 'share'): Promise<void> {
    if (await saveBackup(kind, hasIdentity && includeIdentity)) includeIdentity = false;
  }

  async function onFile(e: Event): Promise<void> {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) {
      toasts.push(copy.settings.backupErrors[parsed.error], 5000);
      return;
    }
    pending = parsed.backup;
    restoreIdentity = false;
    restoreOpen = true;
  }

  async function restore(mode: 'merge' | 'replace'): Promise<void> {
    if (!pending) return;
    await answers.importBackup(pending, mode, restoreIdentity);
    if (pending.settings?.alwaysDeep !== undefined) settings.alwaysDeep = pending.settings.alwaysDeep;
    if (mode === 'replace' && pending.settings?.seed) settings.seed = pending.settings.seed;
    await settings.save();
    pending = null;
    restoreIdentity = false;
    restoreOpen = false;
    toasts.push(copy.settings.restored);
  }

  async function deleteAll(): Promise<void> {
    await answers.clearAll();
    await settings.reset();
    deleteOpen = false;
    toasts.push(copy.settings.deleted);
  }
</script>

<div class="page">
  <h1>{copy.settings.title}</h1>

  <section class="card">
    <h2>{copy.settings.backupTitle}</h2>
    <p class="muted small">{copy.settings.backupExplain}</p>
    <p class="small" data-testid="last-backup">{copy.settings.lastBackup(lastBackup)}</p>
    {#if hasIdentity}
      <label class="toggle include">
        <input type="checkbox" bind:checked={includeIdentity} data-testid="backup-identity" />
        <span>
          {copy.settings.includeIdentity}
          <span class="muted small block">{copy.settings.includeIdentityNote}</span>
        </span>
      </label>
    {/if}
    <div class="stack">
      <button class="btn primary block" onclick={() => backup('download')} data-testid="backup-download">
        <Icon name="download" size={18} />
        {copy.settings.download}
      </button>
      {#if shareable}
        <button class="btn block" onclick={() => backup('share')}>
          <Icon name="share" size={18} />
          {copy.settings.share}
        </button>
      {/if}
      <button class="btn block" onclick={() => fileInput?.click()} data-testid="backup-restore">
        <Icon name="upload" size={18} />
        {copy.settings.restore}
      </button>
      <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={onFile} data-testid="backup-file" />
    </div>
  </section>

  <section class="card">
    <h2>{copy.settings.questionsTitle}</h2>
    <label class="toggle">
      <input type="checkbox" bind:checked={settings.alwaysDeep} onchange={() => settings.save()} />
      <span>
        {copy.settings.alwaysDeep}
        <span class="muted small block">{copy.settings.alwaysDeepNote}</span>
      </span>
    </label>
  </section>

  <section class="card">
    <h2>{copy.settings.resultsTitle}</h2>
    <label class="toggle">
      <input type="checkbox" bind:checked={settings.showLinks} onchange={() => settings.save()} data-testid="setting-links" />
      <span>
        {copy.settings.showLinks}
        <span class="muted small block">{copy.settings.showLinksNote}</span>
      </span>
    </label>
  </section>

  <section class="card">
    <h2>{copy.settings.storageTitle}</h2>
    {#if persisted === true}
      <p class="small">{copy.settings.persisted}</p>
    {:else if persisted === false}
      <p class="small">{copy.settings.notPersisted}</p>
      <button class="btn" onclick={async () => (persisted = await requestPersistence())}>{copy.settings.persist}</button>
    {/if}
  </section>

  {#if hasIdentity}
    <section class="card" data-testid="settings-identity">
      <h2>{copy.settings.identityTitle}</h2>
      <p class="muted small">{copy.settings.identityExplain}</p>
      <RemoveIdentity />
    </section>
  {/if}

  <section class="card">
    <h2>{copy.settings.deleteTitle}</h2>
    <p class="muted small">{copy.settings.deleteExplain}</p>
    <button class="btn danger" onclick={() => (deleteOpen = true)} data-testid="delete-all">
      <Icon name="trash" size={18} />
      {copy.settings.deleteButton}
    </button>
  </section>

  <section class="section links">
    <a href={to.about()}>{copy.settings.aboutLink}</a>
    <a href={to.content()}>{copy.settings.contentLink}</a>
    <p class="muted small">{copy.settings.version(__APP_VERSION__, content.bundle.contentVersion)}</p>
  </section>
</div>

<ConfirmDialog
  bind:open={restoreOpen}
  title={copy.settings.restoreTitle}
  actions={[
    { label: copy.settings.merge, kind: 'primary', onclick: () => restore('merge'), testid: 'restore-merge' },
    { label: copy.settings.replace, onclick: () => restore('replace'), testid: 'restore-replace' },
    { label: copy.settings.cancel, kind: 'ghost', onclick: () => ((restoreOpen = false), (pending = null)) },
  ]}
>
  {#if pending}
    <p>{copy.settings.restoreSummary(pending.events.length, new Date(pending.exportedAt).toLocaleDateString())}</p>
    {#if fileIdentity > 0}
      <label class="toggle include">
        <input type="checkbox" bind:checked={restoreIdentity} data-testid="restore-identity" />
        <span>
          {copy.settings.restoreIdentity(fileIdentity)}
          <span class="muted small block">{copy.settings.restoreIdentityNote}</span>
        </span>
      </label>
    {/if}
  {/if}
</ConfirmDialog>

<ConfirmDialog
  bind:open={deleteOpen}
  title={copy.settings.deleteTitle}
  actions={[
    { label: copy.settings.deleteButton, kind: 'danger', onclick: deleteAll, testid: 'delete-confirm' },
    { label: copy.settings.cancel, kind: 'ghost', onclick: () => (deleteOpen = false) },
  ]}
>
  <p>{copy.settings.deleteConfirm}</p>
</ConfirmDialog>

<style>
  .card {
    margin-top: 16px;
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .toggle {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    cursor: pointer;
  }
  .toggle input {
    width: 22px;
    height: 22px;
    margin-top: 2px;
    accent-color: var(--accent);
  }
  .include {
    margin: 12px 0;
  }
  .block {
    display: block;
  }
  .links {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
</style>
