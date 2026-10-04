<script lang="ts">
  // Two political spectrums at a time as a map, with a switch between the pairs. The answers are
  // the coloured dot, inside a band that widens with less evidence. The nearest political
  // traditions are numbered rings (the same numbers as the list above); the rest show on request.
  // Nothing is labelled on the map itself: tap a ring or dot to name it. The caption says where the
  // answers sit in words, and the table gives everyone's position on every spectrum.
  import { LOW_CONFIDENCE } from '../../../engine/analysis/constants.ts';
  import { copy } from '../../copy.ts';
  import { positionLabel, type MapTradition, type MapView, type PositionTable } from '../../view.ts';
  import Icon from '../Icon.svelte';

  let { views, traditions, table = null }: { views: MapView[]; traditions: MapTradition[]; table?: PositionTable | null } = $props();

  const T = copy.analysis.traditions;
  const M = T.map;
  /** Where the plot starts, as a share of the square: room for the dots at either end. */
  const INSET = 7;
  const at = (score: number) => INSET + ((score + 1) / 2) * (100 - 2 * INSET);
  /** The evidence band's half-width, in plot units: the same rule as the spectrum strips. */
  const half = (confidence: number) => (((1 - Math.max(0, Math.min(1, confidence))) * 18 + 4) / 50) * ((100 - 2 * INSET) / 2);

  let viewId = $state<string | null>(null);
  let showAll = $state(false);
  let picked = $state<string | null>(null);
  const view = $derived(views.find((v) => v.id === viewId) ?? views[0] ?? null);

  const placed = $derived(
    view
      ? traditions.flatMap((t) => {
          const x = t.positions[view.x.id];
          const y = t.positions[view.y.id];
          if (x === undefined || y === undefined) return [];
          return [{ ...t, left: at(x), top: 100 - at(y), divided: t.divided.includes(view.x.id) || t.divided.includes(view.y.id) }];
        })
      : [],
  );
  const listed = $derived(placed.filter((t) => t.rank !== null).sort((a, b) => a.rank! - b.rank!));
  const others = $derived(placed.filter((t) => t.rank === null));
  // Drawn in this order, so the nearest tradition sits on top where they crowd together.
  const shown = $derived([...(showAll ? others : []), ...[...listed].reverse()]);
  const pickedOne = $derived(shown.find((t) => t.id === picked) ?? null);
  /** Within this distance (in % of the map) marks overlap, so a tap names them all. */
  const NEAR = 6;
  const alsoHere = $derived(pickedOne ? shown.filter((t) => t.id !== pickedOne.id && Math.hypot(t.left - pickedOne.left, t.top - pickedOne.top) < NEAR) : []);
  const low = $derived(view !== null && Math.min(view.x.confidence, view.y.confidence) < LOW_CONFIDENCE);
  const caption = $derived(
    view
      ? `${view.x.title}: ${positionLabel(view.x.score, view.x.poles)} · ${view.y.title}: ${positionLabel(view.y.score, view.y.poles)}${low ? ` (${copy.results.lowConfidence.toLowerCase()})` : ''}`
      : '',
  );

  function choose(id: string): void {
    viewId = id;
    picked = null;
  }
</script>

