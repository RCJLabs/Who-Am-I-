<script lang="ts">
  // One results section: title, a short written read-out of what the chart shows, then the chart.
  // The heading takes focus when the jump bar moves here, so keyboard and screen reader users land
  // in the right place.
  import type { Snippet } from 'svelte';
  import type { Readout } from '../../analysis/compose.ts';

  let {
    id,
    title,
    readout,
    note,
    children,
  }: {
    id: string;
    title: string;
    readout?: Readout | undefined;
    /** Small print about the method, under the read-out. */
    note?: string | undefined;
    children?: Snippet;
  } = $props();
</script>

<section class="section result" id="sec-{id}" data-testid="section-{id}" aria-labelledby="sec-{id}-title">
  <h2 class="section-title" id="sec-{id}-title" tabindex="-1">{title}</h2>
  {#if readout?.sentences.length}
    <div class="readout" data-testid="readout-{id}">
      <p>{readout.sentences.join(' ')}</p>
      {#if readout.basedOn}<p class="small muted based">{readout.basedOn}</p>{/if}
    </div>
  {/if}
  {#if note}<p class="small muted note">{note}</p>{/if}
  {@render children?.()}
</section>

<style>
  .section-title:focus {
    outline: none;
  }
  .section-title:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 4px;
    border-radius: 4px;
  }
  .readout {
    margin: 0 0 12px;
    padding-left: 12px;
    border-left: 3px solid var(--accent-soft);
  }
  .readout p {
    margin: 0;
  }
  .readout .based {
    margin-top: 4px;
  }
  .note {
    margin: 0 0 10px;
  }
</style>
