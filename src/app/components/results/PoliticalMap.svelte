<script lang="ts">
  // Two political spectrums as a map: economic across (Equality ← → Markets) and civil up
  // (Liberty ↓ ↑ Authority), the familiar layout. Political traditions sit under the user's dot as
  // small gray reference marks. The ones the analysis lists are labelled, nearest first, where a
  // label hides nothing (the named ones always; see map-labels.ts). The caption spells out the
  // position in words, and the table below gives every position on every political spectrum, for
  // anyone who can't read the chart.
  import { copy } from '../../copy.ts';
  import { estimate, layoutMap, LO, px, py, SIZE, type Measure } from '../../map-labels.ts';
  import type { MapRef, PositionTable } from '../../view.ts';

  // Unique per instance, so two maps on one page don't share title ids.
  const uid = $props.id();
  let {
    x,
    y,
    xPoles,
    yPoles,
    caption,
    low = false,
    refs = [],
    table = null,
  }: {
    x: number;
    y: number;
    xPoles: [string, string];
    yPoles: [string, string];
    caption: string;
    /** Either position rests on few answers: drawn hollow, as on the spectrum rows. */
    low?: boolean;
    /** Political traditions, for reference. */
    refs?: MapRef[];
    /** Everyone's positions in words. */
    table?: PositionTable | null;
  } = $props();

  const T = copy.analysis.traditions;
  const ticks = [-0.5, 0.5];

  // Labels are placed from the widths of the font on screen, measured once the map is drawn.
  let svg: SVGSVGElement | undefined = $state();
  let measure: Measure = $state(estimate);
  $effect(() => {
    const ctx = svg && document.createElement('canvas').getContext('2d');
    if (!svg || !ctx) return;
    const family = getComputedStyle(svg).fontFamily;
    measure = (text, size) => {
      ctx.font = `600 ${size}px ${family}`;
      return ctx.measureText(text).width;
    };
  });
  const layout = $derived(layoutMap({ x, y }, { x: xPoles, y: yPoles }, refs, measure));
  const desc = $derived(refs.length ? `${caption}. ${T.mapDesc(refs.length)}` : caption);
</script>

<figure class="map" data-testid="political-map">
  <svg bind:this={svg} viewBox="0 0 300 300" role="img" aria-labelledby="{uid}-title {uid}-desc">
    <title id="{uid}-title">{copy.results.politicalMap}</title>
    <desc id="{uid}-desc">{desc}</desc>
    <rect class="frame" x={LO} y={LO} width={SIZE} height={SIZE} rx="10" />
    {#each ticks as t (t)}
      <line class="grid" x1={px(t)} x2={px(t)} y1={LO} y2={LO + SIZE} />
      <line class="grid" x1={LO} x2={LO + SIZE} y1={py(t)} y2={py(t)} />
    {/each}
    <line class="axis" x1={px(0)} x2={px(0)} y1={LO} y2={LO + SIZE} />
    <line class="axis" x1={LO} x2={LO + SIZE} y1={py(0)} y2={py(0)} />
    {#each layout.poles as p, k (k)}
      <text class="label" x={p.x} y={p.y} text-anchor={p.anchor}>{p.text}</text>
    {/each}
    {#each refs as r (r.id)}
      <circle class="ref" class:divided={r.divided} cx={px(r.x)} cy={py(r.y)} r="4" />
    {/each}
    {#each layout.labels as l (l.id)}
      {#if l.leader}<line class="leader" x1={l.leader.x1} y1={l.leader.y1} x2={l.leader.x2} y2={l.leader.y2} />{/if}
      <text class="ref-label" x={l.x} y={l.y} text-anchor={l.anchor}>
        {#each l.lines as line, k (k)}<tspan x={l.x} dy={k ? 13 : 0}>{line}</tspan>{/each}
      </text>
    {/each}
    <circle class="halo" cx={px(x)} cy={py(y)} r="18" />
    <circle class="dot" class:low cx={px(x)} cy={py(y)} r="8" />
  </svg>
  {#if refs.length}
    <ul class="legend small">
      <li><span class="key you" aria-hidden="true"></span>{T.legend.you}</li>
      <li><span class="key ref" aria-hidden="true"></span>{T.legend.traditions}</li>
      {#if refs.some((r) => r.divided)}
        <li><span class="key ref divided" aria-hidden="true"></span>{T.legend.divided}</li>
      {/if}
    </ul>
  {/if}
  <figcaption class="small">{caption}</figcaption>
</figure>
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
  .map {
    margin: 0;
  }
  svg {
    display: block;
    width: 100%;
    max-width: 340px;
    height: auto;
    margin: 0 auto;
    overflow: visible;
  }
  .frame {
    fill: none;
    stroke: var(--border);
    stroke-width: 1;
  }
  .grid {
    stroke: var(--border);
    stroke-width: 1;
  }
  .axis {
    stroke: var(--muted);
    stroke-width: 1;
    opacity: 0.55;
  }
  .label {
    fill: var(--muted);
    font-size: 12px;
    font-weight: 600;
    paint-order: stroke;
    stroke: var(--surface);
    stroke-width: 4px;
    stroke-linejoin: round;
  }
  .ref {
    fill: var(--chart-ref);
    stroke: var(--surface);
    stroke-width: 1.5;
  }
  .ref.divided {
    fill: var(--surface);
    stroke: var(--chart-ref);
    stroke-width: 1.5;
  }
  .leader {
    stroke: var(--muted);
    stroke-width: 1;
  }
  .ref-label {
    fill: var(--text);
    font-size: 11px;
    font-weight: 600;
    paint-order: stroke;
    stroke: var(--surface);
    stroke-width: 3px;
    stroke-linejoin: round;
  }
  .halo {
    fill: var(--chart-mark);
    opacity: 0.14;
  }
  .dot {
    fill: var(--chart-mark);
    stroke: var(--surface);
    stroke-width: 3;
  }
  .dot.low {
    fill: var(--surface);
    stroke: var(--chart-mark);
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px 14px;
    margin: 8px 0 0;
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
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex: none;
  }
  .key.you {
    background: var(--chart-mark);
  }
  .key.ref {
    width: 8px;
    height: 8px;
    background: var(--chart-ref);
  }
  .key.ref.divided {
    background: var(--surface);
    box-shadow: inset 0 0 0 1.5px var(--chart-ref);
  }
  figcaption {
    margin-top: 8px;
    text-align: center;
    color: var(--muted);
  }
  .table {
    margin-top: 10px;
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
