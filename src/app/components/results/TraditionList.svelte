<script lang="ts">
  // The political traditions nearest the answers, on the Politics page. Reference points, never a
  // label. Each row is numbered as on the map, says how close it is in words, and shows the answers
  // beside the tradition on each political spectrum. Opened, it becomes "You and …": the same
  // comparison at full size with both positions in words, where the answers differ, what the
  // tradition stands for, and, for one the summary names, readings from inside it and out.
  import type { TraditionsView } from '../../analysis/compose.ts';
  import { copy } from '../../copy.ts';
  import type { AnalysisState } from '../../stores/content.svelte.ts';
  import { positionLabel, toPercent, type Comparison } from '../../view.ts';

  let {
    view,
    state,
    comparisons = {},
  }: {
    view: TraditionsView | null;
    state: AnalysisState;
    /** The answers beside each listed tradition, by its id. */
    comparisons?: Record<string, Comparison[]>;
  } = $props();
  const T = copy.analysis.traditions;
  const columns = $derived(view?.rows[0] ? (comparisons[view.rows[0].id] ?? []) : []);
  const anySplit = $derived(view?.rows.some((r) => (comparisons[r.id] ?? []).some((c) => c.them === null)) ?? false);
</script>

{#snippet bell(c: Comparison, big: boolean)}
  {@const you = c.you === null ? null : toPercent(c.you)}
  {@const them = c.them === null ? null : toPercent(c.them)}
  <span class="bell" class:big aria-hidden="true">
    <span class="rail" class:split={them === null}></span>
    {#if you !== null && them !== null}<span class="gap" style:left="{Math.min(you, them)}%" style:width="{Math.abs(you - them)}%"></span>{/if}
    {#if them !== null}<span class="them" style:left="{them}%"></span>{/if}
    {#if you !== null}<span class="you" style:left="{you}%"></span>{/if}
  </span>
{/snippet}

<div class="card traditions" data-testid="traditions" data-status={view?.status ?? state}>
  <h2 class="title">{T.title}</h2>
  <p class="small muted note">{T.note}</p>
  {#if state === 'failed'}
    <div class="failed" role="alert">
      <p class="small">{T.failed}</p>
      <button type="button" class="btn ghost" onclick={() => location.reload()}>{T.reload}</button>
    </div>
  {:else if !view}
    <p class="small muted" aria-live="polite">{T.loading}</p>
  {:else if view.status === 'insufficient'}
    <p class="small">{view.lead}</p>
  {:else}
    {#if view.basis}<p class="small muted basis">{view.basis}</p>{/if}
    {#if columns.length}
      <div class="cols small" aria-hidden="true" style:--n={columns.length}>
        {#each columns as c (c.axis)}<span>{c.title}</span>{/each}
      </div>
    {/if}
    <ol>
      {#each view.rows as r, i (r.id)}
        {@const cmp = comparisons[r.id] ?? []}
        <li data-testid="tradition-{r.id}">
          <details open={i === 0}>
            <summary>
              <span class="head">
                <span class="n" aria-hidden="true">{i + 1}</span>
                <span class="name">{r.name}</span>
                <span class="band" class:near={r.closeness === 'very-close' || r.closeness === 'close'}>{r.band}</span>
                <span class="chev" aria-hidden="true"></span>
              </span>
              {#if cmp.length}
                <span class="minis" style:--n={cmp.length}>
                  {#each cmp as c (c.axis)}{@render bell(c, false)}{/each}
                </span>
              {/if}
            </summary>
            <div class="more" data-testid="you-and-{r.id}">
              <h3>{T.compare.youAnd(r.name)}</h3>
              {#each r.differences as d (d)}<p class="diff">{d}</p>{/each}
              {#each cmp as c (c.axis)}
                <div class="spectrum">
                  <span class="spectrum-title">{c.title}</span>
                  {@render bell(c, true)}
                  <span class="poles small" aria-hidden="true"><span>{c.poles[0]}</span><span>{c.poles[1]}</span></span>
                  <span class="small muted">
                    {T.compare.at(T.legend.you, c.you === null ? T.table.none : positionLabel(c.you, c.poles))} ·
                    {T.compare.at(r.name, c.them === null ? T.compare.split : positionLabel(c.them, c.poles))}
                  </span>
                </div>
              {/each}
              <p class="about">{r.summary}</p>
              {#if r.split}<p class="small"><strong>{T.splitFrom(r.split.from)}:</strong> {r.split.text}</p>{/if}
              {#if r.divided}<p class="small muted">{r.divided}</p>{/if}
              {#if r.readings.length}
                <h4>{T.readings.title}</h4>
                <p class="small muted">{T.readings.intro(r.name)}</p>
                <ul class="readings">
                  {#each r.readings as item (item.testid)}
                    <li data-testid={item.testid}>
                      <span class="reading-title">{item.title}</span>
                      <span class="small">{item.detail}</span>
                      {#if item.meta}<span class="small muted">{item.meta}</span>{/if}
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          </details>
        </li>
      {/each}
    </ol>
    <ul class="legend small">
      <li><span class="key you" aria-hidden="true"></span>{T.legend.you}</li>
      <li><span class="key ring" aria-hidden="true"></span>{T.legend.traditions}</li>
      {#if anySplit}<li><span class="key split" aria-hidden="true"></span>{T.compare.split}</li>{/if}
    </ul>
  {/if}
</div>

<style>
  .title {
    margin: 0 0 2px;
    font-size: 1.35rem;
  }
  .note,
  .basis {
    margin: 0 0 8px;
  }
  .cols,
  .minis {
    display: grid;
    grid-template-columns: repeat(var(--n), minmax(0, 1fr));
    gap: 10px;
  }
  .cols {
    padding: 4px 0 6px;
    color: var(--muted);
    font-weight: 600;
    font-size: 0.75rem;
  }
  .cols span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li + li {
    border-top: 1px solid var(--border);
  }
  ol > li:first-child {
    border-top: 1px solid var(--border);
  }
  summary {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 0;
    min-height: 48px;
    list-style: none;
    cursor: pointer;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .n {
    flex: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid var(--chart-ref);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
  }
  .name {
    flex: 1;
    min-width: 0;
    font-weight: 650;
  }
  .band {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--muted);
    white-space: nowrap;
  }
  .band.near {
    color: var(--accent);
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
  /* You beside a tradition on one spectrum: a filled dot and a gray ring, joined by their gap. */
  .bell {
    position: relative;
    display: block;
    height: 14px;
    margin: 0 6px;
  }
  .bell.big {
    height: 22px;
    margin: 4px 9px 2px;
  }
  .rail,
  .gap {
    position: absolute;
    top: 50%;
    height: 2px;
    margin-top: -1px;
    border-radius: 1px;
  }
  .rail {
    left: -6px;
    right: -6px;
    background: var(--track);
  }
  .big .rail {
    left: -9px;
    right: -9px;
  }
  .rail.split {
    background: repeating-linear-gradient(90deg, var(--chart-ref) 0 4px, transparent 4px 7px);
  }
  .gap {
    background: var(--chart-ref);
  }
  .big .gap {
    height: 4px;
    margin-top: -2px;
    border-radius: 2px;
  }
  .them,
  .you {
    position: absolute;
    top: 50%;
    border-radius: 50%;
    transform: translate(-50%, -50%);
  }
  .them {
    width: 10px;
    height: 10px;
    border: 2px solid var(--chart-ref);
    background: var(--surface);
  }
  .you {
    width: 10px;
    height: 10px;
    background: var(--area-politics);
    box-shadow: 0 0 0 2px var(--surface);
  }
  .big .them {
    width: 14px;
    height: 14px;
  }
  .big .you {
    width: 16px;
    height: 16px;
  }
  .more {
    padding: 0 0 14px;
  }
  .more h3 {
    margin: 4px 0 6px;
    font-family: var(--font-display);
    font-size: 1.2rem;
  }
  .diff {
    margin: 0 0 4px;
  }
  .spectrum {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 0;
    border-bottom: 1px solid var(--border);
  }
  .spectrum-title {
    font-weight: 650;
  }
  .poles {
    display: flex;
    justify-content: space-between;
    color: var(--muted);
    font-weight: 600;
  }
  .about {
    margin: 12px 0 6px;
  }
  .more p.small {
    margin: 0 0 6px;
  }
  h4 {
    margin: 14px 0 2px;
    font-size: 1rem;
  }
  .readings {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
  }
  .readings li {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 0;
    border-top: 1px solid var(--border);
  }
  .reading-title {
    font-weight: 650;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    margin: 10px 0 0;
    padding: 0;
    list-style: none;
    color: var(--muted);
  }
  .legend li {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .key {
    flex: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }
  .key.you {
    background: var(--area-politics);
  }
  .key.ring {
    border: 2px solid var(--chart-ref);
  }
  .key.split {
    width: 18px;
    height: 2px;
    border-radius: 0;
    background: repeating-linear-gradient(90deg, var(--chart-ref) 0 4px, transparent 4px 7px);
  }
  .failed {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .failed p {
    margin: 0;
  }
</style>
