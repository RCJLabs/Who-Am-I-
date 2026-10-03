<script lang="ts">
  // Renders its children once the domains they need have loaded (see stores/content.svelte.ts).
  // Usually that's immediate: the service worker has every domain cached after the first visit.
  import type { Snippet } from 'svelte';
  import { app } from '../context.ts';
  import { copy } from '../copy.ts';

  let { domains, children }: { domains: readonly string[] | 'all'; children: Snippet } = $props();
  const { content } = app();

  const ready = $derived(domains === 'all' ? content.hasAll() : domains.every((d) => content.has(d)));
  let loaded = $state(false);
  let failed = $state(false);
  // Show "Loading…" only if it takes long enough to notice.
  let slow = $state(false);

  $effect(() => {
    const timer = setTimeout(() => (slow = true), 300);
    void (domains === 'all' ? content.ensureAll() : content.ensure(domains)).then((ok) => {
      clearTimeout(timer);
      loaded = ok;
      failed = !ok;
    });
    return () => clearTimeout(timer);
  });
</script>

{#if ready || loaded}
  {@render children()}
{:else if failed}
  <div class="page center" role="alert">
    <p class="muted">{copy.loading.failed}</p>
    <button class="btn primary" onclick={() => location.reload()}>{copy.loading.retry}</button>
  </div>
{:else if slow}
  <div class="page center"><p class="muted" aria-live="polite">{copy.loading.text}</p></div>
{/if}
