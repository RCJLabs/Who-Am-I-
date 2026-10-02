<script lang="ts">
  import { copy } from '../copy.ts';
  import { pwa } from '../pwa.svelte.ts';
  import { toasts } from '../stores/toasts.svelte.ts';

  let announced = false;
  $effect(() => {
    if (pwa.offlineReady && !announced) {
      announced = true;
      toasts.push(copy.update.offline);
    }
  });
</script>

{#if pwa.needRefresh}
  <div class="update" role="status" data-testid="update-banner">
    <span>{copy.update.available}</span>
    <button class="btn primary" onclick={() => pwa.apply()}>{copy.update.reload}</button>
    <button class="btn ghost" onclick={() => pwa.dismiss()}>{copy.update.dismiss}</button>
  </div>
{/if}

<style>
  .update {
    position: fixed;
    left: 50%;
    bottom: calc(var(--nav-h) + 12px + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 10px;
    width: min(94vw, 520px);
    padding: 10px 12px 10px 18px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }
  .update span {
    flex: 1;
    font-size: 0.95rem;
  }
  .update .btn {
    min-height: 40px;
    padding: 0 14px;
  }
</style>
