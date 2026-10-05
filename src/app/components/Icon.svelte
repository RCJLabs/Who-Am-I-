<script lang="ts">
  // Minimal stroke icons (24×24, from icons.ts). Decorative unless a label is given.
  import { ICONS, type IconName } from '../icons.ts';

  let { name, size = 22, label }: { name: IconName; size?: number; label?: string } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
>
  {#each ICONS[name] as d (d)}<path {d} />{/each}
</svg>

<style>
  /* Icons sit in flex rows beside text; without this, long text squeezes them smaller. */
  svg {
    flex-shrink: 0;
  }
</style>
