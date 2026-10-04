<script lang="ts">
  // One spectrum as a strip: title and position on one line, the question it asks, then the dot on
  // a track. A bar from the middle shows how strong the lean is and a shaded band how sure the app
  // is (wider means less evidence). What pulled each way, the confidence and the feeding topics sit
  // behind a tap.
  import { LOW_CONFIDENCE } from '../../../engine/analysis/constants.ts';
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
    drivers = [],
    color = 'var(--chart-mark)',
    testid,
  }: {
    title: string;
    poles: [string, string];
    score: number | null;
    confidence: number;
    description?: string | undefined;
    mixed?: boolean;
    feeders?: Topic[];
    /** The topics that pulled toward each pole, strongest first. */
    drivers?: { pole: string; topics: { id: string; title: string }[] }[];
    /** The area's mark colour (never used for text). */
    color?: string;
    testid?: string | undefined;
  } = $props();

  const position = $derived(score === null ? '' : positionLabel(score, poles));
  const pct = $derived(score === null ? 50 : toPercent(score));
  const low = $derived(score !== null && confidence < LOW_CONFIDENCE);
  // The band: wider with less evidence. A cue, not a statistical interval.
  const half = $derived((1 - Math.max(0, Math.min(1, confidence))) * 18 + 4);
  const bandLo = $derived(Math.max(0, pct - half));
  const bandHi = $derived(Math.min(100, pct + half));
</script>

<details class="row" data-testid={testid} style:--mark={color}>
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
    {#if description}<span class="desc small">{description}</span>{/if}
    {#if score !== null}
      <span class="visually-hidden">, {Math.round(pct)}% of the way from {poles[0]} to {poles[1]}</span>
      <span class="track" aria-hidden="true">
        <span class="line"></span>
        <span class="mid"></span>
        <span class="band" style:left="{bandLo}%" style:width="{bandHi - bandLo}%"></span>
        <span class="fill" style:left="{Math.min(50, pct)}%" style:width="{Math.abs(pct - 50)}%"></span>
        <span class="dot" class:low style:left="{pct}%"></span>
      </span>
      <span class="poles small" aria-hidden="true"><span>{poles[0]}</span><span>{poles[1]}</span></span>
      {#if mixed || low}
        <span class="note small">{mixed ? copy.results.mixed : copy.results.lowConfidence}</span>
      {/if}
    {/if}
  </summary>
  <div class="more small">
    {#if score !== null && drivers.some((d) => d.topics.length)}
      <p class="muted pulled">{copy.results.pulledBy}</p>
      <ul class="drivers">
        {#each drivers as d (d.pole)}
          {#if d.topics.length}
            <li>
              {copy.results.toward(d.pole)}
              {#each d.topics as t, i (t.id)}{i > 0 ? ', ' : ' '}<a href={to.topicResults(t.id)}>{t.title}</a>{/each}
            </li>
          {/if}
        {/each}
      </ul>
    {/if}
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
    padding: 14px 0 12px;
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
    font-weight: 700;
    flex: 1;
    min-width: 0;
  }
  .pos {
    font-weight: 650;
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
  .desc {
    display: block;
    margin-top: 2px;
    color: var(--muted);
    line-height: 1.4;
  }
  .track {
    display: block;
    position: relative;
    height: 26px;
    margin: 6px 9px 2px;
  }
  .line {
    position: absolute;
    left: -9px;
    right: -9px;
    top: 11px;
    height: 4px;
    border-radius: 2px;
    background: var(--track);
  }
  .mid {
    position: absolute;
    left: 50%;
    top: 5px;
    width: 2px;
    height: 16px;
    margin-left: -1px;
    border-radius: 1px;
    background: var(--border);
  }
  .band {
    position: absolute;
    top: 3px;
    height: 20px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--mark) 22%, transparent);
  }
  .fill {
    position: absolute;
    top: 11px;
    height: 4px;
    border-radius: 2px;
    background: color-mix(in srgb, var(--mark) 60%, transparent);
  }
  .dot {
    position: absolute;
    top: 50%;
    width: 18px;
    height: 18px;
    margin: -9px 0 0 -9px;
    border-radius: 50%;
    background: var(--mark);
    box-shadow: 0 0 0 2px var(--surface);
  }
  .dot.low {
    background: var(--surface);
    box-shadow:
      inset 0 0 0 3px var(--mark),
      0 0 0 2px var(--surface);
  }
  .poles {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    color: var(--muted);
    font-weight: 600;
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
  .pulled {
    margin-bottom: 2px !important;
  }
  .drivers {
    margin: 0 0 8px;
    padding-left: 18px;
  }
</style>
