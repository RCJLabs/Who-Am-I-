<script lang="ts">
  // The overview's way into each area: its icon, its name and one line on what's there.
  import { to, type AreaId } from '../../routes.ts';
  import Icon from '../Icon.svelte';

  let { items }: { items: { id: AreaId; title: string; line: string; color?: string | undefined }[] } = $props();
</script>

<ul class="areas">
  {#each items as a (a.id)}
    <li>
      <a href={to.area(a.id)} data-testid="area-{a.id}">
        <span class="tile" class:tinted={a.color} style:--tint={a.color}><Icon name={a.id} size={22} /></span>
        <span class="body">
          <span class="name">{a.title}</span>
          <span class="line small muted">{a.line}</span>
        </span>
        <Icon name="right" size={18} />
      </a>
    </li>
  {/each}
</ul>

<style>
  .areas {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li + li {
    border-top: 1px solid var(--border);
  }
  a {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 64px;
    padding: 10px 0;
    color: var(--text);
    text-decoration: none;
  }
  .tile {
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-2);
  }
  .tile.tinted {
    background: color-mix(in srgb, var(--tint) 24%, transparent);
  }
  .body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .name {
    font-weight: 650;
  }
  .line {
    line-height: 1.35;
  }
</style>
