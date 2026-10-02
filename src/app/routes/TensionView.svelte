<script lang="ts">
  // Revisit a tension from the results page.
  import type { TensionResolution } from '../../model/answers.ts';
  import { app } from '../context.ts';
  import { copy } from '../copy.ts';
  import { router } from '../router.svelte.ts';
  import { to } from '../routes.ts';
  import { toasts } from '../stores/toasts.svelte.ts';
  import TensionCard from '../components/flow/TensionCard.svelte';
  import NotFound from './NotFound.svelte';

  let { tensionKey }: { tensionKey: string } = $props();
  const { answers } = app();
  const tension = $derived(answers.tensions.find((t) => t.key === tensionKey));

  async function resolve(r: Pick<TensionResolution, 'kind' | 'reason' | 'text'>): Promise<void> {
    const t = tension;
    if (!t) return;
    const res: Omit<TensionResolution, 'id' | 'at'> = { key: t.key, kind: r.kind, principle: t.principle, basis: t.basis };
    if (r.reason) res.reason = r.reason;
    if (r.text) res.text = r.text;
    await answers.resolve(res);
    toasts.push(copy.tension.thanks);
    router.back(to.results());
  }

  function revise(itemId: string): void {
    const item = answers.state.ix.items.get(itemId);
    if (item) router.go(to.flow(item.topic, item.key));
  }
</script>

<div class="page">
  {#if tension}
    <TensionCard {tension} onresolve={resolve} onrevise={revise} onnotnow={() => router.back(to.results())} />
  {:else}
    <NotFound message={copy.results.tensionsEmpty} />
  {/if}
</div>
