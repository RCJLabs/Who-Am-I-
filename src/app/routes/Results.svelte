<script lang="ts">
  import type { Item } from '../../model/content.ts';
  import { isMixed } from '../../engine/score.ts';
  import { app } from '../context.ts';
  import { copy } from '../copy.ts';
  import { to } from '../routes.ts';
  import { axisFeeders } from '../view.ts';
  import SpectrumBar from '../components/results/SpectrumBar.svelte';
  import Icon from '../components/Icon.svelte';

  const { bundle, answers } = app();
  const profile = $derived(answers.profile);
  const feeders = axisFeeders(bundle);
  const axes = Object.values(bundle.axes);
  const political = axes.filter((a) => a.family === 'political');
  const personality = axes.filter((a) => a.family === 'personality');
  const taste = axes.filter((a) => a.family === 'taste');

  const hasAny = $derived(answers.events.length > 0);
  const personalityScored = $derived(personality.some((a) => profile.axes[a.id]?.score !== null));
  const tasteScored = $derived(taste.filter((a) => profile.axes[a.id]?.score !== null));
  const positions = $derived(bundle.topics.filter((t) => t.stance && profile.topics[t.id]?.stance !== null && profile.topics[t.id] !== undefined));
  const tensions = $derived([...answers.tensions].sort((a, b) => Number(a.status !== 'open') - Number(b.status !== 'open') || b.rank - a.rank));
  const principles = $derived(Object.values(bundle.principles).filter((p) => profile.principles[p.id]?.score !== null));

  /** Multi-select picks, strongest first, with their labels. */
  const enjoys = $derived.by(() => {
    const out: { key: string; label: string; v: number }[] = [];
    for (const [key, v] of Object.entries(profile.interests)) {
      const parts = key.split('.');
      if (parts.length !== 3) continue;
      const item = answers.state.ix.items.get(`${parts[0]}.${parts[1]}`);
      const label = item && item.type === 'multi' ? item.options.find((o) => o.id === parts[2])?.label : undefined;
      if (label) out.push({ key, label, v });
    }
    return out.sort((a, b) => b.v - a.v);
  });

  function sourceName(id: string): string {
    const item = answers.state.ix.items.get(id);
    if (item?.type === 'challenge') return item.name ?? item.text;
    return 'Thinking it over';
  }

  function toward(stance: Item | undefined, delta: number): string {
    if (!stance) return '';
    if (stance.type === 'slider' || stance.type === 'rating') return delta > 0 ? stance.poles[1] : stance.poles[0];
    return delta > 0 ? 'agree' : 'disagree';
  }
</script>

