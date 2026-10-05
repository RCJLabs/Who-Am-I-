<script lang="ts">
  import type { Response, TensionResolution, Via } from '../../model/answers.ts';
  import { IDENTITY_DOMAIN } from '../../model/content.ts';
  import { nextStep, progress } from '../../engine/flow.ts';
  import { openTensions } from '../../engine/tensions.ts';
  import { app } from '../context.ts';
  import { copy } from '../copy.ts';
  import { router } from '../router.svelte.ts';
  import { fromRoute, to } from '../routes.ts';
  import { toasts } from '../stores/toasts.svelte.ts';
  import EvidenceBadge from '../components/EvidenceBadge.svelte';
  import FlowDone from '../components/flow/FlowDone.svelte';
  import QuestionView from '../components/flow/QuestionView.svelte';
  import TensionCard from '../components/flow/TensionCard.svelte';
  import Icon from '../components/Icon.svelte';
  import ProgressBar from '../components/ProgressBar.svelte';
  import NotFound from './NotFound.svelte';

  interface Editing {
    itemId: string;
    via: Via;
    /** What happens after the edit: return to where we came from, or finish a tension revision. */
    then: 'stay' | 'back' | 'tension';
    tensionKey?: string;
  }

  let { topicId, edit }: { topicId: string; edit?: string | undefined } = $props();
  const { content, answers, settings } = app();
  // Topics about you arrive hashed (routes.ts).
  const topic = $derived.by(() => {
    const id = fromRoute(topicId, content.bundle.topics.map((t) => t.id));
    return content.bundle.topics.find((t) => t.id === id);
  });
  const identity = $derived(topic?.domain === IDENTITY_DOMAIN);

  // Per-visit state. Everything else is derived from the answer log.
  let tensionDone = $state(false);
  let introDismissed = $state(false);
  // Opened from "Change" on the results page: edit that item, then go back. (The route remounts
  // this component, so reading the props once is enough.)
  const initialEditing = (): Editing | null => {
    const key = edit && topic ? fromRoute(edit, topic.items.map((i) => i.key)) : undefined;
    return key ? { itemId: `${topic!.id}.${key}`, via: { kind: 'manual' }, then: 'back' } : null;
  };
  let editing = $state<Editing | null>(initialEditing());
  let visitHistory = $state<string[]>([]);

  const opts = $derived({ alwaysDeep: settings.alwaysDeep });
  const open = $derived(tensionDone ? [] : openTensions(answers.state, answers.resolutions));
  const step = $derived(
    topic
      ? nextStep(answers.state, topic.id, {
          ...opts,
          tensions: open.map((t) => ({ key: t.key, topics: [t.a.topic, t.b.topic] as const, rank: t.rank })),
        })
      : null,
  );
  const prog = $derived(topic ? progress(answers.state, topic.id, opts) : null);
  const fresh = $derived(topic ? !topic.items.some((i) => answers.state.latest.has(i.id)) : false);
  const showIntro = $derived(!!topic?.instructions && fresh && !introDismissed && !editing);
  const editItem = $derived(editing ? answers.state.ix.items.get(editing.itemId) : undefined);
  const activeTension = $derived(step?.kind === 'tension' ? open.find((t) => t.key === step.key) : undefined);
  const progressValue = $derived(prog ? prog.answered / Math.max(1, prog.answered + prog.remaining) : 0);

  // A new question starts at the top of the page.
  $effect(() => {
    void step;
    void editing;
    scrollTo(0, 0);
  });

  async function onanswer(itemId: string, r: Response, via?: Via, note?: string): Promise<void> {
    await answers.record(itemId, r, via, note);
    visitHistory = [...visitHistory, itemId];
  }

  async function onEditAnswer(r: Response, note?: string): Promise<void> {
    const e = editing;
    if (!e) return;
    const current = answers.state.latest.get(e.itemId)?.r;
    if (!current || JSON.stringify(current) !== JSON.stringify(r)) await answers.record(e.itemId, r, e.via, note);
    editing = null;
    if (e.then === 'back') router.back(to.topicResults(topic!.id));
    else if (e.then === 'tension' && e.tensionKey) await finishRevision(e.tensionKey);
  }

  async function finishRevision(key: string): Promise<void> {
    // If the answers still pull apart, record that the user revised, so the card isn't raised again
    // until one of these answers changes.
    const still = answers.tensions.find((t) => t.key === key);
    if (still) await answers.resolve({ key, kind: 'revised', principle: still.principle, basis: still.basis });
    tensionDone = true;
  }

  async function resolveTension(r: Pick<TensionResolution, 'kind' | 'reason' | 'text'>): Promise<void> {
    const t = activeTension;
    if (!t) return;
    const res: Omit<TensionResolution, 'id' | 'at'> = { key: t.key, kind: r.kind, principle: t.principle, basis: t.basis };
    if (r.reason) res.reason = r.reason;
    if (r.text) res.text = r.text;
    await answers.resolve(res);
    tensionDone = true;
    toasts.push(copy.tension.thanks);
  }

  function goBack(): void {
    if (editing) {
      editing = null;
      return;
    }
    const last = visitHistory.at(-1);
    if (last) {
      visitHistory = visitHistory.slice(0, -1);
      editing = { itemId: last, via: { kind: 'manual' }, then: 'stay' };
    } else {
      leave();
    }
  }

  /** Back where you came from; but questions about you are replaced in history, so Back can't reopen them. */
  function leave(): void {
    if (identity) router.go(to.topics(), { replace: true });
    else router.back(to.topics());
  }

  function reaskHeading(via: Via): string {
    if (via.kind === 'reask') return answers.state.ix.items.get(via.source)?.text ?? copy.flow.reaskAfterChallenge;
    return copy.flow.reaskAfterChallenge;
  }
