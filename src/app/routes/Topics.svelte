<script lang="ts">
  import { IDENTITY_DOMAIN, type Topic } from '../../model/content.ts';
  import { app } from '../context.ts';
  import { copy } from '../copy.ts';
  import { to } from '../routes.ts';
  import { topicStatus } from '../view.ts';
  import EvidenceBadge from '../components/EvidenceBadge.svelte';
  import Icon from '../components/Icon.svelte';

  const { content, answers, settings } = app();
  const opts = $derived({ alwaysDeep: settings.alwaysDeep });
  const groups = $derived(
    content.bundle.domains.map((domain) => {
      const topics = content.bundle.topics.filter((t) => t.domain === domain.id);
      return { domain, core: topics.filter((t) => t.tier === 'core'), deep: topics.filter((t) => t.tier === 'extended') };
    }),
  );
  const withTopics = $derived(groups.filter((g) => g.core.length || g.deep.length));
  const planned = $derived(groups.filter((g) => !g.core.length && !g.deep.length));
  // Questions about you stay folded away, with no titles or progress showing, until asked for each
  // time: the list may be open on a shared phone.
  let aboutOpen = $state(false);
</script>

{#snippet row(topic: Topic)}
  {@const st = topicStatus(answers.state, topic, opts)}
  <a class="card row" href={to.flow(topic.id)} data-testid="topic-{topic.id}">
    <span class="main">
      <span class="title">
        {topic.title}
        {#if topic.sensitive}<span title={copy.topics.sensitive}><Icon name="lock" size={14} label={copy.topics.sensitive} /></span>{/if}
      </span>
      <span class="muted small">{topic.summary}</span>
      {#if topic.domain !== IDENTITY_DOMAIN}<span class="meta"><EvidenceBadge evidence={topic.evidence} /></span>{/if}
    </span>
    <span class="status">
      {#if st.complete}
        <span class="chip success"><Icon name="check" size={14} /> {copy.topics.done}</span>
      {:else if st.started}
        <span class="chip accent">{copy.topics.left(st.remaining)}</span>
      {:else}
        <span class="chip">{copy.topics.start}</span>
      {/if}
    </span>
  </a>
{/snippet}

<div class="page">
  <h1>{copy.topics.title}</h1>
  <p class="muted">{copy.topics.intro}</p>

  {#each withTopics as g (g.domain.id)}
    {#if g.domain.id === IDENTITY_DOMAIN}
      <section class="section" data-testid="about-you">
        <h2 class="domain">{g.domain.title} <span class="tag muted">· {copy.topics.aboutYou.tag}</span></h2>
        <p class="muted small">{g.domain.blurb}</p>
        {#if aboutOpen}
          <p class="card note" data-testid="about-you-note">{copy.topics.aboutYou.note}</p>
          {#each [...g.core, ...g.deep] as topic (topic.id)}{@render row(topic)}{/each}
          <button class="btn ghost block fold" onclick={() => (aboutOpen = false)} data-testid="about-you-close">{copy.topics.aboutYou.close}</button>
        {:else}
          <button class="btn block fold" onclick={() => (aboutOpen = true)} data-testid="about-you-open">
            <Icon name="lock" size={16} />
            {copy.topics.aboutYou.open}
          </button>
        {/if}
      </section>
    {:else}
      <section class="section">
        <h2 class="domain">{g.domain.title}</h2>
        <p class="muted small">{g.domain.blurb}</p>
        {#each g.core as topic (topic.id)}{@render row(topic)}{/each}
        {#if g.deep.length}
          <h3 class="deep" data-testid="deep-dives-{g.domain.id}">{copy.topics.deepDives}</h3>
          {#each g.deep as topic (topic.id)}{@render row(topic)}{/each}
        {/if}
      </section>
    {/if}
  {/each}

  {#if planned.length}
    <section class="section">
      <p class="section-title">{copy.topics.comingSoon}</p>
      <p class="muted small">{copy.topics.comingSoonNote}</p>
      <ul class="planned">
        {#each planned as g (g.domain.id)}<li><strong>{g.domain.title}</strong> <span class="muted small">{g.domain.blurb}</span></li>{/each}
      </ul>
    </section>
  {/if}
</div>

<style>
  .domain {
    margin-bottom: 2px;
  }
  .tag {
    font-size: 0.9rem;
    font-weight: 500;
  }
  .note {
    margin: 12px 0 4px;
    font-size: 0.95rem;
  }
  .fold {
    margin-top: 12px;
  }
  .deep {
    margin: 20px 0 0;
    font-size: 0.9rem;
    color: var(--muted);
  }
  .row {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    color: inherit;
    text-decoration: none;
    margin-top: 10px;
  }
  .main {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .title {
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .meta {
    margin-top: 4px;
  }
  .planned {
    padding-left: 18px;
  }
  .planned li {
    margin: 6px 0;
  }
</style>
