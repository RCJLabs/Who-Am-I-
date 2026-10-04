<script lang="ts">
  // One position: the topic, where you landed in words, and a small track showing it. If a
  // challenge moved you, the track shows where you started too (a before → after dumbbell).
  import type { Topic } from '../../../model/content.ts';
  import Icon from '../Icon.svelte';
  import { toPercent } from '../../view.ts';

  let {
    topic,
    href,
    label,
    stance,
    initial,
    poles,
    moves,
  }: {
    topic: Topic;
    href: string;
    label: string;
    /** Current stance, -1..1. */
    stance: number | null;
    initial: number | null;
    poles: [string, string] | null;
    /** "“The violinist” moved you 2 steps toward “X”." lines. */
    moves: string[];
  } = $props();

  const moved = $derived(stance !== null && initial !== null && Math.abs(initial - stance) > 1e-6);
  const from = $derived(initial === null ? 0 : toPercent(initial));
  const now = $derived(stance === null ? 50 : toPercent(stance));
</script>

<a class="position" {href} data-testid="position-{topic.id}">
  <span class="text">
    <span class="head">
      <span class="title">{topic.title}</span>
      <span class="stance">{label}</span>
    </span>
    {#if stance !== null && poles}
      <span class="track" aria-hidden="true">
        <span class="mid"></span>
        {#if moved}
          <span class="link" style:left="{Math.min(from, now)}%" style:width="{Math.abs(now - from)}%"></span>
          <span class="dot from" style:left="{from}%"></span>
        {/if}
        <span class="dot" style:left="{now}%"></span>
      </span>
      <span class="poles small" aria-hidden="true"><span>{poles[0]}</span><span>{poles[1]}</span></span>
    {/if}
    {#each moves as line, i (i)}
      <span class="small moved" data-testid="moved-{topic.id}">{line}</span>
    {/each}
  </span>
  <Icon name="right" size={18} />
</a>

<style>
  .position {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 0;
    border-top: 1px solid var(--border);
    color: inherit;
    text-decoration: none;
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }
  .head {
    display: flex;
    flex-direction: column;
  }
  .title {
    font-weight: 650;
  }
  .stance {
    color: var(--accent);
  }
  .track {
    position: relative;
    display: block;
    height: 4px;
    margin: 10px 6px 4px;
    border-radius: 999px;
    background: var(--track);
  }
  .mid {
    position: absolute;
    left: 50%;
    top: -3px;
    bottom: -3px;
    width: 1px;
    background: var(--muted);
    opacity: 0.5;
  }
  .link {
    position: absolute;
    top: 0;
    height: 4px;
    background: var(--chart-step-1);
  }
  .dot {
    position: absolute;
    top: 50%;
    width: 12px;
    height: 12px;
    margin: -6px 0 0 -6px;
    border-radius: 50%;
    background: var(--chart-mark);
    box-shadow: 0 0 0 2px var(--surface);
  }
  .dot.from {
    background: var(--surface);
    box-shadow:
      inset 0 0 0 2px var(--chart-step-1),
      0 0 0 2px var(--surface);
  }
  .poles {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    color: var(--muted);
    font-size: 0.75rem;
  }
  .poles span:last-child {
    text-align: right;
  }
  .moved {
    color: var(--text);
  }
</style>
