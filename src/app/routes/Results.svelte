<script lang="ts">
  // Results: an overview (the written summary, the pattern of your spectrums, your firmest leans,
  // a way into each area, then next steps), and a page per area pairing a short read-out with its
  // charts. The analysis runs on this device (see docs/ANALYSIS.md); the overview uses only answers
  // that could ever be shared, and each area's page shows everything.
  import { untrack } from 'svelte';
  import type { Axis, AxisFamily, AxisId, Item } from '../../model/content.ts';
  import { analyse } from '../../engine/analysis/index.ts';
  import { BAND, UNNAMED_TRAITS } from '../../engine/analysis/constants.ts';
  import { isMixed } from '../../engine/score.ts';
  import { composeAnalysis, tensionGroups, type TensionLead } from '../analysis/compose.ts';
  import { app } from '../context.ts';
  import { copy } from '../copy.ts';
  import { router } from '../router.svelte.ts';
  import { AREAS, isCardId, to, type AreaId } from '../routes.ts';
  import { shareCards } from '../share/cards.ts';
  import {
    areaLean,
    axisFeeders,
    challengeTotals,
    compareWith,
    endorsementLabel,
    firmestLeans,
    interestList,
    mapTraditions,
    mapViews,
    patternGroups,
    PATTERN_MIN,
    positionsByDomain,
    rankedPrinciples,
    toPercent,
    traditionTable,
    type PatternArea,
  } from '../view.ts';
  import AboutYou from '../components/results/AboutYou.svelte';
  import AreaLinks from '../components/results/AreaLinks.svelte';
  import ChallengeBar from '../components/results/ChallengeBar.svelte';
  import NextSteps from '../components/results/NextSteps.svelte';
  import PatternRing from '../components/results/PatternRing.svelte';
  import PoliticalMap from '../components/results/PoliticalMap.svelte';
  import PositionRow from '../components/results/PositionRow.svelte';
  import PrincipleChart from '../components/results/PrincipleChart.svelte';
  import ResultSection from '../components/results/ResultSection.svelte';
  import SpectrumRow from '../components/results/SpectrumRow.svelte';
  import SummaryCard from '../components/results/SummaryCard.svelte';
  import TraditionList from '../components/results/TraditionList.svelte';
  import Icon from '../components/Icon.svelte';

  let { area = null }: { area?: AreaId | null } = $props();

  /** Tension cards shown before "Show all". */
  const TENSION_GROUPS_SHOWN = 3;
  /** Up to this many positions, every domain starts open. */
  const POSITIONS_OPEN = 6;
  /** The political map's first pair of spectrums, which explore suggestions help fill in. */
  const MAP_AXES = ['economic', 'civil'] as const;
  /** Topics listed per pole under "What pulled you". */
  const DRIVERS_SHOWN = 3;
  /** Each coloured area's mark colour (see app.css); the other areas draw in the chart colour. */
  const AREA_COLOR: Partial<Record<AreaId, string>> = {
    politics: 'var(--area-politics)',
    values: 'var(--area-values)',
    thinking: 'var(--area-thinking)',
    personality: 'var(--area-personality)',
  };
  const FAMILY_AREA: Partial<Record<AxisFamily, AreaId>> = { political: 'politics', values: 'values', thinking: 'thinking', personality: 'personality' };
  const S = copy.analysis.sections;
  const O = copy.analysis.overview;

  const { content, answers, settings } = app();
  const profile = $derived(answers.profile);
  const feeders = axisFeeders(content.bundle);
  const axes = Object.values(content.bundle.axes);
  const principles = Object.values(content.bundle.principles);
  const political = axes.filter((a) => a.family === 'political');
  const values = axes.filter((a) => a.family === 'values');
  const thinking = axes.filter((a) => a.family === 'thinking');
  const worldview = axes.filter((a) => a.family === 'worldview');
  const personality = axes.filter((a) => a.family === 'personality');
  const taste = axes.filter((a) => a.family === 'taste');

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
  const table = $derived(pack ? traditionTable(content.bundle, pack, profile, copy.analysis.traditions.table) : null);
  // The map: each pair of political spectrums once both are scored, every tradition placed, the
  // listed (nearest) ones numbered as in the traditions list.
  const views = $derived(mapViews(content.bundle, profile.axes));
  const listed = $derived(analysis?.traditions?.rows ?? []);
  const mapTrads = $derived(pack ? mapTraditions(pack, listed) : []);
  const comparisons = $derived(
    Object.fromEntries(
      listed.flatMap((r) => {
        const t = pack?.traditions.find((x) => x.id === r.id);
        return t ? [[r.id, compareWith(content.bundle, profile.axes, t)]] : [];
      }),
    ),
  );
  const ranked = $derived(rankedPrinciples(principles, profile.principles));
  const totals = $derived(challengeTotals(profile.topics));

  // Tensions: one card per principle, most pressing first, open before thought through; each led by
  // its most pressing pair.
  const tensions = $derived(answers.tensions);
  const tensionCards = $derived(tensionGroups(content.bundle, answers.state, tensions));
  const openTensions = $derived(tensions.filter((t) => t.status === 'open'));
  let showAllTensions = $state(false);
  const shownGroups = $derived(showAllTensions ? tensionCards : tensionCards.slice(0, TENSION_GROUPS_SHOWN));
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

  // The areas with something to show, in overview order.
  const available = $derived.by(() => {
    const show: Record<AreaId, boolean> = {
      politics: true,
      values: values.length > 0,
      thinking: thinking.length > 0,
      worldview: worldviewScored.length > 0,
      personality: true,
      principles: ranked.length > 0,
      tensions: true,
      positions: positionGroups.length > 0,
      taste: tasteScored.length > 0 || interests.length > 0,
      // Listed once something about you is answered; declining everything doesn't list it.
      you: Object.keys(profile.identity ?? {}).length > 0,
    };
    return AREAS.filter((id) => show[id]);
  });

  // --- The overview: only answers that could be shared ---
  const pub = $derived(answers.publicProfile);
  const pattern = $derived(patternGroups(axes, pub.axes, UNNAMED_TRAITS));
  const spokes = $derived(pattern.reduce((n, g) => n + g.spokes.length, 0));
  const firm = $derived(firmestLeans(axes, pub.axes, UNNAMED_TRAITS));
  const patternNames: Record<PatternArea, string> = { politics: S.politics, personality: S.personality, thinking: S.thinking, values: S.values };

  function spectrumLine(family: AxisFamily): string {
    const lean = areaLean(axes, pub.axes, family, UNNAMED_TRAITS);
    if (lean) return lean;
    const scored = axes.some((a) => a.family === family && !UNNAMED_TRAITS.has(a.id) && (pub.axes[a.id]?.score ?? null) !== null);
    return scored ? O.line.middle : O.line.notYet;
  }

  function areaLine(id: AreaId): string {
    switch (id) {
      case 'politics':
        return spectrumLine('political');
      case 'values':
      case 'thinking':
      case 'personality':
        return spectrumLine(id);
      case 'worldview':
        return O.line.sensitive;
      case 'principles': {
        const top = rankedPrinciples(principles, pub.principles)
          .filter((r) => r.score >= BAND.leans)
          .slice(0, 2)
          .map((r) => r.principle.label);
        return top.length ? O.line.principles(top) : O.line.principleCount(ranked.length);
      }
      case 'tensions':
        return tensions.length ? O.line.tensions(openTensions.length, tensions.length - openTensions.length) : O.line.noTensions;
      case 'positions':
        return O.line.positions(positionCount, totals.moved);
      case 'taste': {
        const top = picks.slice(0, 2).map((e) => e.label);
        return top.length ? O.line.enjoys(top) : (areaLean(axes, pub.axes, 'taste', UNNAMED_TRAITS) ?? O.line.notYet);
      }
      case 'you':
        return O.line.private;
    }
  }

  const areaItems = $derived(available.map((id) => ({ id, title: S[id], line: areaLine(id), color: AREA_COLOR[id] })));
  // The cards that could be shared as images, from the same answers as the overview.
  const shareable = $derived(shareCards({ axes, principles, profile: pub }).map((c) => c.id));

  // Coming back to the overview from one of its pages, pick up where you were.
  $effect(() => {
    if (area || !hasAny) return;
    const from = router.previous?.name;
    if (from !== 'area' && from !== 'tension' && from !== 'topic-results' && from !== 'share') return;
    const y = router.scrolledAt(location.hash);
    if (y) requestAnimationFrame(() => scrollTo(0, y));
  });

  /** The back link returns through history when it can, so Back doesn't lead here again. */
  function back(e: MouseEvent): void {
    if (router.previous?.name !== 'results') return;
    e.preventDefault();
    history.back();
  }

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
</script>