<div class="page">
  <h1>{copy.results.title}</h1>

  {#if !hasAny}
    <div class="card center">
      <p>{copy.results.empty}</p>
      <a class="btn primary" href={to.topics()}>{copy.results.emptyCta}</a>
    </div>
  {:else}
    <p class="muted small">{copy.results.selfReport}</p>

    <section class="section">
      <p class="section-title">{copy.results.political}</p>
      <div class="card">
        {#each political as a (a.id)}
          {@const sc = profile.axes[a.id]!}
          <SpectrumBar
            title={a.title}
            poles={a.poles}
            score={sc.score}
            confidence={sc.confidence}
            description={a.description}
            mixed={isMixed(sc, bundle)}
            feeders={feeders.get(a.id) ?? []}
            testid="axis-{a.id}"
          />
        {/each}
      </div>
    </section>

    {#if positions.length}
      <section class="section">
        <p class="section-title">{copy.results.topics}</p>
        {#each positions as t (t.id)}
          {@const r = profile.topics[t.id]!}
          {@const stance = t.stance ? answers.state.ix.items.get(t.stance) : undefined}
          <a class="card topic" href={to.topicResults(t.id)} data-testid="position-{t.id}">
            <span class="topic-head">
              <strong>{t.title}</strong>
              <Icon name="right" size={18} />
            </span>
            <span class="stance">{r.stanceLabel ?? ''}</span>
            {#if r.challenges.asked}
              <span class="small muted">{copy.results.challengesSummary(r.challenges.asked, r.challenges.held, r.challenges.distinguished, r.challenges.moved)}</span>
            {/if}
            {#each r.challenges.moves as m, i (i)}
              {#if m.steps}
                <span class="small moved" data-testid="moved-{t.id}">{copy.results.movedLine(sourceName(m.source), m.steps, toward(stance, m.delta))}</span>
              {/if}
            {/each}
          </a>
        {/each}
      </section>
    {/if}

    <section class="section">
      <p class="section-title">{copy.results.tensions}</p>
      {#if tensions.length}
        {#each tensions as t (t.key)}
          {@const pr = bundle.principles[t.principle]}
          <div class="card tension" data-testid="tension-row">
            <p class="tension-title">
              <strong>{pr?.label}</strong>:
              {answers.state.ix.topics.get(t.a.topic)?.title} vs. {answers.state.ix.topics.get(t.b.topic)?.title}
            </p>
            <p class="small muted">
              {t.status === 'open' ? copy.results.status.open : copy.results.status[t.resolution?.kind ?? 'acknowledged']}
            </p>
            <a class="btn" href={to.tension(t.key)}>{copy.results.revisit}</a>
          </div>
        {/each}
      {:else}
        <p class="muted small">{copy.results.tensionsEmpty}</p>
      {/if}
    </section>

    {#if principles.length}
      <section class="section">
        <p class="section-title">{copy.results.principles}</p>
        <p class="muted small">{copy.results.principlesNote}</p>
        <div class="card">
          {#each principles as p (p.id)}
            {@const sc = profile.principles[p.id]!}
            <SpectrumBar
              title={p.label}
              poles={['Rejects', 'Endorses']}
              score={sc.score}
              confidence={sc.confidence}
              description={sc.consistency !== null ? `${p.definition} ${copy.results.consistency(sc.consistency)}.` : p.definition}
            />
          {/each}
        </div>
      </section>
    {/if}

    <section class="section">
      <p class="section-title">{copy.results.personality}</p>
      <p class="muted small">{copy.results.personalityNote}</p>
      <div class="card">
        {#if personalityScored}
          {#each personality as a (a.id)}
            {@const sc = profile.axes[a.id]!}
            <SpectrumBar title={a.title} poles={a.poles} score={sc.score} confidence={sc.confidence} description={a.description} feeders={feeders.get(a.id) ?? []} testid="axis-{a.id}" />
          {/each}
        {:else}
          <p class="small muted">
            {copy.results.notEnough}
            {#each feeders.get('extraversion') ?? [] as t (t.id)}<a href={to.flow(t.id)}>{t.title}</a>{/each}
          </p>
        {/if}
      </div>
    </section>

    {#if tasteScored.length || enjoys.length}
      <section class="section">
        <p class="section-title">{copy.results.taste}</p>
        <div class="card">
          {#each tasteScored as a (a.id)}
            {@const sc = profile.axes[a.id]!}
            <SpectrumBar title={a.title} poles={a.poles} score={sc.score} confidence={sc.confidence} description={a.description} />
          {/each}
          {#if enjoys.length}
            <h3 class="enjoy-title">{copy.results.interests}</h3>
            <div class="chips">
              {#each enjoys as e (e.key)}
                <span class="chip enjoy" style:--strength={e.v}>{e.label}</span>
              {/each}
            </div>
          {/if}
        </div>
      </section>
    {/if}
  {/if}
</div>

<style>
  .topic {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: inherit;
    text-decoration: none;
    margin-top: 10px;
  }
  .topic-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .stance {
    font-weight: 600;
    color: var(--accent);
  }
  .moved {
    color: var(--text);
  }
  .tension {
    margin-top: 10px;
  }
  .tension-title {
    margin: 0 0 4px;
  }
  .tension p.small {
    margin-bottom: 10px;
  }
  .enjoy-title {
    margin-top: 16px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .enjoy {
    font-size: 0.85rem;
    color: var(--text);
    background: color-mix(in srgb, var(--accent-soft) calc(var(--strength) * 100%), transparent);
  }
</style>
