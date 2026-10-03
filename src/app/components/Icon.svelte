<script lang="ts">
  // Minimal stroke icons (24×24). Decorative unless a label is given.
  const PATHS = {
    home: ['M3 11l9-8 9 8', 'M5 10v10h14V10'],
    list: ['M9 6h12', 'M9 12h12', 'M9 18h12', 'M4 6h.01', 'M4 12h.01', 'M4 18h.01'],
    chart: ['M3 20h18', 'M6 20v-7', 'M12 20V5', 'M18 20v-11'],
    sliders: ['M4 6h9', 'M17 6h3', 'M4 12h3', 'M11 12h9', 'M4 18h11', 'M19 18h1', 'M15 4v4', 'M9 10v4', 'M17 16v4'],
    lock: ['M6 11h12v10H6z', 'M8 11V8a4 4 0 0 1 8 0v3'],
    check: ['M5 12l5 5L20 7'],
    left: ['M15 18l-6-6 6-6'],
    right: ['M9 6l6 6-6 6'],
    x: ['M6 6l12 12', 'M18 6L6 18'],
    download: ['M12 4v11', 'M7 10l5 5 5-5', 'M4 20h16'],
    upload: ['M12 20V9', 'M7 14l5-5 5 5', 'M4 4h16'],
    share: ['M12 15V3', 'M7 8l5-5 5 5', 'M5 12v8h14v-8'],
    trash: ['M4 7h16', 'M10 11v6', 'M14 11v6', 'M6 7l1 13h10l1-13', 'M9 7V4h6v3'],
    info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 16v-5', 'M12 8h.01'],
    spark: ['M12 3v4', 'M12 17v4', 'M3 12h4', 'M17 12h4', 'M6 6l2.5 2.5', 'M15.5 15.5L18 18', 'M18 6l-2.5 2.5', 'M8.5 15.5L6 18'],
  } as const;

  let { name, size = 22, label }: { name: keyof typeof PATHS; size?: number; label?: string } = $props();
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
  {#each PATHS[name] as d (d)}<path {d} />{/each}
</svg>

<style>
  /* Icons sit in flex rows beside text; without this, long text squeezes them smaller. */
  svg {
    flex-shrink: 0;
  }
</style>
