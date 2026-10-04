<script lang="ts">
  // A row of section chips that sticks to the top while you scroll. Buttons, not #links: the app's
  // router treats the hash as a route. The chip for the section you've scrolled to is current.
  import { copy } from '../../copy.ts';

  let { sections }: { sections: { id: string; label: string }[] } = $props();
  let active = $state<string | null>(null);
  let bar = $state<HTMLElement | null>(null);

  /** The section whose top has passed just under the bar. */
  const LINE = 120;
  // After a tap, the tapped chip stays current while the page scrolls there.
  let lockedUntil = 0;

  function go(id: string): void {
    const section = document.getElementById(`sec-${id}`);
    if (!section) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    lockedUntil = Date.now() + 1000;
    section.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    section.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
    active = id;
  }

  $effect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (Date.now() < lockedUntil) return;
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      let current: string | null = null;
      for (const s of sections) {
        const el = document.getElementById(`sec-${s.id}`);
        if (el && el.getBoundingClientRect().top <= LINE) current = s.id;
      }
      active = atEnd && current ? (sections.at(-1)?.id ?? current) : current;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  });

  // Keep the current chip visible in the scrolling row.
  $effect(() => {
    if (!active || !bar) return;
    const chip = bar.querySelector<HTMLElement>(`[data-id="${active}"]`);
    if (chip) bar.scrollTo({ left: Math.max(0, chip.offsetLeft - 16), behavior: 'auto' });
  });
</script>

<nav class="jump" aria-label={copy.analysis.jumpLabel} data-testid="jump-bar">
  <div class="row" bind:this={bar}>
    {#each sections as s (s.id)}
      <button
        type="button"
        class="chip-btn"
        data-id={s.id}
        data-testid="jump-{s.id}"
        aria-current={active === s.id ? 'location' : undefined}
        onclick={() => go(s.id)}
      >
        {s.label}
      </button>
    {/each}
  </div>
</nav>

<style>
  .jump {
    position: sticky;
    top: 0;
    z-index: 5;
    margin: 16px -16px 0;
    padding: 8px 0;
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
  }
  .row {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding: 0 16px;
    scrollbar-width: none;
  }
  .row::-webkit-scrollbar {
    display: none;
  }
  .chip-btn {
    flex: none;
    min-height: 34px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }
  .chip-btn[aria-current='location'] {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-text);
  }
</style>
