<script lang="ts">
  import type { Response } from '../../../model/answers.ts';
  import { isScale, scalePoints, type Item } from '../../../model/content.ts';
  import { app } from '../../context.ts';
  import { copy } from '../../copy.ts';
  import { answerLabel, orderedOptions } from '../../view.ts';
  import MultiInput from './MultiInput.svelte';
  import OptionList from './OptionList.svelte';
  import PairInput from './PairInput.svelte';
  import PoleScale from './PoleScale.svelte';

  let {
    item,
    mode = 'ask',
    heading,
    previous,
    onanswer,
    oncancel,
  }: {
    item: Item;
    mode?: 'ask' | 'reask' | 'edit';
    heading?: string | undefined;
    previous?: Response | undefined;
    onanswer: (r: Response, note?: string) => void;
    oncancel?: (() => void) | undefined;
  } = $props();

  const { settings } = app();
  const qid = $derived(`q-${item.id.replace(/\W/g, '-')}`);
  let note = $state('');
  let noteOpen = $state(false);

  const selected = $derived.by(() => {
    if (!previous) return undefined;
    if (previous.kind === 'scale') return String(previous.step);
    if (previous.kind === 'option') return previous.option;
    return undefined;
  });

  /** Labeled scales and options render as a list of answer buttons. */
  const listOptions = $derived.by(() => {
    if (item.type === 'likert' || item.type === 'importance') {
      return item.labels.map((label, i) => ({ key: String(i + 1), label, testid: `scale-${item.key}-${i + 1}` }));
    }
    if ((item.type === 'slider' || item.type === 'rating') && item.labels) {
      return item.labels.map((label, i) => ({ key: String(i + 1), label, testid: `scale-${item.key}-${i + 1}` }));
    }
    if (item.type === 'choice' || item.type === 'challenge') {
      // Challenge options are shuffled per user too, so "reconsider" isn't always last.
      const shuffle = item.type === 'challenge' || item.shuffle;
      return orderedOptions(item.options, shuffle, settings.seed, item.id).map((o) => ({ key: o.id, label: o.label, testid: `opt-${item.key}-${o.id}` }));
    }
    return null;
  });

  function answer(r: Response): void {
    onanswer(r, noteOpen ? note : undefined);
  }

  function selectKey(key: string): void {
    if (isScale(item)) answer({ kind: 'scale', step: Number(key) });
    else answer({ kind: 'option', option: key });
  }
</script>

<article class="question" data-testid="q-{item.key}" data-item={item.id} data-type={item.type}>
  {#if mode === 'edit'}
    <p class="kicker">{copy.flow.editing}</p>
  {:else if item.type === 'challenge'}
    <p class="kicker challenge">{copy.flow.challengeLabel}{item.name ? `: ${item.name}` : ''}</p>
  {/if}

  {#if mode === 'reask' && heading}
    <h2 class="text" id={qid}>{heading}</h2>
    <p class="muted">{item.text}</p>
    {#if previous}
      <p class="before small" data-testid="before">{copy.flow.before} <strong>{answerLabel(item, previous)}</strong></p>
    {/if}
  {:else}
    {#if item.type === 'challenge'}
      <blockquote class="scenario">{item.scenario}</blockquote>
      {#if item.source}<p class="source small muted">{copy.flow.sourceLabel}: {item.source}</p>{/if}
    {/if}
    <h2 class="text" id={qid}>{item.text}</h2>
  {/if}
  {#if item.help}<p class="muted small">{item.help}</p>{/if}

  {#if item.type === 'challenge' && mode !== 'reask'}
    {#if noteOpen}
      <label class="note">
        <span class="visually-hidden">{copy.flow.noteToggle}</span>
        <!-- No spell-check service or keyboard suggestions: what people write here stays on the device. -->
        <textarea bind:value={note} rows="3" placeholder={copy.flow.notePlaceholder} maxlength="2000" spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
      </label>
    {:else}
      <button class="link-btn" onclick={() => (noteOpen = true)}>{copy.flow.noteToggle}</button>
    {/if}
  {/if}

  <div class="input">
    {#if listOptions}
      <OptionList options={listOptions} {selected} labelledby={qid} onselect={selectKey} />
    {:else if item.type === 'slider' || item.type === 'rating'}
      <PoleScale
        itemKey={item.key}
        points={scalePoints(item)}
        poles={item.poles}
        selected={previous?.kind === 'scale' ? previous.step : undefined}
        labelledby={qid}
        onselect={(step) => answer({ kind: 'scale', step })}
      />
    {:else if item.type === 'pair'}
      <PairInput {item} current={previous} labelledby={qid} onsubmit={answer} />
    {:else if item.type === 'multi'}
      <MultiInput {item} current={previous} labelledby={qid} onsubmit={answer} />
    {/if}
  </div>

  <div class="extras">
    {#if mode === 'reask'}
      {#if previous}
        <button class="btn" data-testid="keep-{item.key}" onclick={() => answer(previous)}>{copy.flow.keep}</button>
      {/if}
    {:else}
      <button class="link-btn" data-testid="skip-{item.key}" onclick={() => answer({ kind: 'skip' })}>{copy.flow.skip}</button>
      {#if item.unsure}
        <button class="link-btn" data-testid="unsure-{item.key}" onclick={() => answer({ kind: 'unsure' })}>{copy.flow.unsure}</button>
      {/if}
      {#if item.sensitive}
        <button class="link-btn" data-testid="declined-{item.key}" onclick={() => answer({ kind: 'declined' })}>{copy.flow.declined}</button>
      {/if}
    {/if}
    {#if oncancel}
      <button class="link-btn" onclick={oncancel}>{copy.flow.cancelEdit}</button>
    {/if}
  </div>
</article>

<style>
  .kicker {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 8px;
  }
  .kicker.challenge {
    color: var(--danger);
  }
  .text {
    font-size: 1.35rem;
    font-weight: 650;
    line-height: 1.3;
    margin: 0 0 14px;
  }
  .scenario {
    margin: 0 0 8px;
    padding: 14px 16px;
    background: var(--surface-2);
    border-left: 4px solid var(--danger);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    font-size: 1.02rem;
  }
  .source {
    margin-bottom: 14px;
  }
  .before {
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    display: inline-block;
  }
  .note textarea {
    width: 100%;
    margin: 4px 0 12px;
    padding: 10px 12px;
    font: inherit;
    font-size: 0.95rem;
    color: var(--text);
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: var(--radius-sm);
  }
  .input {
    margin-top: 6px;
  }
  .extras {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    align-items: center;
    margin-top: 18px;
  }
</style>
