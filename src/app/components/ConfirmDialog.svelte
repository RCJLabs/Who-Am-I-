<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Action {
    label: string;
    kind?: 'primary' | 'danger' | 'ghost';
    onclick: () => void;
    testid?: string;
  }

  let {
    open = $bindable(false),
    title,
    children,
    actions,
  }: { open?: boolean; title: string; children?: Snippet; actions: Action[] } = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  const titleId = `dlg-${Math.random().toString(36).slice(2, 8)}`;

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });
</script>

<dialog bind:this={dialog} onclose={() => (open = false)} aria-labelledby={titleId}>
  <h2 id={titleId}>{title}</h2>
  {@render children?.()}
  <div class="btn-row">
    {#each actions as a (a.label)}
      <button class="btn {a.kind ?? ''}" onclick={a.onclick} data-testid={a.testid}>{a.label}</button>
    {/each}
  </div>
</dialog>

<style>
  dialog {
    width: min(92vw, 440px);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    padding: 20px;
    box-shadow: var(--shadow);
  }
  dialog::backdrop {
    background: rgb(0 0 0 / 45%);
  }
  h2 {
    font-size: 1.15rem;
  }
</style>
