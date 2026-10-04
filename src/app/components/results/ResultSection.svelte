<script lang="ts">
  // One results area on its own page: its icon and title, a short written read-out of what the
  // charts show, then the charts. The title takes focus when the page opens, so keyboard and screen
  // reader users start at the top of the area.
  import type { Snippet } from 'svelte';
  import type { Readout } from '../../analysis/compose.ts';
  import type { AreaId } from '../../routes.ts';
  import Icon from '../Icon.svelte';

  let {
    id,
    title,
    readout,
    note,
    color,
    children,
  }: {
    id: AreaId;
    title: string;
    readout?: Readout | undefined;
    /** Small print about the method, under the read-out. */
    note?: string | undefined;
    /** The area's mark colour, which tints its icon. */
    color?: string | undefined;
    children?: Snippet;
  } = $props();

  let heading = $state<HTMLElement | null>(null);
  $effect(() => heading?.focus({ preventScroll: true }));
</script>

<section class="area" id="sec-{id}" data-testid="section-{id}" aria-labelledby="sec-{id}-title">
  <header class="head">
    <span class="tile" class:tinted={color} style:--tint={color}><Icon name={id} size={24} /></span>
    <h1 id="sec-{id}-title" tabindex="-1" bind:this={heading}>{title}</h1>
  </header>
  {#if readout?.sentences.length}
    <div class="readout" data-testid="readout-{id}">
      <p class="lead display">{readout.sentences[0]}</p>
      {#if readout.sentences.length > 1}<p>{readout.sentences.slice(1).join(' ')}</p>{/if}
      {#if readout.basedOn}<p class="small muted">{readout.basedOn}</p>{/if}
    </div>
  {/if}
  {#if note}<p class="small muted note">{note}</p>{/if}
  {@render children?.()}
</section>

<style>
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 4px 0 14px;
  }
  .tile {
    flex: none;
    width: 44px;
    height: 44px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-2);
  }
  .tile.tinted {
    background: color-mix(in srgb, var(--tint) 24%, transparent);
  }
  h1 {
    margin: 0;
    font-size: 2rem;
    font-weight: 700;
    letter-spacing: -0.015em;
  }
  h1:focus {
    outline: none;
  }
  h1:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 4px;
    border-radius: 4px;
  }
  .readout {
    margin: 0 0 14px;
  }
  .readout p {
    margin: 0 0 6px;
  }
  .readout p:last-child {
    margin-bottom: 0;
  }
  .lead {
    font-size: 1.25rem;
    line-height: 1.3;
    font-weight: 600;
  }
  .note {
    margin: 0 0 12px;
  }
</style>
