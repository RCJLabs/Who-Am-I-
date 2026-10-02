<script lang="ts">
  import type { Response } from '../../../model/answers.ts';
  import type { MultiItem } from '../../../model/content.ts';
  import { copy } from '../../copy.ts';

  let {
    item,
    current,
    labelledby,
    onsubmit,
  }: { item: MultiItem; current?: Response | undefined; labelledby: string; onsubmit: (r: Response) => void } = $props();

  // Seeded once from the previous answer; the view is remounted for each question.
  const initialPicks = (): Record<string, number | true> => (current?.kind === 'multi' ? { ...current.picks } : {});
  let picks = $state<Record<string, number | true>>(initialPicks());
  const count = $derived(Object.keys(picks).length);
  const full = $derived(item.max !== undefined && count >= item.max);

  function toggle(id: string): void {
    if (id in picks) delete picks[id];
    else if (!full) picks[id] = item.intensity ? 3 : true;
  }
</script>

<div class="multi" role="group" aria-labelledby={labelledby}>
  <div class="chips">
    {#each item.options as o (o.id)}
      <button
        type="button"
        class="chip-btn"
        class:on={o.id in picks}
        aria-pressed={o.id in picks}
        disabled={full && !(o.id in picks)}
        data-testid="opt-{item.key}-{o.id}"
        onclick={() => toggle(o.id)}
      >
        {o.label}
      </button>
    {/each}
  </div>

  {#if item.intensity && count > 0}
    <p class="muted small rate-title">{copy.flow.rateEach}</p>
    <ul class="rates">
      {#each item.options.filter((o) => o.id in picks) as o (o.id)}
        <li>
          <span>{o.label}</span>
          <span class="stars" role="group" aria-label={o.label}>
            {#each [1, 2, 3, 4, 5] as k (k)}
              <button
                type="button"
                class="star"
                class:on={typeof picks[o.id] === 'number' && (picks[o.id] as number) >= k}
                aria-label="{k} of 5"
                aria-pressed={picks[o.id] === k}
                onclick={() => (picks[o.id] = k)}
              >●</button>
            {/each}
          </span>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="btn-row">
    <button class="btn primary" disabled={count === 0} data-testid="next-{item.key}" onclick={() => onsubmit({ kind: 'multi', picks: $state.snapshot(picks) })}>
      {copy.flow.next}
    </button>
    <button class="btn ghost" data-testid="none-{item.key}" onclick={() => onsubmit({ kind: 'multi', picks: {} })}>{copy.flow.noneOfThese}</button>
  </div>
</div>

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip-btn {
    min-height: 44px;
    padding: 8px 14px;
    border-radius: 999px;
    border: 1.5px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: 0.95rem;
    cursor: pointer;
  }
  .chip-btn.on {
    border-color: var(--accent);
    background: var(--accent-soft);
    font-weight: 600;
  }
  .chip-btn:disabled {
    opacity: 0.45;
  }
  .rate-title {
    margin: 18px 0 6px;
  }
  .rates {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .rates li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px solid var(--border);
  }
  .star {
    width: 36px;
    height: 36px;
    border: none;
    background: none;
    color: var(--track);
    font-size: 1.2rem;
    cursor: pointer;
  }
  .star.on {
    color: var(--accent);
  }
</style>
