<script lang="ts">
  // Recommendations, one card per kind: cases to read from both sides, readings on the political
  // traditions named, links from research, topics to explore next, and tensions worth a second
  // look. Items that lead somewhere link to where you can act on them; readings and links are plain
  // cards. A collapsed group stays closed until opened, and remembers which it was.
  import type { NextGroup, NextItem } from '../../analysis/compose.ts';
  import Icon from '../Icon.svelte';

  let {
    groups,
    open = {},
    ontoggle,
  }: { groups: NextGroup[]; open?: Partial<Record<NextGroup['id'], boolean>>; ontoggle?: (id: NextGroup['id'], open: boolean) => void } = $props();
</script>

{#snippet items(list: NextItem[])}
  <ul>
    {#each list as item (item.testid)}
      <li>
        {#if item.href}
          <a class="rec" href={item.href} data-testid={item.testid}>
            <span class="body">
              <span class="title">{item.title}</span>
              <span class="detail">{item.detail}</span>
              {#if item.meta}<span class="small muted meta">{item.meta}</span>{/if}
              {#if item.cta}<span class="cta small">{item.cta}</span>{/if}
            </span>
            <Icon name="right" size={18} />
          </a>
        {:else}
          <div class="rec" data-testid={item.testid}>
            <span class="body">
              <span class="title">{item.title}</span>
              <span class="detail">{item.detail}</span>
              {#if item.meta}<span class="small muted meta">{item.meta}</span>{/if}
            </span>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

<div class="next" data-testid="next-steps">
  {#each groups as g (g.id)}
    {#if g.collapsed}
      <details class="card group" data-testid="next-{g.id}" open={open[g.id] ?? false} ontoggle={(e) => ontoggle?.(g.id, e.currentTarget.open)}>
        <summary>
          <span class="head">
            <span class="name">{g.title}</span>
            <span class="small muted">{g.collapsed.note}</span>
          </span>
          <span class="chev" aria-hidden="true"></span>
        </summary>
        <p class="small muted intro">{g.intro}</p>
        {@render items(g.items)}
      </details>
    {:else}
      <div class="card group" data-testid="next-{g.id}">
        <h3>{g.title}</h3>
        <p class="small muted intro">{g.intro}</p>
        {@render items(g.items)}
      </div>
    {/if}
  {/each}
</div>

<style>
  h3 {
    margin: 0 0 2px;
  }
  summary {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    list-style: none;
    cursor: pointer;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  .head {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }
  .name {
    font-size: 1.1rem;
    font-weight: 700;
  }
  .chev {
    width: 8px;
    height: 8px;
    margin-right: 4px;
    border-right: 2px solid var(--muted);
    border-bottom: 2px solid var(--muted);
    transform: translateY(-2px) rotate(45deg);
    transition: transform 0.15s;
    flex: none;
  }
  details[open] .chev {
    transform: translateY(1px) rotate(-135deg);
  }
  details[open] summary {
    margin-bottom: 6px;
  }
  .intro {
    margin: 0 0 4px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li + li {
    border-top: 1px solid var(--border);
  }
  .rec {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 0;
    min-height: 48px;
    color: inherit;
    text-decoration: none;
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }
  .title {
    font-weight: 650;
  }
  .detail {
    color: var(--text);
  }
  .meta {
    overflow-wrap: anywhere;
  }
  .cta {
    margin-top: 2px;
    font-weight: 600;
    color: var(--accent);
  }
</style>
