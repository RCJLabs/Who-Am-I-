<script lang="ts">
  // Recommendations, one card per kind: cases to read from both sides, readings on the political
  // traditions named, personal suggestions, topics to explore next, and tensions worth a second
  // look. Items that lead somewhere link to where you can act on them; readings and suggestions
  // are plain cards.
  import type { NextGroup } from '../../analysis/compose.ts';
  import Icon from '../Icon.svelte';

  let { groups }: { groups: NextGroup[] } = $props();
</script>

<div class="next" data-testid="next-steps">
  {#each groups as g (g.id)}
    <div class="card group" data-testid="next-{g.id}">
      <h3>{g.title}</h3>
      <p class="small muted intro">{g.intro}</p>
      <ul>
        {#each g.items as item (item.testid)}
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
    </div>
  {/each}
</div>

<style>
  h3 {
    margin: 0 0 2px;
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
