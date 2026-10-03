<script lang="ts">
  // How the user handled challenges, as one stacked bar. The three reactions are ordered (from
  // holding firm to reconsidering), so they share one hue that darkens along the order. The
  // legend carries every count as text, so the bar itself is decorative for screen readers.
  import { copy } from '../../copy.ts';
  import type { ChallengeTotals } from '../../view.ts';

  let { totals }: { totals: ChallengeTotals } = $props();

  const parts = $derived(
    (
      [
        { key: 'held', n: totals.held, cls: 's1' },
        { key: 'distinguished', n: totals.distinguished, cls: 's2' },
        { key: 'moved', n: totals.moved, cls: 's3' },
      ] as const
    ).map((p) => ({ ...p, label: copy.results.challengeParts[p.key] })),
  );
  const sum = $derived(parts.reduce((s, p) => s + p.n, 0));
</script>

<div class="challenges" data-testid="challenge-bar">
  <p class="head">
    <strong>{copy.results.challengesTitle}</strong>
    <span class="small muted">{copy.results.challengesTotal(totals.asked)}</span>
  </p>
  {#if sum}
    <div class="bar" aria-hidden="true">
      {#each parts.filter((p) => p.n) as p (p.key)}
        <span class="seg {p.cls}" style:flex-grow={p.n}></span>
      {/each}
    </div>
  {/if}
  <ul class="legend small">
    {#each parts as p (p.key)}
      <li><span class="swatch {p.cls}"></span>{p.label} <strong>{p.n}</strong></li>
    {/each}
  </ul>
</div>

<style>
  .head {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0 0 10px;
  }
  .bar {
    display: flex;
    gap: 2px;
    height: 12px;
  }
  .seg {
    flex-basis: 0;
    min-width: 4px;
  }
  .seg:last-child {
    border-radius: 0 4px 4px 0;
  }
  .s1 {
    background: var(--chart-step-1);
  }
  .s2 {
    background: var(--chart-step-2);
  }
  .s3 {
    background: var(--chart-step-3);
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    list-style: none;
    margin: 10px 0 0;
    padding: 0;
    color: var(--muted);
  }
  .legend li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .legend strong {
    color: var(--text);
  }
  .swatch {
    width: 12px;
    height: 8px;
    border-radius: 2px;
  }
</style>
