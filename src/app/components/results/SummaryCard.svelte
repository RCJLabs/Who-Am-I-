<script lang="ts">
  // The top of the results page: a headline, a few sentences on what the answers add up to, and
  // three numbers. The numbers are plain stat tiles: the value is the chart.
  import type { Summary } from '../../analysis/compose.ts';
  import { copy } from '../../copy.ts';

  let {
    summary,
    footer,
    onTensions,
  }: {
    summary: Summary;
    footer: string;
    onTensions: () => void;
  } = $props();
</script>

<section class="card summary" data-testid="results-summary" aria-labelledby="summary-headline">
  <p class="section-title kicker">{copy.analysis.summaryTitle}</p>
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
          <span class="value">{t.value}</span>
          {#if t.id === 'tensions' && t.value > 0}
            <button type="button" class="link small" onclick={onTensions}>{t.detail}</button>
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
  }
  .kicker {
    margin: 0;
  }
  .headline {
    margin: 0;
    font-size: 1.35rem;
    line-height: 1.25;
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
    font-size: 1.6rem;
    font-weight: 650;
    line-height: 1.1;
  }
  .link {
    align-self: flex-start;
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    font-size: 0.875rem;
    color: var(--accent);
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }
  .footer {
    margin: 0;
  }
</style>
