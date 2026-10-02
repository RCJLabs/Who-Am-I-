<script lang="ts">
  // Read-only content preview: every question, option and challenge (for both sides), for
  // reviewing content before the interactive app exists. Replaced by the real app shell.
  import type { Bundle, Effect, Item, OptionEffect, Reaction, Target, Topic } from '../model/content.ts';
  import { indexBundle } from '../engine/bundle-index.ts';
  import { describeCond } from '../engine/cond/describe.ts';

  let { bundle }: { bundle: Bundle } = $props();

  const version = __APP_VERSION__;
  const ix = $derived(indexBundle(bundle));
  const groups = $derived(
    bundle.domains
      .map((domain) => ({ domain, topics: bundle.topics.filter((t) => t.domain === domain.id) }))
      .filter((g) => g.topics.length > 0),
  );
  const allItems = $derived(bundle.topics.flatMap((t) => t.items));
  const challengeCount = $derived(allItems.filter((i) => i.type === 'challenge').length);

  const REACTION: Record<Reaction, string> = {
    hold: 'Holds view',
    distinguish: 'Names a difference',
    yield: 'Reconsiders',
  };

  function role(topic: Topic, item: Item): string {
    if (item.type === 'challenge') return 'Challenge';
    if (item.type === 'reask') return 'Re-ask';
    if (item.type === 'importance') return 'Importance';
    if (item.id === topic.stance) return 'Stance';
    if (item.anchor) return 'Anchor';
    if (item.tags.includes('circumstance')) return 'Circumstance';
    return 'Question';
  }

  function targetLabel(t: Target): string {
    if (t.startsWith('axis:')) return bundle.axes[t.slice(5)]?.title ?? t;
    return bundle.principles[t.slice('principle:'.length)]?.label ?? t;
  }

  function signed(n: number): string {
    const abs = Math.abs(n);
    return `${n > 0 ? '+' : n < 0 ? '−' : '±'}${abs}`;
  }

  function effectsText(effects: readonly (Effect | OptionEffect)[]): string {
    return effects.map((e) => `${targetLabel(e.target)} ${signed('w' in e ? e.w : e.v)}`).join(' · ');
  }

  function keyOf(id: string): string {
    return ix.items.get(id)?.key ?? id;
  }
</script>

