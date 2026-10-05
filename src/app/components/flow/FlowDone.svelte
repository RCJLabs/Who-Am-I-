<script lang="ts">
  import { IDENTITY_DOMAIN, type Topic } from '../../../model/content.ts';
  import { challengeSummary } from '../../../engine/shifts.ts';
  import { app } from '../../context.ts';
  import { copy } from '../../copy.ts';
  import { router } from '../../router.svelte.ts';
  import { to } from '../../routes.ts';
  import { answerLabel, nextTopic } from '../../view.ts';
  import BackupNudge from '../BackupNudge.svelte';
  import Icon from '../Icon.svelte';

  let { topic }: { topic: Topic } = $props();
  const { content, answers, settings } = app();

  const stanceItem = $derived(topic.stance ? answers.state.ix.items.get(topic.stance) : undefined);
  const stanceHistory = $derived(topic.stance ? (answers.state.history.get(topic.stance) ?? []).filter((e) => e.r.kind === 'scale') : []);
  const landed = $derived(stanceItem && stanceHistory.length ? answerLabel(stanceItem, stanceHistory.at(-1)!.r) : null);
  const started = $derived(stanceItem && stanceHistory.length ? answerLabel(stanceItem, stanceHistory[0]!.r) : null);
  const summary = $derived(challengeSummary(answers.state, topic));
  const next = $derived(nextTopic(content.bundle, answers.state, topic.id, { alwaysDeep: settings.alwaysDeep }));

  /** Out of questions about you, every way on replaces this page in history, so Back can't reopen it. */
  function onward(e: MouseEvent): void {
    if (topic.domain !== IDENTITY_DOMAIN) return;
    e.preventDefault();
    router.go((e.currentTarget as HTMLAnchorElement).getAttribute('href')!, { replace: true });
  }

  function sourceName(id: string): string {
    const item = answers.state.ix.items.get(id);
    if (!item) return id;
    if (item.type === 'challenge') return item.name ?? item.text;
    return 'Thinking it over';
  }
</script>

<section class="done" data-testid="topic-done">
  <p class="badge"><Icon name="check" size={28} /></p>
  <h2>{copy.flow.doneTitle(topic.title)}</h2>

  {#if landed}
    <div class="card">
      <p class="small muted">{copy.flow.landed}</p>
      <p class="landed" data-testid="landed">{landed}</p>
      {#if started && started !== landed}
        <p class="small">{copy.flow.startedAt(started)}</p>
      {/if}
      {#each summary.moves as m, i (i)}
        {#if m.steps}<p class="small" data-testid="moved">{copy.flow.moved(m.steps, sourceName(m.source))}</p>{/if}
      {/each}
      {#if summary.asked > 0 && summary.moved === 0}
        <p class="small muted">{copy.flow.heldAll(summary.asked)}</p>
      {/if}
    </div>
  {/if}

  <!-- Never a prompt to export right after describing yourself. -->
  {#if topic.domain !== IDENTITY_DOMAIN}<BackupNudge />{/if}

  <div class="actions">
    {#if next}
      <a class="btn primary block" href={to.flow(next.id)} onclick={onward} data-testid="next-topic">{copy.flow.nextTopic(next.title)}</a>
    {/if}
    <a class="btn block" href={to.results()} onclick={onward} data-testid="see-results">{copy.flow.seeResults}</a>
    <a class="btn ghost block" href={to.topicResults(topic.id)} onclick={onward} data-testid="review-answers">{copy.flow.reviewAnswers}</a>
  </div>
</section>

<style>
  .done {
    text-align: center;
    padding-top: 12px;
  }
  .badge {
    display: inline-flex;
    padding: 12px;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--accent);
  }
  .card {
    text-align: left;
    margin: 16px 0;
  }
  .landed {
    font-size: 1.2rem;
    font-weight: 650;
    margin: 2px 0 8px;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 16px;
  }
</style>