{#snippet spectrum(a: Axis, withMixed: boolean)}
  {@const sc = profile.axes[a.id]!}
  {@const home = FAMILY_AREA[a.family]}
  <SpectrumRow
    title={a.title}
    poles={a.poles}
    score={sc.score}
    confidence={sc.confidence}
    description={a.description}
    mixed={withMixed && isMixed(sc, content.bundle)}
    feeders={feeders.get(a.id) ?? []}
    drivers={drivers(a.id, a.poles)}
    color={home ? AREA_COLOR[home] : undefined}
    testid="axis-{a.id}"
  />
{/snippet}

{#snippet politicsPage()}
  <ResultSection id="politics" title={S.politics} readout={analysis!.readouts.politics} color={AREA_COLOR.politics}>
    <div class="card rows">
      {#each political as a (a.id)}{@render spectrum(a, true)}{/each}
    </div>
    {#if traditionsShown}
      <TraditionList view={analysis!.traditions} state={content.analysisState} {comparisons} />
    {/if}
    <details class="card map-card" data-testid="map-card">
      <summary data-testid="map-open">
        <span class="map-icon" aria-hidden="true"><Icon name="map" size={24} /></span>
        <span class="map-head">
          <span class="map-title">{copy.analysis.traditions.map.open}</span>
          <span class="small muted">{copy.analysis.traditions.map.sub}</span>
        </span>
        <span class="chev" aria-hidden="true"></span>
      </summary>
      <div class="map-body">
        <PoliticalMap {views} traditions={mapTrads} {table} />
      </div>
    </details>
  </ResultSection>
{/snippet}

{#snippet spectrumsPage(id: 'values' | 'thinking' | 'worldview', list: Axis[])}
  <ResultSection {id} title={S[id]} readout={analysis!.readouts[id]} color={AREA_COLOR[id]}>
    <div class="card rows">
      {#each list as a (a.id)}{@render spectrum(a, true)}{/each}
    </div>
    {#if id === 'thinking' && totals.asked}
      <div class="card">
        <ChallengeBar {totals} />
      </div>
    {/if}
  </ResultSection>
{/snippet}

{#snippet personalityPage()}
  <ResultSection id="personality" title={S.personality} readout={analysis!.readouts.personality} note={copy.results.personalityNote} color={AREA_COLOR.personality}>
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
{/snippet}

{#snippet principlesPage()}
  <ResultSection id="principles" title={S.principles} readout={analysis!.readouts.principles} note={copy.results.principlesNote}>
    <div class="card">
      <PrincipleChart rows={ranked} {topicTitle} tensions={openByPrinciple} />
    </div>
  </ResultSection>
{/snippet}

{#snippet twoDots(sides: TensionLead['sides'])}
  {@const [hi, lo] = sides}
  {@const right = toPercent(hi.e)}
  {@const left = toPercent(lo.e)}
  <span class="two" aria-hidden="true">
    <span class="two-label hi" style:right="{100 - right}%" style:max-width="{right}%">{hi.title}</span>
    <span class="two-rail">
      <span class="two-gap" style:left="{left}%" style:width="{right - left}%"></span>
      <span class="two-dot" class:neg={lo.e < 0} style:left="{left}%"></span>
      <span class="two-dot" class:neg={hi.e < 0} style:left="{right}%"></span>
    </span>
    <span class="two-label" style:left="{left}%" style:max-width="{100 - left}%">{lo.title}</span>
    <span class="two-ends small"><span>{copy.results.rejects}</span><span>{copy.results.endorses}</span></span>
  </span>
  <span class="visually-hidden">{hi.title}: {endorsementLabel(hi.e)}. {lo.title}: {endorsementLabel(lo.e)}.</span>
{/snippet}

{#snippet tensionsPage()}
  <ResultSection id="tensions" title={S.tensions} readout={analysis!.readouts.tensions}>
    {#if tensionCards.length}
      {#each shownGroups as g (g.principle)}
        <div class="card tension" data-testid="tension-group-{g.principle}">
          <div class="tension-head">
            <h2 class="tension-title">{g.label}</h2>
            <span class="count small">{g.count}</span>
          </div>
          <a class="lead-pair" href={g.lead.href} data-testid="tension-row">
            <span class="lead-text">{g.lead.lead}</span>
            {@render twoDots(g.lead.sides)}
            {#if g.lead.ask}<span class="ask">{g.lead.ask}</span>{/if}
            {#if g.lead.status}<span class="small resolved">{g.lead.status}</span>{/if}
            {#if g.lead.ask}<span class="cta">{copy.analysis.next.reflect.cta}<Icon name="right" size={18} /></span>{/if}
          </a>
          {#each g.others as p (p.key)}
            <a class="pair" href={p.href} data-testid="tension-row">
              <span class="pair-text">
                <span>{p.label}</span>
                {#if p.status}<span class="small resolved">{p.status}</span>{/if}
              </span>
              <Icon name="right" size={18} />
            </a>
          {/each}
        </div>
      {/each}
      {#if tensionCards.length > TENSION_GROUPS_SHOWN}
        <button type="button" class="btn ghost more" data-testid="show-all-tensions" aria-expanded={showAllTensions} onclick={() => (showAllTensions = !showAllTensions)}>
          {showAllTensions ? copy.results.showFewer : copy.results.showAll(tensionCards.length)}
        </button>
      {/if}
    {:else}
      <p class="muted small">{copy.results.tensionsEmpty}</p>
    {/if}
  </ResultSection>
{/snippet}

{#snippet positionsPage()}
  <ResultSection id="positions" title={S.positions} readout={analysis!.readouts.positions}>
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
{/snippet}

{#snippet tastePage()}
  <ResultSection id="taste" title={S.taste} readout={analysis!.readouts.taste}>
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
{/snippet}

<div class="page">
  {#if !hasAny || !analysis}
    <h1>{copy.results.title}</h1>
    <div class="card center">
      <p>{copy.results.empty}</p>
      <a class="btn primary" href={to.topics()}>{copy.results.emptyCta}</a>
    </div>
  {:else if area}
    <div class="top">
      <a class="back" href={to.results()} data-testid="area-back" onclick={back}><Icon name="left" size={20} />{O.back}</a>
      {#if isCardId(area) && shareable.includes(area)}
        <a class="btn share-link" href={to.share(area)} data-testid="area-share"><Icon name="share" size={18} />{copy.share.open}</a>
      {/if}
    </div>
    {#if !available.includes(area)}
      <ResultSection id={area} title={S[area]} color={AREA_COLOR[area]}>
        <p class="muted">{copy.results.notEnough}</p>
      </ResultSection>
    {:else if area === 'politics'}
      {@render politicsPage()}
    {:else if area === 'values'}
      {@render spectrumsPage('values', values)}
    {:else if area === 'thinking'}
      {@render spectrumsPage('thinking', thinking)}
    {:else if area === 'worldview'}
      {@render spectrumsPage('worldview', worldviewScored)}
    {:else if area === 'personality'}
      {@render personalityPage()}
    {:else if area === 'principles'}
      {@render principlesPage()}
    {:else if area === 'tensions'}
      {@render tensionsPage()}
    {:else if area === 'positions'}
      {@render positionsPage()}
    {:else if area === 'taste'}
      {@render tastePage()}
    {:else if area === 'you'}
      <ResultSection id="you" title={S.you}><AboutYou /></ResultSection>
    {/if}
  {:else}
    <div class="title-row">
      <h1>{copy.results.title}</h1>
      {#if shareable.length}
        <a class="btn share-link" href={to.share()} data-testid="share-open"><Icon name="share" size={18} />{copy.share.open}</a>
      {/if}
    </div>
    <SummaryCard
      summary={analysis.summary}
      footer="{copy.results.selfReport} {copy.results.basedOn(answeredTopics, content.bundle.topics.length)}"
      tensionsHref={to.area('tensions')}
    />

    {#if spokes >= PATTERN_MIN}
      <section class="card block" aria-labelledby="pattern-title">
        <h2 id="pattern-title" class="block-title">{O.pattern}</h2>
        <p class="small muted help">{O.patternHelp}</p>
        <PatternRing groups={pattern} names={patternNames} />
      </section>
    {/if}

    {#if firm.length}
      <section class="card block" aria-labelledby="firmest-title" data-testid="firmest">
        <h2 id="firmest-title" class="block-title">{O.firmest}</h2>
        <ol class="firm">
          {#each firm as l, i (l.axis)}
            <li data-testid="firm-{l.axis}">
              <span class="n display" style:--tint="var(--area-{l.area})" aria-hidden="true">{i + 1}</span>
              <span class="firm-body">
                <span class="firm-label">{l.label}</span>
                <span class="small muted">{S[l.area]} · {l.title}</span>
              </span>
            </li>
          {/each}
        </ol>
      </section>
    {/if}

    <section class="card block" aria-labelledby="areas-title">
      <h2 id="areas-title" class="block-title">{O.areas}</h2>
      <AreaLinks items={areaItems} />
    </section>

    {#if analysis.next.length}
      <section class="next" id="sec-next" aria-labelledby="sec-next-title">
        <h2 class="block-title" id="sec-next-title">{copy.analysis.next.title}</h2>
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
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 44px;
    margin: -8px 0 4px -6px;
    padding-right: 10px;
    font-weight: 600;
    text-decoration: none;
  }
  .top,
  .title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .top .share-link {
    margin: -8px 0 4px;
  }
  .title-row {
    margin-bottom: 0.5em;
  }
  .title-row h1 {
    margin: 0;
  }
  .share-link {
    flex: none;
    min-height: 44px;
    padding: 0 16px;
    gap: 6px;
    font-size: 0.95rem;
  }
  .block {
    margin-top: 14px;
    border-radius: 22px;
    padding: 18px 18px 14px;
  }
  .block-title {
    margin: 0 0 4px;
    font-size: 1.35rem;
    font-weight: 700;
  }
  .help {
    margin: 0 0 6px;
  }
  .firm {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .firm li {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 0;
    border-top: 1px solid var(--border);
  }
  .firm li:first-child {
    border-top: none;
  }
  .n {
    flex: none;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    background: color-mix(in srgb, var(--tint) 30%, transparent);
  }
  .firm-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .firm-label {
    font-size: 1.05rem;
    font-weight: 700;
  }
  .next {
    margin-top: 28px;
  }
  .rows {
    padding-top: 4px;
    padding-bottom: 4px;
  }
  .flush {
    margin: 0;
  }
  .rows + :global(.traditions) {
    margin-top: 10px;
  }
  .map-card {
    margin-top: 12px;
    padding: 0 16px;
  }
  .map-card summary {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 64px;
    padding: 10px 0;
    list-style: none;
    cursor: pointer;
  }
  .map-card summary::-webkit-details-marker {
    display: none;
  }
  .map-icon {
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--area-politics) 24%, transparent);
  }
  .map-head {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .map-title {
    font-weight: 650;
  }
  .map-card[open] .chev {
    transform: translateY(1px) rotate(-135deg);
  }
  .map-body {
    padding: 4px 0 16px;
  }
  .tension {
    margin-top: 12px;
    border-radius: 22px;
    padding: 18px 18px 8px;
  }
  .tension-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
  }
  .tension-title {
    margin: 0;
    font-size: 1.2rem;
  }
  .count {
    flex: none;
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--muted);
    font-weight: 600;
  }
  .lead-pair {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px 0 12px;
    color: inherit;
    text-decoration: none;
  }
  .lead-pair + .pair {
    border-top: 1px solid var(--border);
  }
  .ask {
    font-weight: 600;
  }
  .cta {
    display: inline-flex;
    align-items: center;
    align-self: flex-start;
    gap: 2px;
    min-height: 44px;
    padding: 0 16px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--accent-text);
    font-weight: 650;
  }
  /* The principle as endorsed on one side and not the other: two dots on a reject-endorse line. */
  .two {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 4px 9px 0;
  }
  .two-label {
    position: relative;
    align-self: flex-start;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.875rem;
    font-weight: 650;
  }
  .two-label.hi {
    align-self: flex-end;
  }
  .two-rail {
    position: relative;
    height: 18px;
    background: linear-gradient(var(--track), var(--track)) center / 100% 4px no-repeat;
  }
  .two-gap {
    position: absolute;
    top: 50%;
    height: 4px;
    margin-top: -2px;
    background: var(--chart-ref);
  }
  .two-dot {
    position: absolute;
    top: 50%;
    width: 18px;
    height: 18px;
    margin: -9px 0 0;
    transform: translateX(-50%);
    border-radius: 50%;
    background: var(--chart-mark);
    box-shadow: 0 0 0 2px var(--surface);
  }
  .two-dot.neg {
    background: var(--chart-reject);
  }
  .two-ends {
    display: flex;
    justify-content: space-between;
    margin: 0 -9px;
    color: var(--muted);
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
