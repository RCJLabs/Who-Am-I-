<script lang="ts">
  import { challengeSummary } from '../../engine/shifts.ts';
  import { app } from '../context.ts';
  import { copy } from '../copy.ts';
  import { to } from '../routes.ts';
  import { answerLabel, topicStatus } from '../view.ts';
  import EvidenceBadge from '../components/EvidenceBadge.svelte';
  import NotFound from './NotFound.svelte';

  let { topicId }: { topicId: string } = $props();
  const { content, answers, settings } = app();
  const topic = $derived(content.bundle.topics.find((t) => t.id === topicId));
  const status = $derived(topic ? topicStatus(answers.state, topic, { alwaysDeep: settings.alwaysDeep }) : null);
  const summary = $derived(topic ? challengeSummary(answers.state, topic) : null);
  const result = $derived(topic ? answers.profile.topics[topic.id] : undefined);

  /** Answered items that still apply (hidden answers are dormant and not shown). */
  const rows = $derived(
    topic
      ? topic.items
          .filter((it) => it.type !== 'reask' && answers.state.latest.has(it.id) && (answers.state.visible.get(it.id) || it.sticky))
          .map((it) => {
            const ev = answers.state.latest.get(it.id)!;
            return { item: it, label: answerLabel(it, ev.r), note: ev.note };
          })
      : [],
  );

  function stanceStartLabel(): string | null {
    if (!topic?.stance) return null;
    const item = answers.state.ix.items.get(topic.stance)!;
    const first = (answers.state.history.get(topic.stance) ?? []).find((e) => e.r.kind === 'scale');
    return first ? answerLabel(item, first.r) : null;
  }
</script>

{#if !topic}
  <NotFound message={copy.flow.notFound} />
{:else}
  <div class="page">
    <p class="muted small"><a href={to.results()}>← {copy.results.title}</a></p>
    <h1>{topic.title}</h1>
    <p class="muted">{topic.summary}</p>
    <EvidenceBadge evidence={topic.evidence} />

    {#if result?.stanceLabel}
      {@const start = stanceStartLabel()}
      <section class="card section">
        <p class="small muted">{copy.flow.landed}</p>
        <p class="landed">{result.stanceLabel}</p>
        {#if start && start !== result.stanceLabel}<p class="small">{copy.flow.startedAt(start)}</p>{/if}
        {#if summary && summary.asked}
          <p class="small muted">{copy.results.challengesSummary(summary.asked, summary.held, summary.distinguished, summary.moved)}</p>
        {/if}
      </section>
    {/if}

    <section class="section">
      <p class="section-title">{copy.topicResults.yourAnswers}</p>
      {#each rows as row (row.item.id)}
        <div class="row" data-testid="answer-{row.item.key}">
          <div class="q">
            <p class="small muted qtext">{row.item.type === 'challenge' ? (row.item.name ?? row.item.text) : row.item.text}</p>
            <p class="a">{row.label}</p>
            {#if row.note}<p class="small note">“{row.note}”</p>{/if}
          </div>
          <a class="link-btn" href={to.flow(topic.id, row.item.key)}>{copy.topicResults.change}</a>
        </div>
      {:else}
        <p class="muted small">{copy.topicResults.notAnswered}</p>
      {/each}
    </section>

    {#if status && !status.complete}
      <a class="btn primary block section" href={to.flow(topic.id)}>{copy.topicResults.continue}</a>
    {/if}
  </div>
{/if}

<style>
  .landed {
    font-size: 1.2rem;
    font-weight: 650;
    margin: 2px 0 8px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
  }
  .q p {
    margin: 0 0 2px;
  }
  .a {
    font-weight: 600;
  }
  .note {
    font-style: italic;
    color: var(--muted);
  }
  .btn.section {
    margin-top: 24px;
  }
</style>
