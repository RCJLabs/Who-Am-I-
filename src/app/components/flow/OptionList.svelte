<script lang="ts">
  // Full-width answer buttons. Tapping one answers immediately.
  let {
    options,
    selected,
    labelledby,
    onselect,
  }: {
    options: { key: string; label: string; testid: string }[];
    selected?: string | undefined;
    labelledby: string;
    onselect: (key: string) => void;
  } = $props();
</script>

<div class="options" role="group" aria-labelledby={labelledby}>
  {#each options as o (o.key)}
    <button
      type="button"
      class="option"
      class:selected={selected === o.key}
      aria-pressed={selected === o.key}
      data-testid={o.testid}
      onclick={() => onselect(o.key)}
    >
      {o.label}
    </button>
  {/each}
</div>

<style>
  .options {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .option {
    width: 100%;
    min-height: 52px;
    padding: 12px 16px;
    text-align: left;
    font: inherit;
    color: var(--text);
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease, transform 0.08s ease;
  }
  .option:hover {
    border-color: var(--accent);
  }
  .option:active {
    transform: scale(0.99);
  }
  .option.selected {
    border-color: var(--accent);
    background: var(--accent-soft);
    font-weight: 600;
  }
</style>
