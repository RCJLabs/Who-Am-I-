<script lang="ts">
  // One spectrum as a compact row: title and position on one line, the dot on a thin track below,
  // and the description, confidence and feeding topics behind a tap.
  import type { Topic } from '../../../model/content.ts';
  import { copy } from '../../copy.ts';
  import { to } from '../../routes.ts';
  import { positionLabel, toPercent } from '../../view.ts';

  let {
    title,
    poles,
    score,
    confidence,
    description,
    mixed = false,
    feeders = [],
    testid,
  }: {
    title: string;
    poles: [string, string];
    score: number | null;
    confidence: number;
    description?: string | undefined;
    mixed?: boolean;
    feeders?: Topic[];
    testid?: string | undefined;
  } = $props();

  const position = $derived(score === null ? '' : positionLabel(score, poles));
  const pct = $derived(score === null ? 50 : toPercent(score));
  const low = $derived(score !== null && confidence < 0.5);
</script>

<details class="row" data-testid={testid}>
  <summary>
    <span class="head">
      <span class="title">{title}</span>
      {#if score !== null}
        <span class="pos" data-testid={testid ? `${testid}-position` : undefined}>{position}</span>
      {:else}
        <span class="pos none">{feeders.length ? copy.results.notYet : copy.results.comingSoon}</span>
      {/if}
      <span class="chev" aria-hidden="true"></span>
    </span>
    {#if score !== null}
      <span class="visually-hidden">, {Math.round(pct)}% of the way from {poles[0]} to {poles[1]}</span>
      <span class="track" aria-hidden="true">
        <span class="mid"></span>
        <span class="dot" class:low style:left="{pct}%"></span>
      </span>
      <span class="poles small" aria-hidden="true"><span>{poles[0]}</span><span>{poles[1]}</span></span>
      {#if mixed || low}
        <span class="note small">{mixed ? copy.results.mixed : copy.results.lowConfidence}</span>
      {/if}
    {/if}
  </summary>
  <div class="more small">
    {#if description}<p>{description}</p>{/if}
    {#if score !== null}
      <p class="muted">{copy.results.confidence(confidence)}</p>
    {:else if !feeders.length}
      <p class="muted">{copy.results.noTopicsYet}</p>
    {/if}
    {#if feeders.length}
      <p class="muted">
        {score === null ? copy.results.notEnough : ''}
        {copy.results.feedBy}
        {#each feeders as t, i (t.id)}{i > 0 ? ', ' : ' '}<a href={to.flow(t.id)}>{t.title}</a>{/each}
      </p>
    {/if}
  </div>
</details>

<style>
  .row {
    border-bottom: 1px solid var(--border);
  }
  .row:last-child {
    border-bottom: none;
  }
  summary {
    display: block;
    list-style: none;
    cursor: pointer;
    padding: 12px 0 10px;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  .head {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .title {
    font-weight: 650;
    flex: 1;
    min-width: 0;
  }
  .pos {
    font-weight: 650;
    color: var(--accent);
    text-align: right;
    /* A long label wraps rather than squeezing the title, which has no width of its own. */
    max-width: 55%;
  }
  .pos.none {
    font-weight: 500;
    color: var(--muted);
    font-size: 0.875rem;
  }
  .chev {
    width: 8px;
    height: 8px;
    margin-left: 2px;
    border-right: 2px solid var(--muted);
    border-bottom: 2px solid var(--muted);
    transform: translateY(-2px) rotate(45deg);
    transition: transform 0.15s;
    flex: none;
  }
  details[open] .chev {
    transform: translateY(1px) rotate(-135deg);
  }
  .track {
    display: block;
    position: relative;
    height: 6px;
    margin: 12px 7px 6px;
    border-radius: 999px;
    background: var(--track);
  }
  .mid {
    position: absolute;
    left: 50%;
    top: -4px;
    bottom: -4px;
    width: 1px;
    background: var(--muted);
    opacity: 0.6;
  }
  .dot {
    position: absolute;
    top: 50%;
    width: 16px;
    height: 16px;
    margin: -8px 0 0 -8px;
    border-radius: 50%;
    background: var(--chart-mark);
    box-shadow: 0 0 0 2px var(--surface);
  }
  .dot.low {
    background: var(--surface);
    box-shadow:
      inset 0 0 0 3px var(--chart-mark),
      0 0 0 2px var(--surface);
  }
  .poles {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    color: var(--muted);
  }
  .poles span:last-child {
    text-align: right;
  }
  .note {
    display: block;
    margin-top: 4px;
    color: var(--muted);
  }
  .more {
    padding: 0 0 12px;
  }
  .more p {
    margin: 0 0 6px;
  }
</style>
