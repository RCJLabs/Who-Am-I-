<script lang="ts">
  // Two political spectrums as a map: economic across (Equality ← → Markets) and civil up
  // (Liberty ↓ ↑ Authority), the familiar layout. One series, so no legend; the caption below
  // spells out the position in words for anyone who can't read the chart.
  import { copy } from '../../copy.ts';

  // Unique per instance, so two maps on one page don't share title ids.
  const uid = $props.id();
  let {
    x,
    y,
    xPoles,
    yPoles,
    caption,
    low = false,
  }: {
    x: number;
    y: number;
    xPoles: [string, string];
    yPoles: [string, string];
    caption: string;
    /** Either position rests on few answers: drawn hollow, as on the spectrum rows. */
    low?: boolean;
  } = $props();

  const LO = 12;
  const SIZE = 276;
  const px = (v: number) => LO + ((v + 1) / 2) * SIZE;
  const py = (v: number) => LO + (1 - (v + 1) / 2) * SIZE;
  const ticks = [-0.5, 0.5];
  // Pole labels sit on the side of each axis away from the dot, so the two never overlap.
  const xLabelY = $derived(y >= 0 ? py(0) + 18 : py(0) - 8);
  const yLabelX = $derived(x >= 0 ? px(0) - 8 : px(0) + 8);
  const yAnchor = $derived(x >= 0 ? 'end' : 'start');
</script>

<figure class="map" data-testid="political-map">
  <svg viewBox="0 0 300 300" role="img" aria-labelledby="{uid}-title {uid}-desc">
    <title id="{uid}-title">{copy.results.politicalMap}</title>
    <desc id="{uid}-desc">{caption}</desc>
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
    <circle class="halo" cx={px(x)} cy={py(y)} r="18" />
    <circle class="dot" class:low cx={px(x)} cy={py(y)} r="8" />
  </svg>
  <figcaption class="small">{caption}</figcaption>
</figure>

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
  figcaption {
    margin-top: 8px;
    text-align: center;
    color: var(--muted);
  }
</style>
