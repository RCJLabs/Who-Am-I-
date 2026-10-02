<script lang="ts">
  import { needsBackup, saveBackup } from '../backup-actions.ts';
  import { copy } from '../copy.ts';
  import Icon from './Icon.svelte';

  let dismissed = $state(false);
  const show = $derived(!dismissed && needsBackup());
</script>

{#if show}
  <aside class="card nudge" data-testid="backup-nudge">
    <p><Icon name="download" size={18} /> {copy.backupNudge.text}</p>
    <div class="btn-row">
      <button class="btn primary" onclick={() => saveBackup('download')}>{copy.backupNudge.save}</button>
      <button class="btn ghost" onclick={() => (dismissed = true)}>{copy.backupNudge.later}</button>
    </div>
  </aside>
{/if}

<style>
  .nudge {
    margin: 12px 0;
    border-color: var(--accent);
  }
  .nudge p {
    display: flex;
    gap: 8px;
    align-items: center;
    margin: 0;
  }
  .btn-row {
    margin-top: 10px;
  }
</style>
