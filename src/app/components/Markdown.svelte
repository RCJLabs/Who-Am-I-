<script lang="ts">
  import { parseMarkdown, type Inline } from '../markdown.ts';

  let { source }: { source: string } = $props();
  const blocks = $derived(parseMarkdown(source));
</script>

{#snippet inline(parts: Inline[])}
  {#each parts as p, i (i)}
    {#if p.t === 'strong'}<strong>{p.v}</strong>{:else if p.t === 'em'}<em>{p.v}</em>{:else if p.t === 'code'}<code>{p.v}</code>{:else}{p.v}{/if}
  {/each}
{/snippet}

<div class="md">
  {#each blocks as b, i (i)}
    {#if b.t === 'h'}
      {#if b.level === 2}<h2>{@render inline(b.inl)}</h2>{:else if b.level === 3}<h3>{@render inline(b.inl)}</h3>{:else}<h4>{@render inline(b.inl)}</h4>{/if}
    {:else if b.t === 'p'}
      <p>{@render inline(b.inl)}</p>
    {:else}
      <ul>
        {#each b.items as item, j (j)}<li>{@render inline(item)}</li>{/each}
      </ul>
    {/if}
  {/each}
</div>

<style>
  .md :global(h2) {
    font-size: 1.15rem;
    margin-top: 1.4em;
  }
  .md :global(h3),
  .md :global(h4) {
    font-size: 1rem;
    margin-top: 1.2em;
  }
  .md :global(li) {
    margin: 4px 0;
  }
</style>
