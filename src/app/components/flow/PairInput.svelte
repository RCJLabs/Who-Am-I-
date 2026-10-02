<script lang="ts">
  import type { Response } from '../../../model/answers.ts';
  import type { PairItem } from '../../../model/content.ts';
  import { copy } from '../../copy.ts';

  let {
    item,
    current,
    labelledby,
    onsubmit,
  }: { item: PairItem; current?: Response | undefined; labelledby: string; onsubmit: (r: Response) => void } = $props();

  // Seeded once from the previous answer; the view is remounted for each question.
  const initialChoice = (): string | null => (current?.kind === 'option' ? current.option : null);
  let chosen = $state<string | null>(initialChoice());

  function pick(id: string): void {
    if (!item.strength) onsubmit({ kind: 'option', option: id });
    else chosen = id;
  }
</script>

<div role="group" aria-labelledby={labelledby}>
  <div class="pair">
    {#each item.options as o (o.id)}
      <button type="button" class="side" class:selected={chosen === o.id} aria-pressed={chosen === o.id} data-testid="opt-{item.key}-{o.id}" onclick={() => pick(o.id)}>
        {o.label}
      </button>
    {/each}
  </div>
  {#if item.strength && chosen}
    <div class="btn-row">
      <button class="btn" data-testid="strength-{item.key}-1" onclick={() => onsubmit({ kind: 'option', option: chosen!, strength: 1 })}>{copy.flow.slightly}</button>
      <button class="btn primary" data-testid="strength-{item.key}-2" onclick={() => onsubmit({ kind: 'option', option: chosen!, strength: 2 })}>{copy.flow.strongly}</button>
    </div>
  {/if}
</div>

<style>
  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .side {
    min-height: 96px;
    padding: 14px;
    font: inherit;
    font-weight: 600;
    color: var(--text);
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
  }
  .side.selected {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
</style>
