<script lang="ts">
  import type { Item } from '../../model/content.ts';
  import { isMixed } from '../../engine/score.ts';
  import { app } from '../context.ts';
  import { copy } from '../copy.ts';
  import { to } from '../routes.ts';
  import { axisFeeders, challengeTotals, positionLabel, positionsByDomain, rankedPrinciples, strongestLeanings } from '../view.ts';
  import ChallengeBar from '../components/results/ChallengeBar.svelte';
  import PoliticalMap from '../components/results/PoliticalMap.svelte';
  import PrincipleChart from '../components/results/PrincipleChart.svelte';
  import SpectrumRow from '../components/results/SpectrumRow.svelte';
  import Icon from '../components/Icon.svelte';

  /** Tension cards shown before "Show all". */
  const TENSION_GROUPS_SHOWN = 3;
  /** Up to this many positions, every domain starts open. */
  const POSITIONS_OPEN = 6;

  const { content, answers } = app();
  const profile = $derived(answers.profile);
  const feeders = axisFeeders(content.bundle);
  const axes = Object.values(content.bundle.axes);
  const political = axes.filter((a) => a.family === 'political');
  const values = axes.filter((a) => a.family === 'values');
  const thinking = axes.filter((a) => a.family === 'thinking');
  const worldview = axes.filter((a) => a.family === 'worldview');
  const personality = axes.filter((a) => a.family === 'personality');
  const taste = axes.filter((a) => a.family === 'taste');
  const economicAxis = content.bundle.axes['economic'];
  const civilAxis = content.bundle.axes['civil'];

  const hasAny = $derived(answers.events.length > 0);
  const answeredTopics = $derived(Object.values(profile.topics).length);
  const personalityScored = $derived(personality.some((a) => profile.axes[a.id]?.score !== null));
  const tasteScored = $derived(taste.filter((a) => profile.axes[a.id]?.score !== null));
  // Sensitive: shown once answered, never as a "not yet" nudge toward questions about religion.
  const worldviewScored = $derived(worldview.filter((a) => profile.axes[a.id]?.score !== null));

  // Overview
  const econ = $derived(profile.axes['economic']?.score ?? null);
  const civil = $derived(profile.axes['civil']?.score ?? null);
  const mapLow = $derived(Math.min(profile.axes['economic']?.confidence ?? 0, profile.axes['civil']?.confidence ?? 0) < 0.5);
  const leanings = $derived(strongestLeanings([...political, ...values], profile.axes));
  const ranked = $derived(rankedPrinciples(Object.values(content.bundle.principles), profile.principles));
  const leanMost = $derived(ranked.filter((r) => r.score >= 0.4).slice(0, 3));
  const totals = $derived(challengeTotals(profile.topics));

  // Tensions: one card per principle, most pressing first; open before resolved.
  const tensions = $derived([...answers.tensions].sort((a, b) => Number(a.status !== 'open') - Number(b.status !== 'open') || b.rank - a.rank));
  const tensionGroups = $derived.by(() => {
    const groups = new Map<string, typeof tensions>();
    for (const t of tensions) groups.set(t.principle, [...(groups.get(t.principle) ?? []), t]);
    return [...groups].map(([principle, items]) => ({ principle, items }));
  });
  const openTensions = $derived(tensions.filter((t) => t.status === 'open'));
  let showAllTensions = $state(false);
  const shownGroups = $derived(showAllTensions ? tensionGroups : tensionGroups.slice(0, TENSION_GROUPS_SHOWN));
  const pairLabel = (a: string, b: string) => `${topicTitle(a)} vs. ${topicTitle(b)}`;
  const openByPrinciple = $derived.by(() => {
    const m = new Map<string, { key: string; label: string }[]>();
    for (const t of openTensions) m.set(t.principle, [...(m.get(t.principle) ?? []), { key: t.key, label: pairLabel(t.a.topic, t.b.topic) }]);
    return m;
  });

  // Positions, grouped by domain.
  const positionGroups = $derived(positionsByDomain(content.bundle, profile.topics));
  const positionCount = $derived(positionGroups.reduce((n, g) => n + g.topics.length, 0));

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

  function topicTitle(id: string): string {
    return answers.state.ix.topics.get(id)?.title ?? id;
  }

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

  function scrollToId(id: string): void {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
</script>

{#snippet spectrum(a: (typeof axes)[number], withMixed: boolean)}
  {@const sc = profile.axes[a.id]!}
  <SpectrumRow
    title={a.title}
    poles={a.poles}
    score={sc.score}
    confidence={sc.confidence}
    description={a.description}
    mixed={withMixed && isMixed(sc, content.bundle)}
    feeders={feeders.get(a.id) ?? []}
    testid="axis-{a.id}"
  />
{/snippet}

<div class="page">
  <h1>{copy.results.title}</h1>

  {#if !hasAny}
    <div class="card center">
      <p>{copy.results.empty}</p>
      <a class="btn primary" href={to.topics()}>{copy.results.emptyCta}</a>
    </div>
  {:else}
    <p class="muted small">{copy.results.selfReport} {copy.results.basedOn(answeredTopics, content.bundle.topics.length)}</p>

    {#if (econ !== null && civil !== null) || leanings.length || leanMost.length || totals.asked}
      <section class="section" aria-labelledby="overview-title">
        <h2 class="section-title" id="overview-title">{copy.results.overview}</h2>
        <div class="card overview">
          {#if econ !== null && civil !== null && economicAxis && civilAxis}
            <PoliticalMap
              x={econ}
              y={civil}
              xPoles={economicAxis.poles}
              yPoles={civilAxis.poles}
              caption="{economicAxis.title}: {positionLabel(econ, economicAxis.poles)} · {civilAxis.title}: {positionLabel(civil, civilAxis.poles)}{mapLow ? ` (${copy.results.lowConfidence.toLowerCase()})` : ''}"
              low={mapLow}
            />
          {:else if econ !== null || civil !== null}
            <p class="small muted">{copy.results.mapNeeds}</p>
          {/if}
          {#if leanings.length || leanMost.length}
            <dl class="highlights">
              {#if leanings.length}
                <div>
                  <dt>{copy.results.clearest}</dt>
                  <dd class="leanings" data-testid="clearest">
                    {#each leanings as l (l.axis)}<span class="chip lean" title={l.title}>{l.label}</span>{/each}
                  </dd>
                </div>
              {/if}
              {#if leanMost.length}
                <div>
                  <dt>{copy.results.leanMost}</dt>
                  <dd>{leanMost.map((r) => r.principle.label).join(', ')}</dd>
                </div>
              {/if}
            </dl>
          {/if}
          {#if openTensions.length}
            <button type="button" class="jump" onclick={() => scrollToId('tensions')}>
              {copy.results.pullApart(openTensions.length)}
              <Icon name="right" size={16} />
            </button>
          {/if}
        </div>
        {#if totals.asked}
          <div class="card">
            <ChallengeBar {totals} />
          </div>
        {/if}
      </section>
    {/if}

    <section class="section" aria-labelledby="political-title">
      <h2 class="section-title" id="political-title">{copy.results.political}</h2>
      <div class="card rows">
        {#each political as a (a.id)}{@render spectrum(a, true)}{/each}
      </div>
    </section>

    {#if values.length}
      <section class="section" aria-labelledby="values-title">
        <h2 class="section-title" id="values-title">{copy.results.values}</h2>
        <div class="card rows">
          {#each values as a (a.id)}{@render spectrum(a, true)}{/each}
        </div>
      </section>
    {/if}

    {#if thinking.length}
      <section class="section" aria-labelledby="thinking-title">
        <h2 class="section-title" id="thinking-title">{copy.results.thinking}</h2>
        <div class="card rows">
          {#each thinking as a (a.id)}{@render spectrum(a, true)}{/each}
        </div>
      </section>
    {/if}

    {#if worldviewScored.length}
      <section class="section" aria-labelledby="worldview-title">
        <h2 class="section-title" id="worldview-title">{copy.results.worldview}</h2>
        <div class="card rows">
          {#each worldviewScored as a (a.id)}{@render spectrum(a, true)}{/each}
        </div>
      </section>
    {/if}

    <section class="section" id="tensions" aria-labelledby="tensions-title">
      <h2 class="section-title" id="tensions-title">{copy.results.tensions}</h2>
      {#if tensionGroups.length}
        <p class="muted small">{copy.results.tensionsCount(tensions.length, tensionGroups.length)}</p>
        {#each shownGroups as g (g.principle)}
          <div class="card tension">
            <p class="tension-title"><strong>{content.bundle.principles[g.principle]?.label}</strong></p>
            {#each g.items as t (t.key)}
              <a class="pair" href={to.tension(t.key)} data-testid="tension-row">
                <span class="pair-text">
                  <span>{pairLabel(t.a.topic, t.b.topic)}</span>
                  {#if t.status !== 'open'}
                    <span class="small resolved">{copy.results.status[t.resolution?.kind ?? 'acknowledged']}</span>
                  {/if}
                </span>
                <Icon name="right" size={18} />
              </a>
            {/each}
          </div>
        {/each}
        {#if tensionGroups.length > TENSION_GROUPS_SHOWN}
          <button
            type="button"
            class="btn ghost more"
            data-testid="show-all-tensions"
            aria-expanded={showAllTensions}
            onclick={() => (showAllTensions = !showAllTensions)}
          >
            {showAllTensions ? copy.results.showFewer : copy.results.showAll(tensionGroups.length)}
          </button>
        {/if}
      {:else}
        <p class="muted small">{copy.results.tensionsEmpty}</p>
      {/if}
    </section>

    {#if ranked.length}
      <section class="section" aria-labelledby="principles-title">
        <h2 class="section-title" id="principles-title">{copy.results.principles}</h2>
        <p class="muted small">{copy.results.principlesNote}</p>
        <div class="card">
          <PrincipleChart rows={ranked} {topicTitle} tensions={openByPrinciple} />
        </div>
      </section>
    {/if}

    <section class="section" aria-labelledby="personality-title">
      <h2 class="section-title" id="personality-title">{copy.results.personality}</h2>
      <p class="muted small">{copy.results.personalityNote}</p>
      <div class="card" class:rows={personalityScored}>
        {#if personalityScored}
          {#each personality as a (a.id)}{@render spectrum(a, false)}{/each}
        {:else}
          <p class="small muted flush">
            {copy.results.notEnough}
            {#each feeders.get('extraversion') ?? [] as t (t.id)}<a href={to.flow(t.id)}>{t.title}</a>{/each}
          </p>
        {/if}
      </div>
    </section>

    {#if positionGroups.length}
      <section class="section" aria-labelledby="positions-title">
        <h2 class="section-title" id="positions-title">{copy.results.topics}</h2>
        {#each positionGroups as g (g.domain.id)}
          {@const moved = g.topics.reduce((n, t) => n + (profile.topics[t.id]?.challenges.moved ?? 0), 0)}
          <details class="card domain" open={positionCount <= POSITIONS_OPEN}>
            <summary>
              <span class="domain-head">
                <strong>{g.domain.title}</strong>
                <span class="chev" aria-hidden="true"></span>
              </span>
              <span class="small muted">
                {copy.results.topicCount(g.topics.length)}{moved ? ` · ${copy.results.reconsideredCount(moved)}` : ''}
              </span>
            </summary>
            {#each g.topics as t (t.id)}
              {@const r = profile.topics[t.id]!}
              {@const stance = t.stance ? answers.state.ix.items.get(t.stance) : undefined}
              <a class="position" href={to.topicResults(t.id)} data-testid="position-{t.id}">
                <span class="position-text">
                  <span class="position-title">{t.title}</span>
                  <span class="stance">{r.stanceLabel ?? ''}</span>
                  {#each r.challenges.moves as m, i (i)}
                    {#if m.steps}
                      <span class="small moved" data-testid="moved-{t.id}">{copy.results.movedLine(sourceName(m.source), m.steps, toward(stance, m.delta))}</span>
                    {/if}
                  {/each}
                </span>
                <Icon name="right" size={18} />
              </a>
            {/each}
          </details>
        {/each}
      </section>
    {/if}

    {#if tasteScored.length || enjoys.length}
      <section class="section" aria-labelledby="taste-title">
        <h2 class="section-title" id="taste-title">{copy.results.taste}</h2>
        <div class="card rows">
          {#each tasteScored as a (a.id)}{@render spectrum(a, false)}{/each}
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
  .rows {
    padding-top: 4px;
    padding-bottom: 4px;
  }
  .overview {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .highlights {
    margin: 0;
    display: grid;
    gap: 10px;
  }
  .highlights dt {
    font-size: 0.8rem;
    color: var(--muted);
  }
  .highlights dd {
    margin: 2px 0 0;
    font-weight: 650;
  }
  .leanings {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .lean {
    font-size: 0.85rem;
    color: var(--accent);
    border-color: currentColor;
  }
  .flush {
    margin: 0;
  }
  .jump {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    align-self: flex-start;
    text-align: left;
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    font-weight: 600;
    color: var(--accent);
    cursor: pointer;
  }
  .tension {
    margin-top: 10px;
  }
  .tension-title {
    margin: 0 0 2px;
  }
  .pair {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
    min-height: 48px;
    color: inherit;
    text-decoration: none;
  }
  .pair + .pair {
    border-top: 1px solid var(--border);
  }
  .pair-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .resolved {
    color: var(--success);
  }
  .more {
    margin-top: 6px;
  }
  .domain {
    padding: 0 16px;
  }
  .domain + .domain {
    margin-top: 10px;
  }
  .domain summary {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 14px 0;
    list-style: none;
    cursor: pointer;
  }
  .domain summary::-webkit-details-marker {
    display: none;
  }
  .domain-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .chev {
    width: 8px;
    height: 8px;
    border-right: 2px solid var(--muted);
    border-bottom: 2px solid var(--muted);
    transform: translateY(-2px) rotate(45deg);
    transition: transform 0.15s;
  }
  .domain[open] .chev {
    transform: translateY(1px) rotate(-135deg);
  }
  .position {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 0;
    border-top: 1px solid var(--border);
    color: inherit;
    text-decoration: none;
  }
  .position-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .position-title {
    font-weight: 650;
  }
  .stance {
    color: var(--accent);
  }
  .moved {
    color: var(--text);
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
