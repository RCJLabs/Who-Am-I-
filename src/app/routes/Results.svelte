<script lang="ts">
  // Results: a written summary first, then one section per kind of result, each pairing a short
  // read-out with its chart, then next steps. The analysis runs on this device (see
  // docs/ANALYSIS.md); the summary and next steps use only answers that could ever be shared.
  import { untrack } from 'svelte';
  import type { AxisId, Item } from '../../model/content.ts';
  import { analyse } from '../../engine/analysis/index.ts';
  import { isMixed } from '../../engine/score.ts';
  import { composeAnalysis, type SectionId } from '../analysis/compose.ts';
  import { app } from '../context.ts';
  import { copy } from '../copy.ts';
  import { to } from '../routes.ts';
  import {
    axisFeeders,
    challengeTotals,
    interestList,
    positionLabel,
    positionsByDomain,
    rankedPrinciples,
    traditionRefs,
    traditionTable,
  } from '../view.ts';
  import ChallengeBar from '../components/results/ChallengeBar.svelte';
  import JumpBar from '../components/results/JumpBar.svelte';
  import NextSteps from '../components/results/NextSteps.svelte';
  import PoliticalMap from '../components/results/PoliticalMap.svelte';
  import PositionRow from '../components/results/PositionRow.svelte';
  import PrincipleChart from '../components/results/PrincipleChart.svelte';
  import ResultSection from '../components/results/ResultSection.svelte';
  import SpectrumRow from '../components/results/SpectrumRow.svelte';
  import SummaryCard from '../components/results/SummaryCard.svelte';
  import TraditionList from '../components/results/TraditionList.svelte';
  import Icon from '../components/Icon.svelte';

  /** Tension cards shown before "Show all". */
  const TENSION_GROUPS_SHOWN = 3;
  /** Up to this many positions, every domain starts open. */
  const POSITIONS_OPEN = 6;
  /** The two spectrums drawn as the political map. */
  const MAP_AXES = ['economic', 'civil'] as const;
  /** Topics listed per pole under "What pulled you". */
  const DRIVERS_SHOWN = 3;

  const { content, answers, settings } = app();
  const profile = $derived(answers.profile);
  const feeders = axisFeeders(content.bundle);
  const axes = Object.values(content.bundle.axes);
  const political = axes.filter((a) => a.family === 'political');
  const values = axes.filter((a) => a.family === 'values');
  const thinking = axes.filter((a) => a.family === 'thinking');
  const worldview = axes.filter((a) => a.family === 'worldview');
  const personality = axes.filter((a) => a.family === 'personality');
  const taste = axes.filter((a) => a.family === 'taste');
  const economicAxis = content.bundle.axes[MAP_AXES[0]];
  const civilAxis = content.bundle.axes[MAP_AXES[1]];

  const hasAny = $derived(answers.events.length > 0);
  const answeredTopics = $derived(Object.values(profile.topics).length);
  const personalityScored = $derived(personality.some((a) => profile.axes[a.id]?.score !== null));
  const tasteScored = $derived(taste.filter((a) => profile.axes[a.id]?.score !== null));
  // Sensitive: shown once answered, never as a "not yet" nudge toward questions about religion.
  const worldviewScored = $derived(worldview.filter((a) => profile.axes[a.id]?.score !== null));

  // Political traditions come in a separate pack, loaded once there are answers to compare.
  $effect(() => {
    if (hasAny) untrack(() => void content.ensureAnalysis());
  });
  const pack = $derived(content.analysisPack);

  // The written analysis. Lazy: the shared profile is only built when this page shows.
  const facts = $derived(
    hasAny
      ? analyse({
          state: answers.state,
          profile,
          publicProfile: answers.publicProfile,
          tensions: answers.tensions,
          flow: { alwaysDeep: settings.alwaysDeep },
          mapAxes: MAP_AXES,
          pack,
          links: settings.showLinks,
        })
      : null,
  );
  const interests = $derived(interestList(profile.interests, answers.state));
  const analysis = $derived(
    facts
      ? composeAnalysis({
          bundle: content.bundle,
          state: answers.state,
          facts,
          profile,
          publicProfile: answers.publicProfile,
          tensions: answers.tensions,
          interests,
          alwaysDeep: settings.alwaysDeep,
          pack,
          links: settings.showLinks,
        })
      : null,
  );
  const traditionsShown = $derived(content.analysisState !== 'ready' || analysis?.traditions !== null);
  // Reference marks: every tradition on the map, the named one on each political spectrum.
  const refs = $derived(pack && analysis?.traditions ? traditionRefs(pack, MAP_AXES, analysis.traditions.rows.map((r) => r.id), analysis.traditions.named) : []);
  const table = $derived(pack ? traditionTable(content.bundle, pack, profile, copy.analysis.traditions.table) : null);
  const reference = $derived(pack && analysis?.traditions?.reference ? pack.traditions.find((t) => t.id === analysis!.traditions!.reference!.id) ?? null : null);
  const referenceFor = (axis: AxisId) =>
    reference && !reference.divided.includes(axis) && reference.positions[axis] !== undefined ? { name: reference.name, score: reference.positions[axis] } : null;

  // Map
  const econ = $derived(profile.axes[MAP_AXES[0]]?.score ?? null);
  const civil = $derived(profile.axes[MAP_AXES[1]]?.score ?? null);
  const mapLow = $derived(Math.min(profile.axes[MAP_AXES[0]]?.confidence ?? 0, profile.axes[MAP_AXES[1]]?.confidence ?? 0) < 0.5);
  const ranked = $derived(rankedPrinciples(Object.values(content.bundle.principles), profile.principles));
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
  const picks = $derived(interests.filter((e) => e.kind === 'pick'));
  const ratings = $derived(interests.filter((e) => e.kind === 'rating'));

  // Sections in page order; the jump bar lists the ones that show.
  const sections = $derived.by(() => {
    const out: { id: SectionId | 'next'; label: string }[] = [];
    const add = (id: SectionId | 'next', show: boolean) => show && out.push({ id, label: copy.analysis.sections[id] });
    add('politics', true);
    add('values', values.length > 0);
    add('thinking', thinking.length > 0);
    add('worldview', worldviewScored.length > 0);
    add('personality', true);
    add('principles', ranked.length > 0);
    add('tensions', true);
    add('positions', positionGroups.length > 0);
    add('taste', tasteScored.length > 0 || interests.length > 0);
    add('next', (analysis?.next.length ?? 0) > 0);
    return out;
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

  function drivers(axis: AxisId, poles: [string, string]) {
    const fact = facts && Object.values(facts.axes).flat().find((f) => f.axis === axis);
    if (!fact) return [];
    return fact.drivers.map((list, k) => ({
      pole: poles[k]!,
      topics: list.slice(0, DRIVERS_SHOWN).map((d) => ({ id: d.topic, title: topicTitle(d.topic) })),
    }));
  }

  // Printing shows every section in full.
  $effect(() => {
    const open = () => document.querySelectorAll('details').forEach((d) => (d.open = true));
    window.addEventListener('beforeprint', open);
    return () => window.removeEventListener('beforeprint', open);
  });

  function goTo(id: string): void {
    const section = document.getElementById(`sec-${id}`);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    section?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    section?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }
</script>

{#snippet spectrum(a: (typeof axes)[number], withMixed: boolean)}
  {@const sc = profile.axes[a.id]!}
  <SpectrumRow
    reference={a.family === 'political' ? referenceFor(a.id) : null}
    title={a.title}
    poles={a.poles}
    score={sc.score}
    confidence={sc.confidence}
    description={a.description}
    mixed={withMixed && isMixed(sc, content.bundle)}
    feeders={feeders.get(a.id) ?? []}
    drivers={drivers(a.id, a.poles)}
    testid="axis-{a.id}"
  />
{/snippet}

<div class="page">
  <h1>{copy.results.title}</h1>

  {#if !hasAny || !analysis}
    <div class="card center">
      <p>{copy.results.empty}</p>
      <a class="btn primary" href={to.topics()}>{copy.results.emptyCta}</a>
    </div>
  {:else}
    <SummaryCard
      summary={analysis.summary}
      footer="{copy.results.selfReport} {copy.results.basedOn(answeredTopics, content.bundle.topics.length)}"
      onTensions={() => goTo('tensions')}
    />

    <JumpBar {sections} />

    <ResultSection id="politics" title={copy.analysis.sections.politics} readout={analysis.readouts.politics}>
      {#if econ !== null || civil !== null}
      <div class="card">
        {#if econ !== null && civil !== null && economicAxis && civilAxis}
          <PoliticalMap
            x={econ}
            y={civil}
            xPoles={economicAxis.poles}
            yPoles={civilAxis.poles}
            caption="{economicAxis.title}: {positionLabel(econ, economicAxis.poles)} · {civilAxis.title}: {positionLabel(civil, civilAxis.poles)}{mapLow ? ` (${copy.results.lowConfidence.toLowerCase()})` : ''}"
            low={mapLow}
            {refs}
            {table}
          />
        {:else}
          <p class="small muted flush">{copy.results.mapNeeds}</p>
        {/if}
      </div>
      {/if}
      <div class="card rows">
        {#each political as a (a.id)}{@render spectrum(a, true)}{/each}
        {#if reference}<p class="small muted tick">{copy.analysis.traditions.tick(reference.name)}</p>{/if}
      </div>
      {#if traditionsShown}
        <TraditionList view={analysis.traditions} state={content.analysisState} />
      {/if}
    </ResultSection>

    {#if values.length}
      <ResultSection id="values" title={copy.analysis.sections.values} readout={analysis.readouts.values}>
        <div class="card rows">
          {#each values as a (a.id)}{@render spectrum(a, true)}{/each}
        </div>
      </ResultSection>
    {/if}

    {#if thinking.length}
      <ResultSection id="thinking" title={copy.analysis.sections.thinking} readout={analysis.readouts.thinking}>
        <div class="card rows">
          {#each thinking as a (a.id)}{@render spectrum(a, true)}{/each}
        </div>
        {#if totals.asked}
          <div class="card">
            <ChallengeBar {totals} />
          </div>
        {/if}
      </ResultSection>
    {/if}

    {#if worldviewScored.length}
      <ResultSection id="worldview" title={copy.analysis.sections.worldview} readout={analysis.readouts.worldview}>
        <div class="card rows">
          {#each worldviewScored as a (a.id)}{@render spectrum(a, true)}{/each}
        </div>
      </ResultSection>
    {/if}

    <ResultSection id="personality" title={copy.analysis.sections.personality} readout={analysis.readouts.personality} note={copy.results.personalityNote}>
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
    </ResultSection>

    {#if ranked.length}
      <ResultSection id="principles" title={copy.analysis.sections.principles} readout={analysis.readouts.principles} note={copy.results.principlesNote}>
        <div class="card">
          <PrincipleChart rows={ranked} {topicTitle} tensions={openByPrinciple} />
        </div>
      </ResultSection>
    {/if}

    <ResultSection id="tensions" title={copy.analysis.sections.tensions} readout={analysis.readouts.tensions}>
      {#if tensionGroups.length}
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
    </ResultSection>

    {#if positionGroups.length}
      <ResultSection id="positions" title={copy.analysis.sections.positions} readout={analysis.readouts.positions}>
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
              <PositionRow
                topic={t}
                href={to.topicResults(t.id)}
                label={r.stanceLabel ?? ''}
                stance={r.stanceLabel === null ? null : r.stance}
                initial={r.initialStance}
                poles={stance && (stance.type === 'slider' || stance.type === 'rating') ? stance.poles : null}
                moves={r.challenges.moves.filter((m) => m.steps).map((m) => copy.results.movedLine(sourceName(m.source), m.steps!, toward(stance, m.delta)))}
              />
            {/each}
          </details>
        {/each}
      </ResultSection>
    {/if}

    {#if tasteScored.length || interests.length}
      <ResultSection id="taste" title={copy.analysis.sections.taste} readout={analysis.readouts.taste}>
        <div class="card rows">
          {#each tasteScored as a (a.id)}{@render spectrum(a, false)}{/each}
          {#if picks.length || ratings.length}
            <h3 class="enjoy-title">{copy.results.interests}</h3>
            {#each ratings as e (e.key)}
              <p class="rating" data-testid="interest-{e.key}">
                <span class="small muted">{e.label}</span>
                <span class="rating-answer">{e.answer}</span>
                <span class="meter" aria-hidden="true"><span style:width="{e.v * 100}%"></span></span>
              </p>
            {/each}
            {#if picks.length}
              <div class="chips">
                {#each picks as e (e.key)}
                  <span class="chip enjoy" style:--strength={e.v} data-testid="interest-{e.key}">{e.label}</span>
                {/each}
              </div>
            {/if}
          {/if}
        </div>
      </ResultSection>
    {/if}

    {#if analysis.next.length}
      <section class="section result" id="sec-next" aria-labelledby="sec-next-title">
        <h2 class="section-title" id="sec-next-title" tabindex="-1">{copy.analysis.next.title}</h2>
        <NextSteps
          groups={analysis.next}
          open={{ links: settings.linksOpen }}
          ontoggle={(id, open) => {
            if (id !== 'links' || open === settings.linksOpen) return;
            settings.linksOpen = open;
            void settings.save();
          }}
        />
      </section>
    {/if}
  {/if}
</div>

<style>
  .rows {
    padding-top: 4px;
    padding-bottom: 4px;
  }
  .flush {
    margin: 0;
  }
  .tick {
    margin: 4px 0 8px;
  }
  .rows + :global(.traditions) {
    margin-top: 10px;
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
  .enjoy-title {
    margin-top: 16px;
  }
  .rating {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0 0 12px;
  }
  .rating-answer {
    font-weight: 600;
  }
  .meter {
    display: block;
    height: 6px;
    border-radius: 999px;
    background: var(--track);
    overflow: hidden;
  }
  .meter span {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: var(--chart-mark);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }
  .enjoy {
    font-size: 0.85rem;
    color: var(--text);
    background: color-mix(in srgb, var(--accent-soft) calc(var(--strength) * 100%), transparent);
  }
</style>
