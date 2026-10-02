<script lang="ts">
  import type { Topic } from '../../../model/content.ts';
  import { copy } from '../../copy.ts';
  import { to } from '../../routes.ts';
  import { toPercent } from '../../view.ts';

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

  /** Plain-language position, e.g. "Leans Progress". */
  const position = $derived.by(() => {
    if (score === null) return '';
    const a = Math.abs(score);
    const pole = score < 0 ? poles[0] : poles[1];
    if (a < 0.15) return 'Center';
    if (a < 0.4) return `Leans ${pole}`;
    if (a < 0.7) return pole;
    return `Strongly ${pole}`;
  });
</script>

<div class="spectrum" data-testid={testid}>
  <div class="head">
    <h3>{title}</h3>
    {#if score !== null}<span class="pos" data-testid={testid ? `${testid}-position` : undefined}>{position}</span>{/if}
  </div>
  {#if description}<p class="muted small desc">{description}</p>{/if}

  {#if score !== null}
    <div
      class="track"
      role="img"
      aria-label="{title}: {position} ({Math.round(toPercent(score))}% toward {poles[1]})"
    >
      <div class="mid"></div>
      <div class="marker" style:left="{toPercent(score)}%" style:opacity={0.35 + 0.65 * confidence}></div>
    </div>
    <div class="poles small">
      <span>{poles[0]}</span>
      <span>{poles[1]}</span>
    </div>
    <p class="small muted meta">
      {copy.results.confidence(confidence)}{#if mixed} · {copy.results.mixed}{/if}
    </p>
  {:else if !feeders.length}
    <p class="small muted">{copy.results.noTopicsYet}</p>
  {:else}
    <p class="small muted">
      {copy.results.notEnough}
      {#if feeders.length}
        {copy.results.feedBy}
        {#each feeders as t, i (t.id)}{i > 0 ? ', ' : ' '}<a href={to.flow(t.id)}>{t.title}</a>{/each}
      {/if}
    </p>
  {/if}
</div>

<style>
  .spectrum {
    padding: 14px 0;
    border-bottom: 1px solid var(--border);
  }
  .spectrum:last-child {
    border-bottom: none;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
  }
  h3 {
    margin: 0;
  }
  .pos {
    font-weight: 650;
    color: var(--accent);
    text-align: right;
  }
  .desc {
    margin: 2px 0 10px;
  }
  .track {
    position: relative;
    height: 10px;
    margin: 12px 8px 6px;
    border-radius: 999px;
    background: var(--track);
  }
  .mid {
    position: absolute;
    left: 50%;
    top: -3px;
    bottom: -3px;
    width: 2px;
    background: var(--border);
  }
  .marker {
    position: absolute;
    top: 50%;
    width: 22px;
    height: 22px;
    margin: -11px 0 0 -11px;
    border-radius: 50%;
    background: var(--marker);
    border: 3px solid var(--surface);
    box-shadow: var(--shadow);
  }
  .poles {
    display: flex;
    justify-content: space-between;
    color: var(--muted);
  }
  .meta {
    margin: 6px 0 0;
  }
</style>
