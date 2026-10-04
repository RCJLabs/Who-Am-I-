<script lang="ts">
  // The overview's pattern: one line per spectrum, grouped by area around a coloured ring. The
  // longer the line, the further the answers lean, whichever way; a hollow line rests on few
  // answers. Tapping a line (or pointing at it) names the spectrum and where the answers sit, below
  // the ring. Sized in container units, so it scales with the card.
  import { copy } from '../../copy.ts';
  import type { PatternArea, PatternGroup, PatternSpoke } from '../../view.ts';

  let { groups, names }: { groups: PatternGroup[]; names: Record<PatternArea, string> } = $props();

  /** Degrees left empty between areas. */
  const GAP = 12;
  /** The shortest line drawn, as a share of the longest, so a centred spectrum still shows. */
  const MIN = 0.08;

  type Placed = PatternSpoke & { area: PatternArea; angle: number; i: number };
  const total = $derived(groups.reduce((n, g) => n + g.spokes.length, 0));
  const layout = $derived.by(() => {
    const step = (360 - GAP * groups.length) / Math.max(1, total);
    const stops = [`transparent 0deg ${GAP / 2}deg`];
    const spokes: Placed[] = [];
    let at = GAP / 2;
    for (const g of groups) {
      const start = at;
      for (const s of g.spokes) {
        spokes.push({ ...s, area: g.area, angle: at + step / 2, i: spokes.length });
        at += step;
      }
      stops.push(`var(--area-${g.area}) ${start}deg ${at}deg`, `transparent ${at}deg ${at + GAP}deg`);
      at += GAP;
    }
    return { ring: `conic-gradient(${stops.join(', ')})`, spokes };
  });
  const anyLow = $derived(layout.spokes.some((s) => s.low));

  let picked = $state<string | null>(null);
  let pointed = $state<string | null>(null);
  const shown = $derived(layout.spokes.find((s) => s.axis === (pointed ?? picked)) ?? null);

  // One tab stop for the whole ring (the picked line, or the first); arrow keys move round it.
  let ring = $state<HTMLElement | null>(null);
  const current = $derived(picked ?? layout.spokes[0]?.axis ?? null);
  function onkeydown(e: KeyboardEvent, i: number): void {
    const n = layout.spokes.length;
    let to: number;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        to = (i + 1) % n;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        to = (i - 1 + n) % n;
        break;
      case 'Home':
        to = 0;
        break;
      case 'End':
        to = n - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    // The keyboard's line wins over wherever the mouse happens to rest.
    pointed = null;
    picked = layout.spokes[to]!.axis;
    ring?.querySelectorAll<HTMLElement>('.spoke')[to]?.focus();
  }
</script>

<div class="pattern" data-testid="pattern">
  <div class="ring" role="group" aria-label={copy.analysis.overview.patternLabel} bind:this={ring}>
    <span class="band" style:background={layout.ring} aria-hidden="true"></span>
    <span class="guide outer" aria-hidden="true"></span>
    <span class="guide mid" aria-hidden="true"></span>
    <span class="guide hole" aria-hidden="true"></span>
    {#each layout.spokes as s (s.axis)}
      <span class="arm" style:transform="rotate({s.angle}deg)">
        <button
          type="button"
          class="spoke"
          class:dim={shown !== null && shown.axis !== s.axis}
          data-testid="spoke-{s.axis}"
          aria-label="{names[s.area]}, {s.title}: {s.label}"
          aria-pressed={picked === s.axis}
          tabindex={current === s.axis ? 0 : -1}
          style:--mark="var(--area-{s.area})"
          style:--i={s.i}
          onclick={() => (picked = picked === s.axis ? null : s.axis)}
          onkeydown={(e) => onkeydown(e, s.i)}
          onpointerenter={(e) => {
            if (e.pointerType === 'mouse') pointed = s.axis;
          }}
          onpointerleave={() => (pointed = null)}
        >
          <span class="bar" class:low={s.low} style:height="{Math.max(MIN, s.strength) * 100}%"></span>
        </button>
      </span>
    {/each}
    <span class="center" aria-hidden="true">
      <span class="count display">{total}</span>
      <span class="unit">{copy.analysis.overview.spectrums(total)}</span>
    </span>
  </div>

  <p class="status" role="status" data-testid="pattern-status">
    {#if shown}
      <span class="dot" style:--mark="var(--area-{shown.area})" aria-hidden="true"></span>
      <span><strong>{shown.title}</strong> · {shown.label}</span>
    {:else}
      <span class="muted">{copy.analysis.overview.patternTap}</span>
    {/if}
  </p>

  <ul class="legend">
    {#each groups as g (g.area)}
      <li><span class="dot" style:--mark="var(--area-{g.area})" aria-hidden="true"></span>{names[g.area]}</li>
    {/each}
  </ul>
  {#if anyLow}<p class="small muted low-note">{copy.analysis.overview.patternLow}</p>{/if}
</div>

<style>
  .ring {
    container-type: inline-size;
    position: relative;
    width: min(100%, 340px);
    aspect-ratio: 1;
    margin: 4px auto 0;
  }
  .band,
  .guide,
  .center {
    position: absolute;
    border-radius: 50%;
  }
  /* A thin coloured band, one arc per area, with gaps between. */
  .band {
    inset: 8.5cqw;
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2.5cqw), #000 calc(100% - 2.5cqw + 1px));
    mask: radial-gradient(farthest-side, transparent calc(100% - 2.5cqw), #000 calc(100% - 2.5cqw + 1px));
  }
  .guide {
    border: 1px solid var(--border);
  }
  .outer {
    inset: 12.2cqw;
  }
  .mid {
    inset: 25cqw;
  }
  .hole {
    inset: 37.8cqw;
  }
  .arm {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 0;
    height: 0;
  }
  .spoke {
    position: absolute;
    left: -3.65cqw;
    bottom: 12.2cqw;
    width: 7.3cqw;
    height: 25.6cqw;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    cursor: pointer;
  }
  .bar {
    width: 3cqw;
    border-radius: 1.5cqw;
    background: var(--mark);
    transform-origin: bottom;
    animation: grow 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both;
    animation-delay: calc(var(--i) * 25ms);
    transition: opacity 0.15s;
  }
  .bar.low {
    background: var(--surface);
    box-shadow: inset 0 0 0 0.6cqw var(--mark);
  }
  .spoke.dim .bar {
    opacity: 0.3;
  }
  @keyframes grow {
    from {
      transform: scaleY(0);
    }
  }
  .center {
    inset: 37.8cqw;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
  .count {
    font-size: 7.5cqw;
    font-weight: 700;
    line-height: 1;
  }
  .unit {
    font-size: max(11px, 3cqw);
    line-height: 1.2;
    color: var(--muted);
  }
  .status {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    margin: 8px 0 0;
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    font-size: 0.95rem;
    line-height: 1.35;
  }
  .dot {
    flex: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--mark);
  }
  .legend {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 12px;
    margin: 14px 0 0;
    padding: 0;
    list-style: none;
    font-size: 0.9rem;
  }
  .legend li {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .low-note {
    margin: 10px 0 0;
  }
</style>