{#if !view}
  <p class="small muted flush">{copy.results.mapNeeds}</p>
{:else}
  {#if views.length > 1}
    <div class="views" role="group" aria-label={M.views}>
      {#each views as v (v.id)}
        <button type="button" aria-pressed={v.id === view.id} data-testid="map-view-{v.id}" onclick={() => choose(v.id)}>{v.x.title} × {v.y.title}</button>
      {/each}
    </div>
  {/if}

  <figure class="map" data-testid="political-map">
    <p class="edge top small" aria-hidden="true"><Icon name="up" size={14} />{view.y.poles[1]}</p>
    <div class="plot" role="group" aria-label="{copy.results.politicalMap}: {caption}.{shown.length ? ` ${T.mapDesc(shown.length)}` : ''}">
      <span class="line across" aria-hidden="true"></span>
      <span class="line up" aria-hidden="true"></span>
      <span
        class="plot-band"
        aria-hidden="true"
        style:left="{at(view.x.score)}%"
        style:top="{100 - at(view.y.score)}%"
        style:width="{2 * half(view.x.confidence)}%"
        style:height="{2 * half(view.y.confidence)}%"
      ></span>
      {#each shown as t (t.id)}
        <button
          type="button"
          class="trad"
          class:listed={t.rank !== null}
          class:divided={t.divided}
          class:picked={picked === t.id}
          style:left="{t.left}%"
          style:top="{t.top}%"
          aria-label={t.name}
          aria-pressed={picked === t.id}
          data-testid="map-trad-{t.id}"
          onclick={() => (picked = picked === t.id ? null : t.id)}
        >
          <span class="mark">{t.rank !== null ? t.rank + 1 : ''}</span>
        </button>
      {/each}
      <span class="plot-you" class:low aria-hidden="true" data-testid="map-you" style:left="{at(view.x.score)}%" style:top="{100 - at(view.y.score)}%"></span>
    </div>
    <p class="edge bottom small" aria-hidden="true">
      <span><Icon name="left" size={14} />{view.x.poles[0]}</span>
      <span><Icon name="down" size={14} />{view.y.poles[0]}</span>
      <span>{view.x.poles[1]}<Icon name="right" size={14} /></span>
    </p>
    <figcaption class="small">{caption}</figcaption>
  </figure>

  {#if placed.length}
    <p class="status small" role="status" data-testid="map-status">
      {#if pickedOne}
        <strong>{pickedOne.name}</strong> · {pickedOne.band ?? M.reference}
        {#if alsoHere.length}<br /><span class="muted">{M.alsoHere(alsoHere.map((t) => t.name))}</span>{/if}
      {:else}
        <span class="muted">{M.tap}</span>
      {/if}
    </p>
  {/if}

  <ul class="legend small">
    <li><span class="key you" aria-hidden="true"></span>{T.legend.you}</li>
    <li><span class="key band" aria-hidden="true"></span>{M.sure}</li>
    {#if shown.length}<li><span class="key ring" aria-hidden="true"></span>{T.legend.traditions}</li>{/if}
    {#if shown.some((t) => t.divided)}<li><span class="key ring dashed" aria-hidden="true"></span>{T.legend.divided}</li>{/if}
  </ul>

  {#if others.length}
    <button type="button" class="btn block all" aria-pressed={showAll} data-testid="map-show-all" onclick={() => ((showAll = !showAll), (picked = null))}>
      {showAll ? M.showClosest : M.showAll(placed.length)}
    </button>
  {/if}
{/if}

{#if table}
  <details class="table" data-testid="map-table">
    <summary class="small">{T.table.show}</summary>
    <div class="scroll">
      <table class="small">
        <thead>
          <tr>
            <th scope="col">{T.table.who}</th>
            {#each table.columns as c (c.id)}<th scope="col">{c.title}</th>{/each}
          </tr>
        </thead>
        <tbody>
          {#each table.rows as r (r.id)}
            <tr class:you={r.id === 'you'}>
              <th scope="row">{r.name}</th>
              {#each r.cells as cell, k (k)}<td>{cell}</td>{/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </details>
{/if}

<style>
  .flush {
    margin: 0;
  }
  .views {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px;
    padding: 4px;
    margin-bottom: 12px;
    border-radius: 999px;
    background: var(--surface-2);
  }
  .views button {
    min-height: 44px;
    padding: 0 8px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
  }
  .views button[aria-pressed='true'] {
    background: var(--accent);
    color: var(--accent-text);
  }
  .map {
    margin: 0 auto;
    max-width: 340px;
  }
  .edge {
    display: flex;
    align-items: center;
    gap: 2px;
    margin: 0;
    color: var(--muted);
    font-weight: 600;
  }
  .edge.top {
    justify-content: center;
    margin-bottom: 4px;
  }
  .edge.bottom {
    justify-content: space-between;
    margin-top: 4px;
  }
  .edge.bottom span {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }
  .plot {
    position: relative;
    aspect-ratio: 1;
    border-radius: 18px;
    background: var(--surface-2);
    overflow: hidden;
  }
  .line {
    position: absolute;
    background: var(--border);
  }
  .line.across {
    left: 4%;
    right: 4%;
    top: 50%;
    height: 1px;
  }
  .line.up {
    top: 4%;
    bottom: 4%;
    left: 50%;
    width: 1px;
  }
  .plot-band,
  .plot-you,
  .trad {
    position: absolute;
    transform: translate(-50%, -50%);
    transition:
      left 0.35s ease,
      top 0.35s ease,
      width 0.35s ease,
      height 0.35s ease;
  }
  .plot-band {
    border-radius: 50%;
    background: color-mix(in srgb, var(--area-politics) 22%, transparent);
  }
  .plot-you {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--area-politics);
    box-shadow: 0 0 0 3px var(--surface-2);
    pointer-events: none;
  }
  .plot-you.low {
    background: var(--surface-2);
    box-shadow:
      inset 0 0 0 3px var(--area-politics),
      0 0 0 3px var(--surface-2);
  }
  .trad {
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .mark {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--chart-ref);
    box-shadow: 0 0 0 2px var(--surface-2);
  }
  .trad.divided .mark {
    background: var(--surface-2);
    box-shadow:
      inset 0 0 0 2px var(--chart-ref),
      0 0 0 2px var(--surface-2);
  }
  .trad.listed .mark {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface);
    border: 2px solid var(--chart-ref);
    color: var(--text);
    font-size: 0.75rem;
    font-weight: 700;
    box-shadow: 0 0 0 2px var(--surface-2);
  }
  .trad.listed.divided .mark {
    border-style: dashed;
  }
  .trad.picked .mark {
    outline: 2px solid var(--text);
    outline-offset: 2px;
  }
  figcaption {
    margin-top: 6px;
    text-align: center;
    color: var(--muted);
  }
  .status {
    min-height: 44px;
    margin: 10px 0 0;
    padding: 12px 14px;
    line-height: 1.4;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
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
  .key.band {
    width: 22px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--area-politics) 30%, transparent);
  }
  .key.ring {
    border: 2px solid var(--chart-ref);
  }
  .key.ring.dashed {
    border-style: dashed;
  }
  .all {
    margin-top: 12px;
    border-radius: var(--radius-sm);
  }
  .table {
    margin-top: 12px;
  }
  .table summary {
    cursor: pointer;
    color: var(--accent);
    font-weight: 600;
  }
  .scroll {
    overflow-x: auto;
    margin-top: 6px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th,
  td {
    padding: 6px 8px;
    text-align: left;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  thead th {
    color: var(--muted);
    font-weight: 600;
  }
  tbody th {
    font-weight: 600;
  }
  tr.you th,
  tr.you td {
    color: var(--accent);
  }
</style>
