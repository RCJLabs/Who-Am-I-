<script lang="ts">
  // Answers about you, as given: hidden until asked for each time, hidden again when the app goes
  // to the background, and never printed. Questions skipped or declined aren't listed, so "Prefer
  // not to say" doesn't stand out.
  import { IDENTITY_DOMAIN } from '../../../model/content.ts';
  import { app } from '../../context.ts';
  import { copy } from '../../copy.ts';
  import { to } from '../../routes.ts';
  import { answerLabel } from '../../view.ts';
  import Icon from '../Icon.svelte';
  import RemoveIdentity from '../RemoveIdentity.svelte';

  const { content, answers } = app();
  const C = copy.aboutYou;

  let shown = $state(false);
  $effect(() => {
    const hide = () => {
      if (document.hidden) shown = false;
    };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  });

  const groups = $derived(
    content.bundle.topics
      .filter((t) => t.domain === IDENTITY_DOMAIN)
      .map((topic) => ({
        topic,
        rows: topic.items
          .filter((it) => answers.state.values.has(it.id) && answers.state.visible.get(it.id))
          .map((it) => ({ item: it, label: answerLabel(it, answers.state.latest.get(it.id)!.r) })),
      }))
      .filter((g) => g.rows.length),
  );
</script>

<p class="muted intro">{C.intro}</p>

{#if shown}
  <div class="no-print" data-testid="identity-answers">
    {#each groups as g (g.topic.id)}
      <section class="card group">
        <h2 class="group-title">{g.topic.title}</h2>
        {#each g.rows as row (row.item.id)}
          <div class="row" data-testid="identity-answer-{row.item.id}">
            <div>
              <p class="small muted q">{row.item.text}</p>
              <p class="a">{row.label}</p>
            </div>
            <a class="link-btn" href={to.flow(g.topic.id, row.item.key)}>{C.change}</a>
          </div>
        {/each}
      </section>
    {/each}
    <button class="btn block" onclick={() => (shown = false)} data-testid="identity-hide">{C.hide}</button>
  </div>
{:else}
  <button class="btn primary block no-print" onclick={() => (shown = true)} data-testid="identity-show">
    <Icon name="lock" size={18} />
    {C.show}
  </button>
{/if}
<p class="print-only muted">{C.notPrinted}</p>

<section class="section remove no-print">
  <p class="small muted">{copy.settings.identityExplain}</p>
  <RemoveIdentity />
</section>

<style>
  .intro {
    margin: 0 0 16px;
  }
  .group {
    margin-bottom: 12px;
  }
  .group-title {
    font-size: 1rem;
    margin: 0 0 4px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    padding: 10px 0;
  }
  .row + .row {
    border-top: 1px solid var(--border);
  }
  .q {
    margin: 0 0 2px;
  }
  .a {
    margin: 0;
    font-weight: 600;
  }
  .remove {
    margin-top: 28px;
  }
</style>
