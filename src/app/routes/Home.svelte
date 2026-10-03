<script lang="ts">
  import { app } from '../context.ts';
  import { copy } from '../copy.ts';
  import { to } from '../routes.ts';
  import { activeTopic, nextTopic, topicStatus } from '../view.ts';
  import BackupNudge from '../components/BackupNudge.svelte';
  import Icon from '../components/Icon.svelte';

  const { content, answers, settings } = app();
  const opts = $derived({ alwaysDeep: settings.alwaysDeep });
  const isNew = $derived(answers.events.length === 0);
  const active = $derived(activeTopic(answers.state, opts));
  const activeStatus = $derived(active ? topicStatus(answers.state, active, opts) : null);
  const upNext = $derived(nextTopic(content.bundle, answers.state, active?.id, opts));
  const finished = $derived(content.bundle.topics.filter((t) => topicStatus(answers.state, t, opts).complete).length);
  const total = content.bundle.topics.length;
  const firstTopic = content.bundle.topics.find((t) => t.domain === 'personality') ?? content.bundle.topics[0];
</script>

<div class="page">
  <header class="hero">
    <h1>{copy.appName}</h1>
    <p class="tagline">{copy.tagline}</p>
  </header>

  {#if isNew}
    <section class="card">
      <h2>{copy.home.howTitle}</h2>
      <ol class="how">
        {#each copy.home.how as line, i (i)}<li>{line}</li>{/each}
      </ol>
      <p class="muted small privacy"><Icon name="lock" size={16} /> {copy.privacy}</p>
      <div class="btn-row">
        {#if firstTopic}
          <a class="btn primary block" href={to.flow(firstTopic.id)} data-testid="start">
            {copy.home.startPersonality}
          </a>
          <p class="muted small center note">{copy.home.startPersonalityNote}</p>
        {/if}
        <a class="btn block" href={to.topics()}>{copy.home.browse}</a>
      </div>
    </section>
  {:else}
    <BackupNudge />

    {#if active && activeStatus}
      <section class="section">
        <p class="section-title">{copy.home.continueTitle}</p>
        <a class="card topic-link" href={to.flow(active.id)} data-testid="continue">
          <span>{copy.home.continueTopic(active.title, activeStatus.remaining)}</span>
          <Icon name="right" />
        </a>
      </section>
    {/if}

    {#if upNext}
      <section class="section">
        <p class="section-title">{copy.home.nextTitle}</p>
        <a class="card topic-link" href={to.flow(upNext.id)}>
          <span>
            <strong>{upNext.title}</strong><br />
            <span class="muted small">{upNext.summary}</span>
          </span>
          <Icon name="right" />
        </a>
      </section>
    {:else}
      <p class="card">{copy.home.allDone}</p>
    {/if}

    <section class="section">
      <p class="muted">{copy.home.progress(finished, total)}</p>
      <div class="btn-row">
        <a class="btn primary" href={to.results()}>{copy.home.seeResults}</a>
        <a class="btn" href={to.topics()}>{copy.home.browse}</a>
      </div>
    </section>
  {/if}
</div>

<style>
  .hero {
    padding: 28px 0 12px;
  }
  .hero h1 {
    font-size: 2.2rem;
    margin-bottom: 4px;
  }
  .tagline {
    font-size: 1.15rem;
    color: var(--muted);
  }
  .how {
    padding-left: 20px;
  }
  .how li {
    margin: 8px 0;
  }
  .privacy {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .note {
    width: 100%;
    margin: -4px 0 0;
  }
  .topic-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: inherit;
    text-decoration: none;
  }
</style>
