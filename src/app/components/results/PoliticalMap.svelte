<script lang="ts">
  // Two political spectrums as a map: economic across (Equality ← → Markets) and civil up
  // (Liberty ↓ ↑ Authority), the familiar layout. Political traditions sit under the user's dot as
  // small gray reference marks; only the ones the analysis lists are labelled. The caption spells
  // out the position in words, and the table below gives every position on every political
  // spectrum, for anyone who can't read the chart.
  import { copy } from '../../copy.ts';
  import { CHAR_W, placeLabels, textBox, type Box } from '../../map-labels.ts';
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
  const LO = 12;
  const SIZE = 276;
  const px = (v: number) => LO + ((v + 1) / 2) * SIZE;
  const py = (v: number) => LO + (1 - (v + 1) / 2) * SIZE;
  const ticks = [-0.5, 0.5];
  // Pole labels sit on the side of each axis away from the dot, so the two never overlap.
  const xLabelY = $derived(y >= 0 ? py(0) + 18 : py(0) - 8);
  const yLabelX = $derived(x >= 0 ? px(0) - 8 : px(0) + 8);
  const yAnchor = $derived(x >= 0 ? 'end' : 'start');

  // Labels keep clear of the dot, the pole labels and the other marks.
  const POLE_W = CHAR_W * 1.1;
  const labels = $derived.by(() => {
    const listed = refs.filter((r) => r.labelled);
    if (!listed.length) return [];
    const avoid: Box[] = [
      { x: px(x) - 18, y: py(y) - 18, w: 36, h: 36 },
      textBox(yPoles[1], yLabelX, LO + 20, yAnchor, POLE_W, 14),
      textBox(yPoles[0], yLabelX, LO + SIZE - 10, yAnchor, POLE_W, 14),
      textBox(xPoles[0], LO + 10, xLabelY, 'start', POLE_W, 14),
      textBox(xPoles[1], LO + SIZE - 10, xLabelY, 'end', POLE_W, 14),
      ...refs.map((r) => ({ x: px(r.x) - 5, y: py(r.y) - 5, w: 10, h: 10 })),
    ];
    return placeLabels(
      listed.map((r) => ({ id: r.id, name: r.name, cx: px(r.x), cy: py(r.y) })),
      { x: LO, y: LO, w: SIZE, h: SIZE },
      avoid,
    );
  });
  const desc = $derived(refs.length ? `${caption}. ${T.mapDesc(refs.length)}` : caption);
</script>

<figure class="map" data-testid="political-map">
  <svg viewBox="0 0 300 300" role="img" aria-labelledby="{uid}-title {uid}-desc">
    <title id="{uid}-title">{copy.results.politicalMap}</title>
    <desc id="{uid}-desc">{desc}</desc>
    <rect class="frame" x={LO} y={LO} width={SIZE} height={SIZE} rx="10" />
    {#each ticks as t (t)}
      <line class="grid" x1={px(t)} x2={px(t)} y1={LO} y2={LO + SIZE} />
      <line class="grid" x1={LO} x2={LO + SIZE} y1={py(t)} y2={py(t)} />
    {/each}
    <line class="axis" x1={px(0)} x2={px(0)} y1={LO} y2={LO + SIZE} />
    <line class="axis" x1={LO} x2={LO + SIZE} y1={py(0)} y2={py(0)} />
    <text class="label" x={yLabelX} y={LO + 20} text-anchor={yAnchor}>{yPoles[1]}</text>
    <text class="label" x={yLabelX} y={LO + SIZE - 10} text-anchor={yAnchor}>{yPoles[0]}</text>
    <text class="label" x={LO + 10} y={xLabelY} text-anchor="start">{xPoles[0]}</text>
    <text class="label" x={LO + SIZE - 10} y={xLabelY} text-anchor="end">{xPoles[1]}</text>
    {#each refs as r (r.id)}
      <circle class="ref" class:divided={r.divided} cx={px(r.x)} cy={py(r.y)} r="4" />
    {/each}
    {#each labels as l (l.id)}
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