<main>
  <header>
    <h1>Who Am I</h1>
    <p class="lede">
      <strong>Content preview.</strong> Every question, including the challenges for <em>both</em> sides (a real
      person only sees the ones aimed at their answers). The interactive version comes next.
    </p>
    <p class="meta">
      Build {version} · content {bundle.contentVersion} · {bundle.topics.length} topics · {allItems.length} items ·
      {challengeCount} challenges
    </p>
  </header>

  {#each groups as group (group.domain.id)}
    <section>
      <h2>{group.domain.title}</h2>
      <p class="blurb">{group.domain.blurb}</p>

      {#each group.topics as topic (topic.id)}
        <details>
          <summary>
            <span class="topic-title">{topic.title}</span>
            <span class="badge evidence">{topic.evidence}</span>
            <span class="count">{topic.items.length} items</span>
          </summary>

          <div class="topic-body">
            <p class="summary">{topic.summary}</p>
            {#if topic.source}<p class="source">Source: {topic.source}</p>{/if}
            {#if topic.instructions}<p class="instructions">{topic.instructions}</p>{/if}

            <ol class="items">
              {#each topic.items as item (item.id)}
                {@const r = role(topic, item)}
                <li class="item" data-role={r}>
                  <div class="tags">
                    <span class="role">{r}</span>
                    {#if item.deep}<span class="tag" title="Skipped when the topic matters little to the user">deep</span>{/if}
                    {#if item.sensitive}<span class="tag">sensitive</span>{/if}
                    <code class="key">{item.key}</code>
                  </div>

                  {#if item.when}
                    <p class="when">Shown when {describeCond(item.when, ix.items)}</p>
                  {/if}

                  {#if item.type === 'challenge'}
                    <blockquote>{item.scenario}</blockquote>
                    {#if item.source}<p class="source">{item.source}</p>{/if}
                  {/if}

                  <p class="text">{item.text}</p>

                  {#if item.type === 'slider' || item.type === 'rating'}
                    {#if item.labels}
                      <ol class="scale">
                        {#each item.labels as label, i (i)}<li>{label}</li>{/each}
                      </ol>
                    {:else}
                      <p class="detail">{item.poles[0]} ↔ {item.poles[1]}</p>
                    {/if}
                  {:else if item.type === 'likert'}
                    <p class="detail">{item.labels[0]} … {item.labels[item.labels.length - 1]} ({item.points} points)</p>
                  {:else if item.type === 'importance'}
                    <p class="detail">{item.labels.join(' · ')}</p>
                  {:else if item.type === 'choice' || item.type === 'pair'}
                    <ul class="options">
                      {#each item.options as o (o.id)}
                        <li>
                          {o.label}
                          {#if o.effects.length}<span class="fx">{effectsText(o.effects)}</span>{/if}
                        </li>
                      {/each}
                    </ul>
                  {:else if item.type === 'multi'}
                    <p class="chips">
                      {#each item.options as o (o.id)}<span class="chip">{o.label}</span>{/each}
                    </p>
                    {#if item.intensity}<p class="detail">Each pick is rated 1–5.</p>{/if}
                  {:else if item.type === 'challenge'}
                    <ul class="options">
                      {#each item.options as o (o.id)}
                        <li>
                          <span class="reaction" data-reaction={o.reaction}>{REACTION[o.reaction]}</span>
                          {o.label}
                          {#if o.revise}<span class="revise">→ re-asks <code>{keyOf(o.revise)}</code></span>{/if}
                          {#if o.effects.length}<span class="fx">{effectsText(o.effects)}</span>{/if}
                        </li>
                      {/each}
                    </ul>
                  {:else if item.type === 'reask'}
                    <p class="detail">Re-asks <code>{keyOf(item.target)}</code> if a challenge aimed at it was answered since.</p>
                  {/if}

                  {#if item.anchor}
                    <p class="anchor">
                      Anchor for <strong>{bundle.principles[item.anchor.principle]?.label}</strong> in {item.anchor.context}{#if item.anchor.against}; competing interest: {item.anchor.against}{/if}
                    </p>
                  {/if}

                  {#if 'effects' in item && item.effects.length}
                    <p class="fx">
                      Scores{item.type === 'choice' ? ' (by option value)' : ''}: {effectsText(item.effects)}
                    </p>
                  {/if}
                </li>
              {/each}
            </ol>
          </div>
        </details>
      {/each}
    </section>
  {/each}
</main>

<style>
  :global(:root) {
    --bg: #fbfaf8;
    --surface: #ffffff;
    --text: #1d1d1f;
    --muted: #6b6b70;
    --border: #e4e2dd;
    --accent: #3d5afe;
    --hold: #2e7d32;
    --distinguish: #8a6d00;
    --yield: #b3261e;
    --quote: #f3f1ec;
    color-scheme: light dark;
  }
  @media (prefers-color-scheme: dark) {
    :global(:root) {
      --bg: #121214;
      --surface: #1c1c1f;
      --text: #ececee;
      --muted: #a0a0a8;
      --border: #303036;
      --accent: #8c9eff;
      --hold: #81c784;
      --distinguish: #e6c35c;
      --yield: #f28b82;
      --quote: #26262a;
    }
  }
  :global(body) {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font: 16px/1.5 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  main {
    max-width: 760px;
    margin: 0 auto;
    padding: 24px 16px 64px;
  }
  h1 {
    margin: 0 0 8px;
    font-size: 1.9rem;
  }
  h2 {
    margin: 40px 0 4px;
    font-size: 1.3rem;
  }
  .lede {
    margin: 0 0 8px;
  }
  .meta,
  .blurb,
  .source,
  .detail,
  .count,
  .fx,
  .when {
    color: var(--muted);
    font-size: 0.875rem;
  }
  .blurb {
    margin: 0 0 12px;
  }
  details {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    margin: 10px 0;
  }
  summary {
    cursor: pointer;
    padding: 14px 16px;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px;
  }
  .topic-title {
    font-weight: 600;
    font-size: 1.05rem;
  }
  .badge,
  .tag,
  .role,
  .chip,
  .reaction {
    font-size: 0.75rem;
    border-radius: 999px;
    padding: 1px 8px;
    border: 1px solid var(--border);
    white-space: nowrap;
  }
  .topic-body {
    padding: 0 16px 16px;
  }
  .summary {
    margin-top: 0;
  }
  .instructions {
    background: var(--quote);
    border-radius: 8px;
    padding: 10px 12px;
  }
  .items {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .item {
    border-top: 1px solid var(--border);
    padding: 14px 0;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .role {
    font-weight: 600;
    color: var(--accent);
    border-color: currentColor;
  }
  .item[data-role='Challenge'] .role {
    color: var(--yield);
  }
  .item[data-role='Anchor'] .role {
    color: var(--distinguish);
  }
  .key {
    font-size: 0.75rem;
    color: var(--muted);
  }
  .text {
    font-weight: 500;
    margin: 8px 0;
  }
  .when {
    margin: 6px 0 0;
    font-style: italic;
  }
  blockquote {
    margin: 10px 0 4px;
    padding: 10px 12px;
    background: var(--quote);
    border-left: 3px solid var(--yield);
    border-radius: 0 8px 8px 0;
  }
  .scale,
  .options {
    margin: 6px 0;
    padding-left: 22px;
  }
  .scale li,
  .options li {
    margin: 4px 0;
  }
  .options .fx,
  .revise {
    display: block;
    font-size: 0.8rem;
  }
  .revise {
    color: var(--muted);
  }
  .reaction {
    margin-right: 6px;
  }
  .reaction[data-reaction='hold'] {
    color: var(--hold);
    border-color: currentColor;
  }
  .reaction[data-reaction='distinguish'] {
    color: var(--distinguish);
    border-color: currentColor;
  }
  .reaction[data-reaction='yield'] {
    color: var(--yield);
    border-color: currentColor;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .anchor {
    font-size: 0.875rem;
    background: var(--quote);
    border-radius: 8px;
    padding: 8px 10px;
  }
</style>
