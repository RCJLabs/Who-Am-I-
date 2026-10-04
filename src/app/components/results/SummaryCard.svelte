<script lang="ts">
  // The top of the results overview: a headline, a few sentences on what the answers add up to, and
  // three numbers. The numbers are plain stat tiles: the value is the chart.
  import type { Summary } from '../../analysis/compose.ts';
  import { copy } from '../../copy.ts';

  let {
    summary,
    footer,
    tensionsHref,
  }: {
    summary: Summary;
    footer: string;
    /** Where "See where" on the open tensions tile goes. */
    tensionsHref: string;
  } = $props();
</script>

<section class="card summary" data-testid="results-summary" aria-labelledby="summary-headline">
  <p class="kicker small muted">{copy.analysis.summaryTitle}</p>
  <h2 id="summary-headline" class="headline" data-testid="summary-headline">{summary.headline}</h2>
  {#if summary.sentences.length}
    <p class="lede">{summary.sentences.join(' ')}</p>
  {/if}
  {#if summary.tradition}
    <p class="tradition" data-testid="summary-tradition">{summary.tradition}</p>
  {/if}
  <dl class="tiles">
    {#each summary.tiles as t (t.id)}
      <div class="tile" data-testid="stat-{t.id}">
        <dt class="small muted">{t.label}</dt>
        <dd>
          <span class="value display">{t.value}</span>
          {#if t.id === 'tensions' && t.value > 0}
            <a class="small" href={tensionsHref}>{t.detail}</a>
          {:else if t.id !== 'tensions' && t.detail}
            <span class="small muted">{t.detail}</span>
          {/if}
        </dd>
      </div>
    {/each}
  </dl>
  <p class="small muted footer">{footer}</p>
</section>

<style>
  .summary {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px 18px 18px;
    border-radius: 22px;
  }
  .kicker {
    margin: 0;
    font-weight: 600;
  }
  .headline {
    margin: 0;
    font-size: 1.65rem;
    line-height: 1.15;
    font-weight: 700;
    letter-spacing: -0.015em;
  }
  .lede {
    margin: 0;
  }
  .tradition {
    margin: 0;
    padding-left: 12px;
    border-left: 3px solid var(--chart-ref);
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin: 0;
  }
  .tile {
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    min-width: 0;
  }
  .tile dt {
    line-height: 1.2;
  }
  .tile dd {
    margin: 4px 0 0;
    display: flex;
    flex-direction: column;
  }
  .value {
    font-size: 1.75rem;
    font-weight: 700;
    line-height: 1.1;
  }
  .tile a {
    align-self: flex-start;
    text-underline-offset: 3px;
  }
  .footer {
    margin: 0;
  }
</style>
