<script lang="ts">
  import { DISTINCTION_REASONS, type TensionResolution } from '../../../model/answers.ts';
  import type { Tension } from '../../../engine/tensions.ts';
  import { app } from '../../context.ts';
  import { copy } from '../../copy.ts';
  import { answerLabel } from '../../view.ts';

  type Reason = (typeof DISTINCTION_REASONS)[number];

  let {
    tension,
    onresolve,
    onrevise,
    onnotnow,
  }: {
    tension: Tension;
    onresolve: (r: Pick<TensionResolution, 'kind'> & { reason?: Reason; text?: string }) => void;
    onrevise: (itemId: string) => void;
    onnotnow: () => void;
  } = $props();

  const { content, answers } = app();
  const principle = $derived(content.bundle.principles[tension.principle]);
  const sides = $derived(
    [tension.a, tension.b].map((side) => {
      const item = answers.state.ix.items.get(side.items[0]!)!;
      const topic = answers.state.ix.topics.get(side.topic)!;
      const ev = answers.state.latest.get(item.id);
      return { side, item, topic, label: ev ? answerLabel(item, ev.r) : '' };
    }),
  );
  const differences = $derived(sides.filter((s) => s.side.against));

  let mode = $state<'ask' | 'other' | 'revise'>('ask');
  let text = $state('');
</script>

<article class="tension" data-testid="tension" data-key={tension.key}>
  <p class="kicker">{principle?.label}</p>
  <h2>{copy.tension.title}</h2>
  <p class="muted">{copy.tension.intro(principle?.label ?? tension.principle)}</p>

  {#each sides as s (s.topic.id)}
    <div class="side card">
      <p class="small muted">{copy.tension.youAnswered(s.topic.title)}</p>
      <p class="statement">“{s.item.text}”</p>
      <p class="answer"><strong>{s.label}</strong></p>
    </div>
  {/each}

  {#if differences.length}
    <p class="small">{copy.tension.aDifference}</p>
    <ul class="small differences">
      {#each differences as s (s.topic.id)}<li>{copy.tension.competing(s.side.context, s.side.against!)}</li>{/each}
    </ul>
  {/if}

  {#if mode === 'ask'}
    <h3>{copy.tension.question}</h3>
    <div class="choices">
      {#each DISTINCTION_REASONS as reason (reason)}
        <button
          class="choice"
          data-testid="reason-{reason}"
          onclick={() => (reason === 'other' ? (mode = 'other') : onresolve({ kind: 'distinguished', reason }))}
        >
          {copy.tension.reasons[reason]}
        </button>
      {/each}
    </div>
    <div class="secondary">
      <button class="btn" data-testid="tension-revise" onclick={() => (mode = 'revise')}>{copy.tension.revise}</button>
      <button class="btn" data-testid="tension-acknowledge" onclick={() => onresolve({ kind: 'acknowledged' })}>{copy.tension.acknowledge}</button>
      <button class="link-btn" data-testid="tension-notnow" onclick={onnotnow}>{copy.tension.notNow}</button>
    </div>
  {:else if mode === 'other'}
    <h3>{copy.tension.reasons.other}</h3>
    <!-- No spell-check service or keyboard suggestions: what people write here stays on the device. -->
    <textarea bind:value={text} rows="3" placeholder={copy.tension.otherPlaceholder} maxlength="2000" spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
    <div class="btn-row">
      <button class="btn primary" onclick={() => onresolve({ kind: 'distinguished', reason: 'other', ...(text.trim() ? { text: text.trim() } : {}) })}>{copy.tension.save}</button>
      <button class="link-btn" onclick={() => (mode = 'ask')}>{copy.flow.back}</button>
    </div>
  {:else}
    <h3>{copy.tension.reviseWhich}</h3>
    <div class="choices">
      {#each sides as s (s.topic.id)}
        <button class="choice" data-testid="revise-{s.topic.id}" onclick={() => onrevise(s.item.id)}>{s.topic.title}: “{s.item.text}”</button>
      {/each}
    </div>
    <button class="link-btn" onclick={() => (mode = 'ask')}>{copy.flow.back}</button>
  {/if}
</article>

<style>
  .kicker {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--warn);
    margin-bottom: 6px;
  }
  h2 {
    font-size: 1.35rem;
  }
  .side {
    margin: 10px 0;
  }
  .side p {
    margin: 0 0 4px;
  }
  .statement {
    font-style: italic;
  }
  .differences {
    margin-top: 0;
  }
  h3 {
    margin-top: 18px;
  }
  .choices {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .choice {
    width: 100%;
    min-height: 52px;
    padding: 12px 16px;
    text-align: left;
    font: inherit;
    color: var(--text);
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }
  .choice:hover {
    border-color: var(--accent);
  }
  .secondary {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    margin-top: 16px;
  }
  textarea {
    width: 100%;
    padding: 10px 12px;
    font: inherit;
    color: var(--text);
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-sm);
  }
</style>