</script>

{#if !topic}
  <NotFound message={copy.flow.notFound} />
{:else}
  <div class="flow">
    <header class="bar">
      <button class="icon-btn" aria-label={copy.flow.back} data-testid="flow-back" onclick={goBack}><Icon name="left" /></button>
      <div class="bar-title">
        <span class="name">{topic.title}</span>
        {#if step?.kind !== 'done'}<ProgressBar value={progressValue} label={topic.title} />{/if}
      </div>
      <button class="icon-btn" aria-label={copy.flow.exit} data-testid="flow-exit" onclick={leave}><Icon name="x" /></button>
    </header>

    <main class="body">
      {#if editing && editItem}
        {@const item = editItem}
        {#key editing.itemId}
          <QuestionView {item} mode="edit" previous={answers.state.latest.get(item.id)?.r} onanswer={onEditAnswer} oncancel={() => (editing = null)} />
        {/key}
      {:else if showIntro}
        <section class="intro">
          <h1>{topic.title}</h1>
          <p class="muted">{topic.summary}</p>
          {#if !identity}<EvidenceBadge evidence={topic.evidence} />{/if}
          <p class="instructions">{topic.instructions}</p>
          {#if topic.source}<p class="small muted">{topic.source}</p>{/if}
          <button class="btn primary block" data-testid="intro-start" onclick={() => (introDismissed = true)}>{copy.flow.start}</button>
        </section>
      {:else if step?.kind === 'item'}
        {@const s = step}
        {#key s.item.id}
          <QuestionView item={s.item} onanswer={(r, note) => onanswer(s.item.id, r, undefined, note)} />
        {/key}
      {:else if step?.kind === 'reask'}
        {@const s = step}
        {#key `${s.item.id}:${answers.events.length}`}
          <QuestionView item={s.item} mode="reask" heading={reaskHeading(s.via)} previous={s.previous?.r} onanswer={(r) => onanswer(s.item.id, r, s.via)} />
        {/key}
      {:else if step?.kind === 'tension' && activeTension}
        <TensionCard
          tension={activeTension}
          onresolve={resolveTension}
          onrevise={(itemId) => (editing = { itemId, via: { kind: 'tension', source: activeTension.key }, then: 'tension', tensionKey: activeTension.key })}
          onnotnow={() => (tensionDone = true)}
        />
      {:else}
        <FlowDone {topic} />
      {/if}
    </main>
  </div>
{/if}

<style>
  .flow {
    min-height: 100dvh;
  }
  .bar {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: var(--content-w);
    margin: 0 auto;
    padding: 10px 8px;
    background: var(--bg);
  }
  .bar-title {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .name {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--text);
    cursor: pointer;
  }
  .icon-btn:hover {
    background: var(--surface-2);
  }
  .body {
    max-width: var(--content-w);
    margin: 0 auto;
    padding: 12px 16px 48px;
  }
  .intro h1 {
    margin-top: 8px;
  }
  .instructions {
    margin: 16px 0;
    padding: 14px 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }
</style>
