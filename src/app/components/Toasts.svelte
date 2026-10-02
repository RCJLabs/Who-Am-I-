<script lang="ts">
  import { toasts } from '../stores/toasts.svelte.ts';
</script>

<div class="toasts" role="status" aria-live="polite">
  {#each toasts.list as t (t.id)}
    <div class="toast">{t.text}</div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(var(--nav-h) + 16px + env(safe-area-inset-bottom));
    z-index: 20;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    pointer-events: none;
  }
  .toast {
    max-width: min(92vw, 480px);
    padding: 10px 16px;
    border-radius: 999px;
    background: var(--text);
    color: var(--bg);
    font-size: 0.9rem;
    box-shadow: var(--shadow);
  }
</style>
